import type { ViewOption } from 'obsidian'
import { TimeGranularity } from '../types'

/**
 * Default embedded height in pixels
 */
export const DEFAULT_EMBEDDED_HEIGHT = 400

/**
 * Default cell size for heatmap
 */
export const DEFAULT_CELL_SIZE = 12

/**
 * Default number of grid columns
 */
export const DEFAULT_GRID_COLUMNS = 2

/**
 * Get view options for Life Tracker view configuration
 */
export function getLifeTrackerViewOptions(): ViewOption[] {
    return [
        // Date anchor configuration
        {
            type: 'property',
            key: 'dateAnchorProperty',
            displayName: 'Date anchor property',
            placeholder: 'Auto-detect from filename',
            filter: (prop: string) => !prop.startsWith('file.')
        },

        // Time granularity
        {
            type: 'dropdown',
            key: 'granularity',
            displayName: 'Time granularity',
            default: TimeGranularity.Daily,
            options: {
                [TimeGranularity.Daily]: 'Daily',
                [TimeGranularity.Weekly]: 'Weekly',
                [TimeGranularity.Monthly]: 'Monthly',
                [TimeGranularity.Quarterly]: 'Quarterly',
                [TimeGranularity.Yearly]: 'Yearly'
            }
        },

        // Layout options
        {
            type: 'group',
            displayName: 'Layout',
            items: [
                {
                    type: 'slider',
                    key: 'gridColumns',
                    displayName: 'Number of columns',
                    min: 1,
                    max: 6,
                    step: 1,
                    default: DEFAULT_GRID_COLUMNS
                },
                {
                    type: 'toggle',
                    key: 'showEmptyValues',
                    displayName: 'Show empty values',
                    default: true
                }
            ]
        },

        // Heatmap options
        {
            type: 'group',
            displayName: 'Heatmap',
            items: [
                {
                    type: 'slider',
                    key: 'heatmapCellSize',
                    displayName: 'Cell size',
                    min: 8,
                    max: 24,
                    step: 2,
                    default: DEFAULT_CELL_SIZE
                },
                {
                    type: 'toggle',
                    key: 'heatmapShowMonthLabels',
                    displayName: 'Show month labels',
                    default: true
                },
                {
                    type: 'toggle',
                    key: 'heatmapShowDayLabels',
                    displayName: 'Show day labels',
                    default: true
                },
                {
                    type: 'dropdown',
                    key: 'heatmapColorScheme',
                    displayName: 'Color scheme',
                    default: 'green',
                    options: {
                        green: 'Green (GitHub)',
                        blue: 'Blue',
                        purple: 'Purple',
                        orange: 'Orange',
                        red: 'Red'
                    }
                }
            ]
        },

        // Chart options
        {
            type: 'group',
            displayName: 'Charts',
            items: [
                {
                    type: 'dropdown',
                    key: 'chartType',
                    displayName: 'Default chart type',
                    default: 'line',
                    options: {
                        line: 'Line chart',
                        bar: 'Bar chart'
                    }
                },
                {
                    type: 'toggle',
                    key: 'chartShowLegend',
                    displayName: 'Show legend',
                    default: false
                },
                {
                    type: 'toggle',
                    key: 'chartShowGrid',
                    displayName: 'Show grid lines',
                    default: true
                }
            ]
        },

        // Tag cloud options
        {
            type: 'group',
            displayName: 'Tag cloud',
            items: [
                {
                    type: 'slider',
                    key: 'tagCloudMaxTags',
                    displayName: 'Max tags to show',
                    min: 10,
                    max: 100,
                    step: 10,
                    default: 50
                },
                {
                    type: 'dropdown',
                    key: 'tagCloudSortBy',
                    displayName: 'Sort by',
                    default: 'frequency',
                    options: {
                        frequency: 'Frequency',
                        alphabetical: 'Alphabetical'
                    }
                }
            ]
        }
    ]
}
