/**
 * Create empty state element
 */
export function createEmptyState(
    container: HTMLElement,
    message: string,
    icon?: string
): HTMLElement {
    const el = container.createDiv({ cls: 'lt-empty' })

    if (icon) {
        el.createDiv({ cls: 'lt-empty-icon', text: icon })
    }

    el.createDiv({ cls: 'lt-empty-text', text: message })

    return el
}

/**
 * Create loading state element
 */
export function createLoadingState(container: HTMLElement): HTMLElement {
    const el = container.createDiv({ cls: 'lt-loading' })
    el.createDiv({ cls: 'lt-loading-spinner' })
    return el
}

/**
 * Create error state element
 */
export function createErrorState(
    container: HTMLElement,
    message: string,
    details?: string
): HTMLElement {
    const el = container.createDiv({ cls: 'lt-error' })

    el.createDiv({ cls: 'lt-error-icon', text: '⚠️' })
    el.createDiv({ cls: 'lt-error-message', text: message })

    if (details) {
        el.createDiv({ cls: 'lt-error-details', text: details })
    }

    return el
}

/**
 * Messages for different empty state scenarios
 */
export const EMPTY_STATE_MESSAGES = {
    noData: 'No data available',
    noDateAnchor: 'No date information found for entries',
    noBooleanData: 'No boolean values found for heatmap',
    noNumericData: 'No numeric values found for chart',
    noTagData: 'No tags or lists found',
    noProperties: 'No properties configured for visualization',
    basesDisabled: 'Bases feature is not enabled in this vault'
} as const
