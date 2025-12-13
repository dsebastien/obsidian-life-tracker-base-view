import type { ValidationResult, PropertyEditorConfig, PropertyEditor } from '../../types'

/**
 * Base class for property editors with common functionality
 */
export abstract class BasePropertyEditor implements PropertyEditor {
    protected containerEl: HTMLElement | null = null

    constructor(protected config: PropertyEditorConfig) {}

    abstract render(container: HTMLElement): void
    abstract getValue(): unknown
    abstract setValue(value: unknown): void
    abstract focus(): void
    abstract validate(): ValidationResult

    destroy(): void {
        if (this.containerEl) {
            this.containerEl.empty()
        }
    }

    protected notifyChange(value: unknown): void {
        this.config.onChange(value)
    }

    protected notifyCommit(): void {
        this.config.onCommit?.()
    }

    protected notifyEnterKey(): void {
        this.config.onEnterKey?.()
    }

    protected getDisplayLabel(): string {
        return this.config.definition.displayName || this.config.definition.name
    }
}
