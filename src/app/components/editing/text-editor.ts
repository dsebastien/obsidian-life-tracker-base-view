import type { ValidationResult, PropertyEditorConfig } from '../../types'
import { validateText, isEmpty } from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * Text editor - renders as dropdown if allowedValues are defined,
 * otherwise as a plain text input
 */
export class TextEditor extends BasePropertyEditor {
    private inputEl: HTMLInputElement | null = null
    private selectEl: HTMLSelectElement | null = null

    constructor(config: PropertyEditorConfig) {
        super(config)
    }

    render(container: HTMLElement): void {
        this.containerEl = container
        container.empty()

        const hasAllowedValues =
            this.config.definition.allowedValues && this.config.definition.allowedValues.length > 0

        if (hasAllowedValues) {
            this.renderDropdown(container)
        } else {
            this.renderInput(container)
        }
    }

    private renderDropdown(container: HTMLElement): void {
        this.selectEl = container.createEl('select', {
            cls: this.config.compact
                ? 'lt-editor-select lt-editor-select--compact'
                : 'lt-editor-select'
        })

        // Add empty option
        this.selectEl.createEl('option', {
            value: '',
            text: '— Select —'
        })

        // Add allowed values
        for (const value of this.config.definition.allowedValues) {
            const strValue = String(value)
            this.selectEl.createEl('option', {
                value: strValue,
                text: strValue
            })
        }

        // Set current value (handle null/undefined explicitly)
        const currentValue = this.config.value == null ? '' : String(this.config.value)
        this.selectEl.value = currentValue

        // Event handlers
        this.selectEl.addEventListener('change', () => {
            this.notifyChange(this.selectEl?.value ?? '')
        })

        this.selectEl.addEventListener('blur', () => {
            this.notifyCommit()
        })

        this.selectEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.notifyEnterKey()
            }
        })
    }

    private renderInput(container: HTMLElement): void {
        this.inputEl = container.createEl('input', {
            cls: this.config.compact
                ? 'lt-editor-input lt-editor-input--compact'
                : 'lt-editor-input',
            type: 'text',
            placeholder: this.config.definition.description ?? this.getDisplayLabel()
        })

        // Set current value (handle null/undefined explicitly)
        this.inputEl.value = this.config.value == null ? '' : String(this.config.value)

        // Event handlers
        this.inputEl.addEventListener('input', () => {
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

    getValue(): unknown {
        if (this.selectEl) {
            return this.selectEl.value
        }
        return this.inputEl?.value ?? ''
    }

    setValue(value: unknown): void {
        const strValue = value == null ? '' : String(value)
        if (this.selectEl) {
            this.selectEl.value = strValue
        } else if (this.inputEl) {
            this.inputEl.value = strValue
        }
    }

    focus(): void {
        if (this.selectEl) {
            this.selectEl.focus()
        } else if (this.inputEl) {
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

        return validateText(value, this.config.definition)
    }

    override destroy(): void {
        this.inputEl = null
        this.selectEl = null
        super.destroy()
    }
}
