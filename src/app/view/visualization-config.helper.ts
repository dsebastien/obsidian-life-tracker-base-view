import {
    TimeGranularity,
    VisualizationType,
    type ColumnVisualizationConfig,
    type ChartConfig,
    type HeatmapConfig,
    type TagCloudConfig,
    type TimelineConfig,
    type VisualizationConfig,
    type ConfigGetter
} from '../types'
import { HEATMAP_PRESETS } from '../../utils'
import { DEFAULT_CELL_SIZE, DEFAULT_EMBEDDED_HEIGHT } from './view-options'

/**
 * Get visualization configuration from view config
 */
export function getVisualizationConfig(
    vizType: VisualizationType,
    columnConfig: ColumnVisualizationConfig,
    getConfig: ConfigGetter
): VisualizationConfig {
    const granularity = (getConfig('granularity') as TimeGranularity) ?? TimeGranularity.Daily
    const showEmptyValues = (getConfig('showEmptyValues') as boolean) ?? true
    const embeddedHeight = (getConfig('embeddedHeight') as number) ?? DEFAULT_EMBEDDED_HEIGHT

    const baseConfig: VisualizationConfig = {
        granularity,
        showEmptyValues,
        embeddedHeight
    }

    // Extract scale and color scheme from column config if present
    const scale = columnConfig.scale
    const colorScheme = columnConfig.colorScheme

    switch (vizType) {
        case VisualizationType.Heatmap: {
            // Use per-visualization color scheme if set, otherwise fall back to global setting
            const colorSchemeName =
                colorScheme ?? (getConfig('heatmapColorScheme') as string) ?? 'green'
            const heatmapColorScheme = HEATMAP_PRESETS[colorSchemeName] ?? HEATMAP_PRESETS['green']!

            return {
                ...baseConfig,
                colorScheme: heatmapColorScheme,
                cellSize: (getConfig('heatmapCellSize') as number) ?? DEFAULT_CELL_SIZE,
                cellGap: 2,
                showMonthLabels: (getConfig('heatmapShowMonthLabels') as boolean) ?? true,
                showDayLabels: (getConfig('heatmapShowDayLabels') as boolean) ?? true,
                scale
            } as HeatmapConfig
        }

        case VisualizationType.LineChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: (getConfig('chartShowLegend') as boolean) ?? false,
                showGrid: (getConfig('chartShowGrid') as boolean) ?? true,
                tension: 0.3,
                fill: false, // Line charts don't have fill
                scale,
                colorScheme
            } as ChartConfig

        case VisualizationType.AreaChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: (getConfig('chartShowLegend') as boolean) ?? false,
                showGrid: (getConfig('chartShowGrid') as boolean) ?? true,
                tension: 0.3,
                fill: true, // Area charts have fill
                scale,
                colorScheme
            } as ChartConfig

        case VisualizationType.BarChart:
        case VisualizationType.PieChart:
        case VisualizationType.DoughnutChart:
        case VisualizationType.RadarChart:
        case VisualizationType.PolarAreaChart:
        case VisualizationType.ScatterChart:
        case VisualizationType.BubbleChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: (getConfig('chartShowLegend') as boolean) ?? false,
                showGrid: (getConfig('chartShowGrid') as boolean) ?? true,
                tension: 0.3,
                scale,
                colorScheme
            } as ChartConfig

        case VisualizationType.TagCloud:
            return {
                ...baseConfig,
                minFontSize: 12,
                maxFontSize: 32,
                sortBy:
                    (getConfig('tagCloudSortBy') as 'frequency' | 'alphabetical') ?? 'frequency',
                maxTags: (getConfig('tagCloudMaxTags') as number) ?? 50
            } as TagCloudConfig

        case VisualizationType.Timeline:
            return {
                ...baseConfig,
                colorScheme
            } as TimelineConfig

        default:
            return baseConfig
    }
}

/**
 * Map VisualizationType to Chart.js chart type
 */
export function mapVisualizationTypeToChartType(
    vizType: VisualizationType
): 'line' | 'bar' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'scatter' | 'bubble' {
    switch (vizType) {
        case VisualizationType.LineChart:
        case VisualizationType.AreaChart:
            return 'line'
        case VisualizationType.BarChart:
            return 'bar'
        case VisualizationType.PieChart:
            return 'pie'
        case VisualizationType.DoughnutChart:
            return 'doughnut'
        case VisualizationType.RadarChart:
            return 'radar'
        case VisualizationType.PolarAreaChart:
            return 'polarArea'
        case VisualizationType.ScatterChart:
            return 'scatter'
        case VisualizationType.BubbleChart:
            return 'bubble'
        default:
            return 'line'
    }
}
