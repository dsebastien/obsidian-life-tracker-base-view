import { VisualizationType } from './visualization-type.intf'

/**
 * Visualization option for context menu
 */
export interface ContextMenuVisualizationOption {
    type: VisualizationType
    label: string
    icon: string
}

/**
 * Visualization option for config card (includes description)
 */
export interface ConfigCardVisualizationOption {
    type: VisualizationType
    label: string
    icon: string
    description: string
}

/**
 * Visualization options for context menu
 * Used by card-context-menu.ts
 */
export const CONTEXT_MENU_VISUALIZATION_OPTIONS: ContextMenuVisualizationOption[] = [
    { type: VisualizationType.Heatmap, label: 'Heatmap', icon: 'flame' },
    { type: VisualizationType.BarChart, label: 'Bar chart', icon: 'bar-chart-2' },
    { type: VisualizationType.LineChart, label: 'Line chart', icon: 'trending-up' },
    { type: VisualizationType.AreaChart, label: 'Area chart', icon: 'area-chart' },
    { type: VisualizationType.PieChart, label: 'Pie chart', icon: 'pie-chart' },
    { type: VisualizationType.DoughnutChart, label: 'Doughnut chart', icon: 'circle' },
    { type: VisualizationType.RadarChart, label: 'Radar chart', icon: 'hexagon' },
    { type: VisualizationType.PolarAreaChart, label: 'Polar area chart', icon: 'target' },
    { type: VisualizationType.ScatterChart, label: 'Scatter chart', icon: 'scatter-chart' },
    { type: VisualizationType.BubbleChart, label: 'Bubble chart', icon: 'circle-dot' },
    { type: VisualizationType.TagCloud, label: 'Cloud', icon: 'cloud' },
    { type: VisualizationType.Timeline, label: 'Timeline', icon: 'calendar' }
]

/**
 * Visualization options for config card (property configuration UI)
 * Used by column-config-card.ts
 */
export const CONFIG_CARD_VISUALIZATION_OPTIONS: ConfigCardVisualizationOption[] = [
    {
        type: VisualizationType.Heatmap,
        label: 'Heatmap',
        icon: 'flame',
        description: 'GitHub-style intensity grid'
    },
    {
        type: VisualizationType.BarChart,
        label: 'Bar chart',
        icon: 'bar-chart-2',
        description: 'Vertical bars over time'
    },
    {
        type: VisualizationType.LineChart,
        label: 'Line chart',
        icon: 'trending-up',
        description: 'Connected line over time'
    },
    {
        type: VisualizationType.AreaChart,
        label: 'Area chart',
        icon: 'area-chart',
        description: 'Filled area under line'
    },
    {
        type: VisualizationType.PieChart,
        label: 'Pie chart',
        icon: 'pie-chart',
        description: 'Value distribution as slices'
    },
    {
        type: VisualizationType.DoughnutChart,
        label: 'Doughnut chart',
        icon: 'circle',
        description: 'Pie chart with center cutout'
    },
    {
        type: VisualizationType.RadarChart,
        label: 'Radar chart',
        icon: 'hexagon',
        description: 'Multi-axis comparison'
    },
    {
        type: VisualizationType.PolarAreaChart,
        label: 'Polar area chart',
        icon: 'target',
        description: 'Radial segments by value'
    },
    {
        type: VisualizationType.ScatterChart,
        label: 'Scatter chart',
        icon: 'scatter-chart',
        description: 'Individual data points'
    },
    {
        type: VisualizationType.BubbleChart,
        label: 'Bubble chart',
        icon: 'circle-dot',
        description: 'Points with size dimension'
    },
    {
        type: VisualizationType.TagCloud,
        label: 'Cloud',
        icon: 'cloud',
        description: 'Frequency-sized items'
    },
    {
        type: VisualizationType.Timeline,
        label: 'Timeline',
        icon: 'calendar',
        description: 'Date distribution'
    }
]

/**
 * Visualization options for settings tab dropdown
 * Used by settings-tab.ts
 */
export const SETTINGS_TAB_VISUALIZATION_OPTIONS: Record<string, string> = {
    [VisualizationType.Heatmap]: 'Heatmap',
    [VisualizationType.BarChart]: 'Bar chart',
    [VisualizationType.LineChart]: 'Line chart',
    [VisualizationType.AreaChart]: 'Area chart',
    [VisualizationType.PieChart]: 'Pie chart',
    [VisualizationType.DoughnutChart]: 'Doughnut chart',
    [VisualizationType.RadarChart]: 'Radar chart',
    [VisualizationType.PolarAreaChart]: 'Polar area chart',
    [VisualizationType.ScatterChart]: 'Scatter chart',
    [VisualizationType.BubbleChart]: 'Bubble chart',
    [VisualizationType.TagCloud]: 'Cloud',
    [VisualizationType.Timeline]: 'Timeline'
}

/**
 * Scale preset for numeric visualizations
 */
export interface ScalePreset {
    label: string
    min: number
    max: number
}

/**
 * Common scale presets for numeric visualizations
 * Used by card-context-menu.ts, column-config-card.ts, and settings-tab.ts
 */
export const SCALE_PRESETS: ScalePreset[] = [
    { label: '0-1', min: 0, max: 1 },
    { label: '0-5', min: 0, max: 5 },
    { label: '1-5', min: 1, max: 5 },
    { label: '0-10', min: 0, max: 10 },
    { label: '1-10', min: 1, max: 10 },
    { label: '0-100', min: 0, max: 100 }
]

/**
 * Scale presets as a Record (used by settings-tab.ts dropdown)
 */
export const SCALE_PRESETS_RECORD: Record<string, { min: number; max: number } | null> = {
    auto: null,
    ...Object.fromEntries(SCALE_PRESETS.map((p) => [p.label, { min: p.min, max: p.max }]))
}
