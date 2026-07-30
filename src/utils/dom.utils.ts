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

/**
 * Set CSS properties on an element using setProperty for dynamic values.
 * This is preferred over direct element.style.* assignment for maintainability.
 * Use CSS classes where possible; use this function only for truly dynamic values
 * like computed dimensions, gaps, or other config-driven styles.
 */
export function setCssProps(el: HTMLElement, props: Record<string, string | number>): void {
    for (const [key, value] of Object.entries(props)) {
        // Convert camelCase to kebab-case for CSS property names
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
        el.style.setProperty(cssKey, typeof value === 'number' ? `${value}px` : value)
    }
}

/**
 * Whether the user prefers reduced motion (OS-level accessibility setting).
 * Use to gate non-essential animations (confetti, chart animations, ...).
 * CSS animations are gated separately via media queries in styles.src.css.
 */
export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Narrow an event target to an element, safely across window realms.
 *
 * `target instanceof Element` compares against the *current* window's `Element`
 * constructor, so it is false for nodes coming from an Obsidian popout window —
 * which would silently kill event delegation there. Duck-typing on `closest`
 * works in every realm.
 */
export function getEventElement(target: EventTarget | null): Element | null {
    if (target === null || typeof target !== 'object') {
        return null
    }
    const candidate = target as Partial<Element>
    return typeof candidate.closest === 'function' ? (candidate as Element) : null
}
