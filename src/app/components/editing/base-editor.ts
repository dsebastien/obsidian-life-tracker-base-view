import type { PropertyDefinition, ValidationResult } from '../../types/property-definition.types'

/**
 * Configuration for creating a property editor
 */
export interface PropertyEditorConfig {
    /** Property definition */
    definition: PropertyDefinition
    /** Current value */
    value: unknown
    /** Called when value changes */
    onChange: (value: unknown) => void
    /** Called when editing is committed (blur/enter) */
    onCommit?: () => void
    /** Compact mode for table cells */
    compact?: boolean
}

/**
 * Interface for property editors
 */
export interface PropertyEditor {
    /** Render the editor into a container */
    render(container: HTMLElement): void
    /** Get current value */
    getValue(): unknown
    /** Set value programmatically */
    setValue(value: unknown): void
    /** Focus the editor */
    focus(): void
    /** Validate current value */
    validate(): ValidationResult
    /** Clean up resources */
    destroy(): void
}

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

    protected getDisplayLabel(): string {
        return this.config.definition.displayName || this.config.definition.name
    }
}
