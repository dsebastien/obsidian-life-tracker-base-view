import type { ViewOption } from 'obsidian'
import {
    BATCH_FILTER_MODE_OPTIONS,
    DEFAULT_BATCH_FILTER_MODE
} from '../../types/batch-filter-mode.intf'

/**
 * Get view options for Grid View configuration
 */
export function getGridViewOptions(): ViewOption[] {
    return [
        // Filtering options
        {
            type: 'group',
            displayName: 'Filtering',
            items: [
                {
                    type: 'dropdown',
                    key: 'hideNotesWhen',
                    displayName: 'Hide notes when',
                    default: DEFAULT_BATCH_FILTER_MODE,
                    options: BATCH_FILTER_MODE_OPTIONS
                }
            ]
        }
    ]
}
