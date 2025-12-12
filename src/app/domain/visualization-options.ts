import { VisualizationType } from './visualization-type.enum'

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
    { type: VisualizationType.BarChart, label: 'Bar Chart', icon: 'bar-chart-2' },
    { type: VisualizationType.LineChart, label: 'Line Chart', icon: 'trending-up' },
    { type: VisualizationType.AreaChart, label: 'Area Chart', icon: 'area-chart' },
    { type: VisualizationType.PieChart, label: 'Pie Chart', icon: 'pie-chart' },
    { type: VisualizationType.DoughnutChart, label: 'Doughnut Chart', icon: 'circle' },
    { type: VisualizationType.RadarChart, label: 'Radar Chart', icon: 'hexagon' },
    { type: VisualizationType.PolarAreaChart, label: 'Polar Area Chart', icon: 'target' },
    { type: VisualizationType.ScatterChart, label: 'Scatter Chart', icon: 'scatter-chart' },
    { type: VisualizationType.BubbleChart, label: 'Bubble Chart', icon: 'circle-dot' },
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
        label: 'Bar Chart',
        icon: 'bar-chart-2',
        description: 'Vertical bars over time'
    },
    {
        type: VisualizationType.LineChart,
        label: 'Line Chart',
        icon: 'trending-up',
        description: 'Connected line over time'
    },
    {
        type: VisualizationType.AreaChart,
        label: 'Area Chart',
        icon: 'area-chart',
        description: 'Filled area under line'
    },
    {
        type: VisualizationType.PieChart,
        label: 'Pie Chart',
        icon: 'pie-chart',
        description: 'Value distribution as slices'
    },
    {
        type: VisualizationType.DoughnutChart,
        label: 'Doughnut Chart',
        icon: 'circle',
        description: 'Pie chart with center cutout'
    },
    {
        type: VisualizationType.RadarChart,
        label: 'Radar Chart',
        icon: 'hexagon',
        description: 'Multi-axis comparison'
    },
    {
        type: VisualizationType.PolarAreaChart,
        label: 'Polar Area Chart',
        icon: 'target',
        description: 'Radial segments by value'
    },
    {
        type: VisualizationType.ScatterChart,
        label: 'Scatter Chart',
        icon: 'scatter-chart',
        description: 'Individual data points'
    },
    {
        type: VisualizationType.BubbleChart,
        label: 'Bubble Chart',
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
    [VisualizationType.BarChart]: 'Bar Chart',
    [VisualizationType.LineChart]: 'Line Chart',
    [VisualizationType.AreaChart]: 'Area Chart',
    [VisualizationType.PieChart]: 'Pie Chart',
    [VisualizationType.DoughnutChart]: 'Doughnut Chart',
    [VisualizationType.RadarChart]: 'Radar Chart',
    [VisualizationType.PolarAreaChart]: 'Polar Area Chart',
    [VisualizationType.ScatterChart]: 'Scatter Chart',
    [VisualizationType.BubbleChart]: 'Bubble Chart',
    [VisualizationType.TagCloud]: 'Cloud',
    [VisualizationType.Timeline]: 'Timeline'
}
