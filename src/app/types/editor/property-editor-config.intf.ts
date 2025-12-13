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
    /** Called when editing is committed (blur) - for saving */
    onCommit?: () => void
    /** Called when Enter key is pressed - for navigation */
    onEnterKey?: () => void
    /** Compact mode for table cells */
    compact?: boolean
}
