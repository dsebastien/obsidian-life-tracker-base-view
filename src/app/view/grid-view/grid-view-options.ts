import type { ViewOption } from 'obsidian'
import {
    BATCH_FILTER_MODE_OPTIONS,
    DEFAULT_BATCH_FILTER_MODE,
    TimeFrame,
    TIME_FRAME_OPTIONS,
    TIME_FRAME_LABELS
} from '../../types'

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
                    key: 'timeFrame',
                    displayName: 'Time frame',
                    default: TimeFrame.AllTime,
                    options: Object.fromEntries(
                        TIME_FRAME_OPTIONS.map((tf) => [tf, TIME_FRAME_LABELS[tf]])
                    )
                },
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
