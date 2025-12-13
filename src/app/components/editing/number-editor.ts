import type { ValidationResult, PropertyEditorConfig } from '../../types'
import { validateNumber, isEmpty } from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * Number editor - renders as slider + input if range is defined,
 * otherwise as a plain number input
 */
export class NumberEditor extends BasePropertyEditor {
    private inputEl: HTMLInputElement | null = null
    private sliderEl: HTMLInputElement | null = null

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
        this.sliderEl.value = String(currentValue)

        // Number input
        this.inputEl = wrapper.createEl('input', {
            cls: 'lt-editor-input lt-editor-input--number',
            type: 'number'
        })
        this.inputEl.min = String(numberRange.min)
        this.inputEl.max = String(numberRange.max)
        this.inputEl.value = String(currentValue)

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
            this.clampValue()
            this.notifyCommit()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.clampValue()
                this.notifyCommit()
            }
        })
    }

    private renderInput(container: HTMLElement): void {
        this.inputEl = container.createEl('input', {
            cls: this.config.compact
                ? 'lt-editor-input lt-editor-input--compact lt-editor-input--number'
                : 'lt-editor-input lt-editor-input--number',
            type: 'number',
            placeholder: this.config.definition.description ?? this.getDisplayLabel()
        })

        const numberRange = this.config.definition.numberRange
        if (numberRange) {
            this.inputEl.min = String(numberRange.min)
            this.inputEl.max = String(numberRange.max)
        }

        const currentValue = this.parseValue(this.config.value)
        this.inputEl.value = currentValue !== null ? String(currentValue) : ''

        this.inputEl.addEventListener('input', () => {
            const val = this.inputEl?.value ?? ''
            this.notifyChange(val ? parseFloat(val) : undefined)
        })

        this.inputEl.addEventListener('blur', () => {
            this.clampValue()
            this.notifyCommit()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.clampValue()
                this.notifyCommit()
            }
        })
    }

    /**
     * Clamp the current input value to the min/max range if defined
     */
    private clampValue(): void {
        const numberRange = this.config.definition.numberRange
        if (!numberRange || !this.inputEl) return

        const val = this.inputEl.value
        if (val === '') return

        const numVal = parseFloat(val)
        if (isNaN(numVal)) return

        let clamped = numVal
        if (numVal < numberRange.min) {
            clamped = numberRange.min
        } else if (numVal > numberRange.max) {
            clamped = numberRange.max
        }

        if (clamped !== numVal) {
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
        const num = typeof value === 'number' ? value : parseFloat(String(value))
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
        this.inputEl = null
        this.sliderEl = null
        super.destroy()
    }
}
