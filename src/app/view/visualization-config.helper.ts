import type { ColumnVisualizationConfig } from '../types/column-config.types'
import type {
    ChartConfig,
    HeatmapConfig,
    TagCloudConfig,
    VisualizationConfig
} from '../types/visualization.types'
import { TimeGranularity } from '../domain/time-granularity.enum'
import { VisualizationType } from '../domain/visualization-type.enum'
import { HEATMAP_PRESETS } from '../../utils/color-utils'
import { DEFAULT_CELL_SIZE, DEFAULT_EMBEDDED_HEIGHT } from './view-options'

/**
 * Configuration getter function type
 */
export type ConfigGetter = (key: string) => unknown

/**
 * Get visualization configuration from view config
 */
export function getVisualizationConfig(
    vizType: VisualizationType,
    columnConfig: ColumnVisualizationConfig,
    getConfig: ConfigGetter
): VisualizationConfig {
    const granularity = (getConfig('granularity') as TimeGranularity) ?? TimeGranularity.Daily
    const showEmptyDates = (getConfig('showEmptyDates') as boolean) ?? true
    const embeddedHeight = (getConfig('embeddedHeight') as number) ?? DEFAULT_EMBEDDED_HEIGHT

    const baseConfig: VisualizationConfig = {
        granularity,
        showEmptyDates,
        embeddedHeight
    }

    // Extract scale from column config if present
    const scale = columnConfig.scale

    switch (vizType) {
        case VisualizationType.Heatmap: {
            const colorSchemeName = (getConfig('heatmapColorScheme') as string) ?? 'green'
            const colorScheme = HEATMAP_PRESETS[colorSchemeName] ?? HEATMAP_PRESETS['green']!

            return {
                ...baseConfig,
                colorScheme,
                cellSize: (getConfig('heatmapCellSize') as number) ?? DEFAULT_CELL_SIZE,
                cellGap: 2,
                showMonthLabels: (getConfig('heatmapShowMonthLabels') as boolean) ?? true,
                showDayLabels: (getConfig('heatmapShowDayLabels') as boolean) ?? true,
                scale
            } as HeatmapConfig
        }

        case VisualizationType.LineChart:
        case VisualizationType.BarChart:
        case VisualizationType.AreaChart:
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
                scale
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
