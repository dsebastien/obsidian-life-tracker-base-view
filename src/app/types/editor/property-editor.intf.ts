import type { ValidationResult } from '../property/property-definition.types'

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
