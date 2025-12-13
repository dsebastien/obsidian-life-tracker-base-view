import type { PropertyDefinition } from '../property/property-definition.types'

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
