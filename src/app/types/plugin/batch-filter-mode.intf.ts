/**
 * Filter mode for batch capture - determines when a file is considered "complete"
 */
export type BatchFilterMode = 'required' | 'all' | 'never'

/**
 * Default filter mode
 */
export const DEFAULT_BATCH_FILTER_MODE: BatchFilterMode = 'required'

/**
 * Options for the batch filter mode dropdown
 */
export const BATCH_FILTER_MODE_OPTIONS: Record<BatchFilterMode, string> = {
    required: 'All required properties filled',
    all: 'All properties filled',
    never: 'Never'
}

/**
 * Get the display label for a filter mode
 */
export function getBatchFilterModeLabel(mode: BatchFilterMode): string {
    return BATCH_FILTER_MODE_OPTIONS[mode]
}
