import type { ValidationResult, PropertyEditorConfig } from '../../types'
import { validateDate, validateDatetime, isEmpty } from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * Date/datetime editor - renders native date/datetime-local input
 */
export class DateEditor extends BasePropertyEditor {
    private inputEl: HTMLInputElement | null = null

    constructor(config: PropertyEditorConfig) {
        super(config)
    }

    render(container: HTMLElement): void {
        this.containerEl = container
        container.empty()

        const isDatetime = this.config.definition.type === 'datetime'

        this.inputEl = container.createEl('input', {
            cls: this.config.compact
                ? 'lt-editor-input lt-editor-input--compact lt-editor-input--date'
                : 'lt-editor-input lt-editor-input--date',
            type: isDatetime ? 'datetime-local' : 'date'
        })

        // Set current value
        const currentValue = this.formatValue(this.config.value)
        if (currentValue) {
            this.inputEl.value = currentValue
        }

        this.inputEl.addEventListener('change', () => {
            this.notifyChange(this.inputEl?.value ?? '')
        })

        this.inputEl.addEventListener('blur', () => {
            this.notifyCommit()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.notifyEnterKey()
            }
        })
    }

    private formatValue(value: unknown): string {
        if (value === null || value === undefined || value === '') {
            return ''
        }

        const strValue = String(value)
        const isDatetime = this.config.definition.type === 'datetime'

        // Try to parse and format
        try {
            const date = new Date(strValue)
            if (!isNaN(date.getTime())) {
                if (isDatetime) {
                    // Format for datetime-local: YYYY-MM-DDTHH:mm
                    return date.toISOString().slice(0, 16)
                } else {
                    // Format for date: YYYY-MM-DD
                    return date.toISOString().slice(0, 10)
                }
            }
        } catch {
            // Return original value if parsing fails
        }

        return strValue
    }

    getValue(): unknown {
        const value = this.inputEl?.value ?? ''
        return value || undefined
    }

    setValue(value: unknown): void {
        const formatted = this.formatValue(value)
        if (this.inputEl) {
            this.inputEl.value = formatted
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

        const isDatetime = this.config.definition.type === 'datetime'
        return isDatetime ? validateDatetime(value) : validateDate(value)
    }

    override destroy(): void {
        this.inputEl = null
        super.destroy()
    }
}
