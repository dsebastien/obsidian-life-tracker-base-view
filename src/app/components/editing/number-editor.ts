import type { ValidationResult, PropertyEditorConfig } from '../../types'
import {
    validateNumber,
    isEmpty,
    setupNumberInputBlocking,
    clampToRange,
    listEmojiEntries,
    findEmojiEntry
} from '../../../utils'
import { BasePropertyEditor } from './base-editor'
import { NUMBER_INPUT_ATTRS, NUMBER_SLIDER_STEP } from './editing.constants'
import { computeSteppedValue } from './number-step.utils'

/**
 * Number editor - renders as slider + input if range is defined,
 * otherwise as a plain number input
 */
export class NumberEditor extends BasePropertyEditor {
    private inputEl: HTMLInputElement | null = null
    private sliderEl: HTMLInputElement | null = null
    private cleanupInputBlocking: (() => void) | null = null
    private decrementBtn: HTMLButtonElement | null = null
    private incrementBtn: HTMLButtonElement | null = null
    /** Emoji quick-entry row (issue #22), absent when the property has none */
    private emojiRowEl: HTMLElement | null = null

    constructor(config: PropertyEditorConfig) {
        super(config)
    }

    render(container: HTMLElement): void {
        this.containerEl = container
        container.empty()

        const numberRange = this.config.definition.numberRange
        const hasRange = numberRange !== null

        if (hasRange && !this.config.compact) {
            this.renderSliderWithInput(container)
        } else {
            this.renderInput(container)
        }

        // One-tap emoji entry (issue #22). Not in compact grid cells: the row
        // would not fit and cards must stay visually stable.
        if (!this.config.compact) {
            this.renderEmojiPicker(container)
        }
    }

    /**
     * Row of emoji buttons that set the value in one tap (issue #22).
     *
     * A range entry records its lower bound — the only member of a range we can
     * name unambiguously. Renders nothing when the property has no emojis.
     */
    private renderEmojiPicker(container: HTMLElement): void {
        const entries = listEmojiEntries(this.config.definition.valueEmojis)
        if (entries.length === 0) return

        const row = container.createDiv({ cls: 'lt-editor-emoji-row' })

        for (const entry of entries) {
            const label = `Set ${this.getDisplayLabel()} to ${entry.value}`
            const button = row.createEl('button', {
                cls: 'lt-editor-emoji-btn',
                text: entry.emoji,
                attr: {
                    'type': 'button',
                    'aria-label': label,
                    'title': `${entry.key} ${entry.emoji}`
                }
            })

            button.addEventListener('click', (event) => {
                event.preventDefault()
                this.applyEmojiValue(entry.value)
            })
        }

        this.emojiRowEl = row
        this.updateEmojiSelection()
    }

    /**
     * Record the value behind an emoji button, clamped to the property's range.
     */
    private applyEmojiValue(value: number): void {
        const clamped = clampToRange(value, this.config.definition.numberRange)

        if (this.inputEl) {
            this.inputEl.value = String(clamped)
        }
        if (this.sliderEl) {
            this.sliderEl.value = String(clamped)
        }

        this.notifyChange(clamped)
        this.notifyCommit()
        this.updateStepperState()
    }

    /**
     * Mark the emoji button matching the current value, so the row reflects
     * state instead of only offering actions.
     */
    private updateEmojiSelection(): void {
        if (!this.emojiRowEl) return

        const current = this.parseValue(this.inputEl?.value)
        const entries = listEmojiEntries(this.config.definition.valueEmojis)
        // Resolve through the same precedence the tooltips use, keyed by the
        // mapping key: comparing against `entry.value` would miss every value
        // inside a range except its lower bound, and would light up two buttons
        // when ranges share one
        const active = findEmojiEntry(current, this.config.definition.valueEmojis)
        const buttons = Array.from(
            this.emojiRowEl.querySelectorAll<HTMLElement>('.lt-editor-emoji-btn')
        )

        buttons.forEach((button, index) => {
            const entry = entries[index]
            const selected = entry !== undefined && active !== null && entry.key === active.key
            button.toggleClass('lt-editor-emoji-btn--selected', selected)
            button.setAttribute('aria-pressed', selected ? 'true' : 'false')
        })
    }

    private renderSliderWithInput(container: HTMLElement): void {
        const wrapper = container.createDiv({ cls: 'lt-editor-number-wrapper' })

        const numberRange = this.config.definition.numberRange!
        const currentValue = this.parseValue(this.config.value)

        // Slider
        this.sliderEl = wrapper.createEl('input', {
            cls: 'lt-editor-slider',
            type: 'range'
        })
        this.sliderEl.min = String(numberRange.min)
        this.sliderEl.max = String(numberRange.max)
        // Per-property step when configured, else the fractional default (issue #107)
        this.sliderEl.step =
            numberRange.step != null && numberRange.step > 0
                ? String(numberRange.step)
                : NUMBER_SLIDER_STEP
        this.sliderEl.value = currentValue !== null ? String(currentValue) : String(numberRange.min)

        // Quick −/+ buttons around the input for one-tap entry (issue #125)
        const stepperEl = wrapper.createDiv({ cls: 'lt-editor-stepper' })
        this.decrementBtn = this.createStepButton(stepperEl, -1)

        // Number input (use text type for better control over input blocking)
        this.inputEl = stepperEl.createEl('input', {
            cls: 'lt-editor-input lt-editor-input--number',
            type: 'text',
            attr: { ...NUMBER_INPUT_ATTRS }
        })
        this.inputEl.value = currentValue !== null ? String(currentValue) : ''

        this.incrementBtn = this.createStepButton(stepperEl, 1)

        // Setup input blocking for the text input
        this.cleanupInputBlocking = setupNumberInputBlocking(
            this.inputEl,
            numberRange,
            (clampedValue) => {
                // Update slider when value is clamped
                if (this.sliderEl) {
                    this.sliderEl.value = String(clampedValue)
                }
                this.notifyChange(clampedValue)
            }
        )

        // Sync slider and input
        this.sliderEl.addEventListener('input', () => {
            const val = this.sliderEl?.value ?? ''
            if (this.inputEl) this.inputEl.value = val
            this.notifyChange(parseFloat(val))
            this.updateStepperState()
        })

        this.inputEl.addEventListener('input', () => {
            const val = this.inputEl?.value ?? ''
            if (this.sliderEl) this.sliderEl.value = val
            this.notifyChange(val ? parseFloat(val) : undefined)
            this.updateStepperState()
        })

        this.sliderEl.addEventListener('change', () => {
            this.notifyCommit()
        })

        this.inputEl.addEventListener('blur', () => {
            this.ensureValidValue()
            this.notifyCommit()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.ensureValidValue()
                this.notifyEnterKey()
            }
        })

        this.updateStepperState()
    }

    private renderInput(container: HTMLElement): void {
        // Compact mode (grid cells) stays a bare input: the −/+ buttons would
        // not fit the cell and the grid must stay visually stable
        const withStepper = !this.config.compact
        const inputParent = withStepper
            ? container.createDiv({ cls: 'lt-editor-stepper' })
            : container

        if (withStepper) {
            this.decrementBtn = this.createStepButton(inputParent, -1)
        }

        // Use text type for better control over input blocking
        this.inputEl = inputParent.createEl('input', {
            cls: this.config.compact
                ? 'lt-editor-input lt-editor-input--compact lt-editor-input--number'
                : 'lt-editor-input lt-editor-input--number',
            type: 'text',
            placeholder: this.config.definition.description ?? this.getDisplayLabel(),
            attr: { ...NUMBER_INPUT_ATTRS }
        })

        if (withStepper) {
            this.incrementBtn = this.createStepButton(inputParent, 1)
        }

        const numberRange = this.config.definition.numberRange
        const currentValue = this.parseValue(this.config.value)
        this.inputEl.value = currentValue !== null ? String(currentValue) : ''

        // Setup input blocking
        this.cleanupInputBlocking = setupNumberInputBlocking(
            this.inputEl,
            numberRange,
            (clampedValue) => {
                this.notifyChange(clampedValue)
            }
        )

        this.inputEl.addEventListener('input', () => {
            const val = this.inputEl?.value ?? ''
            this.notifyChange(val ? parseFloat(val) : undefined)
            this.updateStepperState()
        })

        this.inputEl.addEventListener('blur', () => {
            this.ensureValidValue()
            this.notifyCommit()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.ensureValidValue()
                this.notifyEnterKey()
            }
        })

        this.updateStepperState()
    }

    /**
     * Create a −/+ quick button (issue #125). `direction` is -1 or 1.
     */
    private createStepButton(parent: HTMLElement, direction: -1 | 1): HTMLButtonElement {
        const isIncrement = direction === 1
        const label = `${isIncrement ? 'Increase' : 'Decrease'} ${this.getDisplayLabel()}`
        const button = parent.createEl('button', {
            cls: 'lt-editor-step-btn',
            text: isIncrement ? '+' : '−',
            attr: { 'type': 'button', 'aria-label': label, 'title': label }
        })

        button.addEventListener('click', (event) => {
            event.preventDefault()
            this.step(direction)
        })

        return button
    }

    /**
     * Apply one step in the given direction and persist it (issue #125)
     */
    private step(direction: -1 | 1): void {
        if (!this.inputEl) return

        const value = computeSteppedValue(
            this.parseValue(this.inputEl.value),
            direction,
            this.config.definition.numberRange
        )

        this.inputEl.value = String(value)
        if (this.sliderEl) {
            this.sliderEl.value = String(value)
        }

        this.notifyChange(value)
        this.notifyCommit()
        this.updateStepperState()
    }

    /**
     * Disable the −/+ buttons once the value sits at a range bound
     */
    private updateStepperState(): void {
        // Also refresh the emoji row here: every place that changes the value
        // already calls this, so the two controls cannot drift out of sync
        this.updateEmojiSelection()

        if (!this.decrementBtn && !this.incrementBtn) return

        const numberRange = this.config.definition.numberRange
        const current = this.parseValue(this.inputEl?.value)

        const atMin = numberRange !== null && current !== null && current <= numberRange.min
        const atMax = numberRange !== null && current !== null && current >= numberRange.max

        if (this.decrementBtn) {
            this.decrementBtn.disabled = atMin
        }
        if (this.incrementBtn) {
            this.incrementBtn.disabled = atMax
        }
    }

    /**
     * Ensure the current input value is valid and within range.
     * Called on blur/enter to handle edge cases like empty or incomplete input.
     */
    private ensureValidValue(): void {
        if (!this.inputEl) return

        const val = this.inputEl.value.trim()

        // If empty, leave it (will be handled by required validation)
        if (val === '' || val === '-') {
            if (val === '-') {
                this.inputEl.value = ''
            }
            return
        }

        const numVal = parseFloat(val)
        if (isNaN(numVal)) {
            // Invalid number, clear the field
            this.inputEl.value = ''
            if (this.sliderEl) {
                const range = this.config.definition.numberRange
                this.sliderEl.value = String(range?.min ?? 0)
            }
            return
        }

        // Clamp to range if defined
        const numberRange = this.config.definition.numberRange
        const clamped = clampToRange(numVal, numberRange)
        if (clamped !== null && clamped !== numVal) {
            this.inputEl.value = String(clamped)
            if (this.sliderEl) {
                this.sliderEl.value = String(clamped)
            }
            this.notifyChange(clamped)
        }
    }

    private parseValue(value: unknown): number | null {
        if (value === null || value === undefined || value === '') {
            return null
        }
        if (typeof value === 'number') {
            return isNaN(value) ? null : value
        }
        // Objects without meaningful toString() would return '[object Object]'
        if (typeof value === 'object') {
            return null
        }
        // Only strings can be parsed as numbers
        if (typeof value !== 'string') {
            return null
        }
        const num = parseFloat(value)
        return isNaN(num) ? null : num
    }

    getValue(): unknown {
        const val = this.inputEl?.value ?? ''
        return val ? parseFloat(val) : undefined
    }

    setValue(value: unknown): void {
        const numValue = this.parseValue(value)
        const strValue = numValue !== null ? String(numValue) : ''

        if (this.inputEl) {
            this.inputEl.value = strValue
        }
        if (this.sliderEl) {
            this.sliderEl.value = strValue
        }

        this.updateStepperState()
    }

    focus(): void {
        if (this.inputEl) {
            this.inputEl.focus()
        }
    }

    validate(): ValidationResult {
        const value = this.getValue()

        if (this.config.definition.required && isEmpty(value)) {
            return { valid: false, error: 'This field is required' }
        }

        if (isEmpty(value)) {
            return { valid: true }
        }

        return validateNumber(value, this.config.definition)
    }

    override destroy(): void {
        // Clean up input blocking event listeners
        this.cleanupInputBlocking?.()
        this.cleanupInputBlocking = null
        this.inputEl = null
        this.sliderEl = null
        this.decrementBtn = null
        this.incrementBtn = null
        super.destroy()
    }
}
