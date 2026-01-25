import type { ValidationResult, PropertyEditorConfig } from '../../types'
import { validateNumber, isEmpty, setupNumberInputBlocking, clampToRange } from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * Number editor - renders as slider + input if range is defined,
 * otherwise as a plain number input
 */
export class NumberEditor extends BasePropertyEditor {
    private inputEl: HTMLInputElement | null = null
    private sliderEl: HTMLInputElement | null = null
    private cleanupInputBlocking: (() => void) | null = null

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
        this.sliderEl.step = '1'
        this.sliderEl.value = currentValue !== null ? String(currentValue) : String(numberRange.min)

        // Number input (use text type for better control over input blocking)
        this.inputEl = wrapper.createEl('input', {
            cls: 'lt-editor-input lt-editor-input--number',
            type: 'text',
            attr: {
                inputmode: 'numeric',
                pattern: '[0-9]*'
            }
        })
        this.inputEl.value = currentValue !== null ? String(currentValue) : ''

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
        })

        this.inputEl.addEventListener('input', () => {
            const val = this.inputEl?.value ?? ''
            if (this.sliderEl) this.sliderEl.value = val
            this.notifyChange(val ? parseFloat(val) : undefined)
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
    }

    private renderInput(container: HTMLElement): void {
        // Use text type for better control over input blocking
        this.inputEl = container.createEl('input', {
            cls: this.config.compact
                ? 'lt-editor-input lt-editor-input--compact lt-editor-input--number'
                : 'lt-editor-input lt-editor-input--number',
            type: 'text',
            placeholder: this.config.definition.description ?? this.getDisplayLabel(),
            attr: {
                inputmode: 'numeric',
                pattern: '[0-9]*'
            }
        })

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
        super.destroy()
    }
}
