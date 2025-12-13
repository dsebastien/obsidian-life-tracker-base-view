import type { ValidationResult, PropertyEditorConfig } from '../../types'
import { validateBoolean } from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * Boolean editor - renders as a toggle/checkbox
 */
export class BooleanEditor extends BasePropertyEditor {
    private toggleEl: HTMLElement | null = null
    private checkboxEl: HTMLInputElement | null = null
    private currentValue = false

    constructor(config: PropertyEditorConfig) {
        super(config)
        this.currentValue = this.parseBoolean(config.value)
    }

    render(container: HTMLElement): void {
        this.containerEl = container
        container.empty()

        if (this.config.compact) {
            this.renderCheckbox(container)
        } else {
            this.renderToggle(container)
        }
    }

    private renderToggle(container: HTMLElement): void {
        this.toggleEl = container.createDiv({
            cls: 'lt-editor-toggle'
        })

        this.updateToggleState()

        this.toggleEl.addEventListener('click', () => {
            this.currentValue = !this.currentValue
            this.updateToggleState()
            this.notifyChange(this.currentValue)
            this.notifyCommit()
        })

        this.toggleEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                this.currentValue = !this.currentValue
                this.updateToggleState()
                this.notifyChange(this.currentValue)
                this.notifyCommit()
            }
        })

        // Make focusable
        this.toggleEl.tabIndex = 0
    }

    private renderCheckbox(container: HTMLElement): void {
        const label = container.createEl('label', {
            cls: 'lt-editor-checkbox-wrapper'
        })

        this.checkboxEl = label.createEl('input', {
            type: 'checkbox',
            cls: 'lt-editor-checkbox'
        })
        this.checkboxEl.checked = this.currentValue

        this.checkboxEl.addEventListener('change', () => {
            this.currentValue = this.checkboxEl?.checked ?? false
            this.notifyChange(this.currentValue)
            this.notifyCommit()
        })
    }

    private updateToggleState(): void {
        if (!this.toggleEl) return

        this.toggleEl.empty()
        this.toggleEl.classList.toggle('lt-editor-toggle--on', this.currentValue)

        // Create track
        const track = this.toggleEl.createDiv({ cls: 'lt-editor-toggle-track' })

        // Create thumb
        track.createDiv({ cls: 'lt-editor-toggle-thumb' })
    }

    private parseBoolean(value: unknown): boolean {
        if (typeof value === 'boolean') return value
        if (value === null || value === undefined) return false

        const strVal = String(value).toLowerCase()
        return strVal === 'true' || strVal === 'yes' || strVal === '1'
    }

    getValue(): unknown {
        return this.currentValue
    }

    setValue(value: unknown): void {
        this.currentValue = this.parseBoolean(value)
        this.updateToggleState()
        if (this.checkboxEl) {
            this.checkboxEl.checked = this.currentValue
        }
    }

    focus(): void {
        if (this.toggleEl) {
            this.toggleEl.focus()
        } else if (this.checkboxEl) {
            this.checkboxEl.focus()
        }
    }

    validate(): ValidationResult {
        return validateBoolean(this.currentValue)
    }

    override destroy(): void {
        this.toggleEl = null
        this.checkboxEl = null
        super.destroy()
    }
}
