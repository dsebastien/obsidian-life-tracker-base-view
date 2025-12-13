/**
 * Property types supported by Obsidian's property system.
 *
 * NOTE: Compatible with Obsidian Starter Kit plugin's ObsidianPropertyType.
 * Uses 'checkbox' instead of 'boolean' to match Obsidian's internal naming.
 *
 * @see https://help.obsidian.md/Editing+and+formatting/Properties
 */
export type ObsidianPropertyType =
    | 'text' // Single-line text input
    | 'list' // Array of text values (multi-line list)
    | 'number' // Numeric value
    | 'checkbox' // Boolean (true/false)
    | 'date' // Date in YYYY-MM-DD format
    | 'datetime' // Date with time
    | 'tags' // Array of tags (special rendering in Obsidian)

/**
 * Alias for backwards compatibility
 * @deprecated Use ObsidianPropertyType instead
 */
export type PropertyType = ObsidianPropertyType

/**
 * All available property types
 */
export const PROPERTY_TYPES: ObsidianPropertyType[] = [
    'text',
    'number',
    'checkbox',
    'date',
    'datetime',
    'list',
    'tags'
]

/**
 * Human-readable labels for property types
 */
export const PROPERTY_TYPE_LABELS: Record<ObsidianPropertyType, string> = {
    text: 'Text',
    number: 'Number',
    checkbox: 'Checkbox',
    date: 'Date',
    datetime: 'Date & Time',
    list: 'List',
    tags: 'Tags'
}

/**
 * Mapping types for property filtering/recognition.
 * Compatible with Obsidian Starter Kit plugin's MappingType.
 */
export type MappingType = 'tag' | 'folder' | 'regex' | 'formula'

/**
 * Defines how properties are associated with specific notes.
 * Compatible with Obsidian Starter Kit plugin's Mapping interface.
 *
 * A property matches a note if it matches ANY enabled mapping (OR logic).
 *
 * @example
 * // Tag-based filtering - property applies to notes with #meeting tag
 * { type: 'tag', value: 'meeting', enabled: true }
 *
 * @example
 * // Folder-based filtering - property applies to notes in Personal/Meetings
 * { type: 'folder', value: 'Personal/Meetings', enabled: true }
 *
 * @example
 * // Regex pattern - property applies to daily notes
 * { type: 'regex', value: '^\\d{4}-\\d{2}-\\d{2}$', enabled: true }
 */
export interface Mapping {
    /** Type of mapping strategy */
    type: MappingType
    /** Value/pattern to match against */
    value: string
    /** Whether this mapping is active */
    enabled: boolean
}

/**
 * Number range for numeric property validation.
 * Compatible with Obsidian Starter Kit plugin's NumberRange.
 */
export interface NumberRange {
    min: number
    max: number
}

/**
 * Valid default values for Obsidian properties.
 * Compatible with Obsidian Starter Kit plugin's PropertyDefaultValue.
 */
export type PropertyDefaultValue = string | number | boolean | string[] | null

/**
 * Valid allowed values for Obsidian properties.
 * Compatible with Obsidian Starter Kit plugin's PropertyAllowedValues.
 */
export type PropertyAllowedValues = string[] | number[]

/**
 * Definition of a trackable property.
 * Compatible with Obsidian Starter Kit plugin's PropertyDefinition.
 *
 * Stored in plugin settings and used across all views.
 * Properties can be filtered to specific notes via mappings.
 *
 * @example
 * // Required date property with default
 * {
 *   id: 'prop-1704670800000-abc123',
 *   name: 'meeting_date',
 *   displayName: 'Meeting Date',
 *   type: 'date',
 *   required: true,
 *   defaultValue: null,
 *   description: 'When the meeting occurred',
 *   mappings: [{ type: 'tag', value: 'meeting', enabled: true }]
 * }
 *
 * @example
 * // Enum-like text property with allowed values
 * {
 *   id: 'prop-1704670800001-def456',
 *   name: 'status',
 *   displayName: 'Status',
 *   type: 'text',
 *   required: true,
 *   allowedValues: ['scheduled', 'completed', 'cancelled'],
 *   defaultValue: 'scheduled',
 *   description: 'Current meeting status',
 *   mappings: []
 * }
 */
export interface PropertyDefinition {
    /** Unique ID (UUID) - Life Tracker extension */
    id: string
    /** Property name (as it appears in frontmatter) */
    name: string
    /** Display name for UI */
    displayName: string
    /** Property type */
    type: ObsidianPropertyType
    /** List of allowed values (empty array if not constrained) */
    allowedValues: PropertyAllowedValues
    /** Number range for numeric properties (null if not constrained by range) */
    numberRange: NumberRange | null
    /** Default value when auto-adding properties (null if no default) */
    defaultValue: PropertyDefaultValue
    /** Whether this property is required */
    required: boolean
    /** Description (empty string if not set) */
    description: string
    /** Display order (lower = first) - Life Tracker extension */
    order: number
    /** Mappings to filter which notes this property applies to (empty = all notes) - Life Tracker extension */
    mappings: Mapping[]
}

/**
 * Issue found with a property value
 */
export interface PropertyIssue {
    /** Name of the property with the issue */
    propertyName: string
    /** Type of issue */
    type: 'missing' | 'invalid'
    /** Human-readable message */
    message: string
}

/**
 * Result of validating a property value
 */
export interface ValidationResult {
    /** Whether the value is valid */
    valid: boolean
    /** Error message if invalid */
    error?: string
}

/**
 * Create a new property definition with default values.
 * Compatible with Obsidian Starter Kit plugin format.
 */
export function createDefaultPropertyDefinition(id: string, order: number): PropertyDefinition {
    return {
        id,
        name: '',
        displayName: '',
        type: 'text',
        allowedValues: [],
        numberRange: null,
        defaultValue: null,
        required: false,
        description: '',
        order,
        mappings: []
    }
}

/**
 * Get the display label for a property definition.
 * Falls back to name if displayName is empty.
 */
export function getPropertyDisplayLabel(definition: PropertyDefinition): string {
    return definition.displayName || definition.name
}

/**
 * Human-readable labels for mapping types
 */
export const MAPPING_TYPE_LABELS: Record<MappingType, string> = {
    tag: 'Tag',
    folder: 'Folder',
    regex: 'Regex',
    formula: 'Formula'
}

/**
 * Create a new mapping with default values
 */
export function createDefaultMapping(type: MappingType = 'folder'): Mapping {
    return {
        type,
        value: '',
        enabled: true
    }
}
