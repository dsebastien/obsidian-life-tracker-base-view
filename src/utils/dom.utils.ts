/**
 * CSS class names used for DOM queries and element identification.
 * These must match the class names in styles.src.css.
 */
export const CSS_CLASS = {
    // Layout
    CARD: 'lt-card',
    HIDDEN: 'lt-hidden',

    // Visualizations
    HEATMAP_CELL: 'lt-heatmap-cell',

    // Settings
    PROPERTY_DETAILS: 'lt-property-details'
} as const

/**
 * CSS selectors for DOM queries.
 */
export const CSS_SELECTOR = {
    CARD: `.${CSS_CLASS.CARD}`,
    HEATMAP_CELL: `.${CSS_CLASS.HEATMAP_CELL}`,
    PROPERTY_DETAILS: `.${CSS_CLASS.PROPERTY_DETAILS}`
} as const

/**
 * Data attribute names (without 'data-' prefix) for use with dataset API.
 */
export const DATA_ATTR = {
    PROPERTY_ID: 'propertyId',
    FILE_PATH: 'filePath',
    ROW_INDEX: 'rowIndex'
} as const

/**
 * Data attribute names (with 'data-' prefix) for use with getAttribute/setAttribute.
 */
export const DATA_ATTR_FULL = {
    PROPERTY_ID: 'data-property-id',
    FILE_PATH: 'data-file-path',
    ROW_INDEX: 'data-row-index'
} as const
