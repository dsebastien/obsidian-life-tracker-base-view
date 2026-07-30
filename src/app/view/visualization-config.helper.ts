import {
    TimeGranularity,
    TIME_GRANULARITY_OPTIONS,
    CHART_LEGEND_POSITIONS,
    VisualizationType,
    type ColumnVisualizationConfig,
    type ChartConfig,
    type HeatmapConfig,
    type TagCloudConfig,
    type TimelineConfig,
    type VisualizationConfig,
    type ConfigGetter,
    type PropertyDefinition
} from '../types'
import {
    HEATMAP_PRESETS,
    asChartColorScheme,
    normalizeHeatmapColorScheme,
    polarityHeatmapPreset
} from '../../utils'
import { DEFAULT_CELL_SIZE, DEFAULT_EMBEDDED_HEIGHT } from './view-options'
import { getBoolConfig, getEnumConfig, getNumberConfig, getStringConfig } from './config-accessors'

/**
 * Get visualization configuration from view config
 */
export function getVisualizationConfig(
    vizType: VisualizationType,
    columnConfig: ColumnVisualizationConfig,
    getConfig: ConfigGetter,
    /**
     * Definition of the visualized property, when it has one. Carries the
     * polarity (issue #21) and emoji mapping (issue #22), which are per
     * property rather than per view.
     */
    definition?: PropertyDefinition | null
): VisualizationConfig {
    const granularity =
        getEnumConfig(getConfig, 'granularity', TIME_GRANULARITY_OPTIONS) ?? TimeGranularity.Daily
    const showEmptyValues = getBoolConfig(getConfig, 'showEmptyValues') ?? false
    const embeddedHeight = getNumberConfig(getConfig, 'embeddedHeight') ?? DEFAULT_EMBEDDED_HEIGHT

    const baseConfig: VisualizationConfig = {
        granularity,
        showEmptyValues,
        embeddedHeight,
        polarity: definition?.polarity,
        valueEmojis: definition?.valueEmojis ?? null
    }

    // Extract scale, color scheme, reference line, and aggregation method from column config if present
    const scale = columnConfig.scale
    const storedColorScheme = columnConfig.colorScheme
    // Charts only understand preset names: an inline heatmap scheme (issue #82)
    // or a heatmap-only preset name must not leak into a ChartConfig
    const colorScheme = asChartColorScheme(storedColorScheme)
    const referenceLine = columnConfig.referenceLine
    const aggregationMethod = columnConfig.aggregationMethod
    const movingAveragePeriod = columnConfig.movingAveragePeriod

    switch (vizType) {
        case VisualizationType.Heatmap: {
            // A per-viz custom mapping wins outright; otherwise resolve a preset
            // name, per-viz first and the view-wide setting as fallback (#82)
            const customScheme = normalizeHeatmapColorScheme(storedColorScheme)
            // Polarity only supplies a *default* (issue #21): green when more is
            // better, red when more is worse. Anything the user picked — per
            // card or view-wide — still wins.
            const colorSchemeName =
                (typeof storedColorScheme === 'string' ? storedColorScheme : undefined) ??
                getStringConfig(getConfig, 'heatmapColorScheme') ??
                polarityHeatmapPreset(definition?.polarity) ??
                'green'
            const heatmapColorScheme =
                customScheme ?? HEATMAP_PRESETS[colorSchemeName] ?? HEATMAP_PRESETS['green']!

            // Per-viz overrides for heatmap settings
            const cellSize =
                columnConfig.heatmapCellSize ??
                getNumberConfig(getConfig, 'heatmapCellSize') ??
                DEFAULT_CELL_SIZE
            const showMonthLabels =
                columnConfig.heatmapShowMonthLabels ??
                getBoolConfig(getConfig, 'heatmapShowMonthLabels') ??
                true
            const showDayLabels =
                columnConfig.heatmapShowDayLabels ??
                getBoolConfig(getConfig, 'heatmapShowDayLabels') ??
                true

            return {
                ...baseConfig,
                colorScheme: heatmapColorScheme,
                cellSize,
                cellGap: 2,
                showMonthLabels,
                showDayLabels,
                showStreakInfo: getBoolConfig(getConfig, 'heatmapShowStreaks') ?? true,
                scale,
                aggregationMethod
            } as HeatmapConfig
        }

        case VisualizationType.LineChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: getBoolConfig(getConfig, 'chartShowLegend') ?? false,
                showGrid: getBoolConfig(getConfig, 'chartShowGrid') ?? true,
                tension: 0.3,
                fill: false, // Line charts don't have fill
                scale,
                colorScheme,
                referenceLine,
                aggregationMethod,
                movingAveragePeriod,
                showTrendInfo: getBoolConfig(getConfig, 'chartShowTrend') ?? true
            } as ChartConfig

        case VisualizationType.AreaChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: getBoolConfig(getConfig, 'chartShowLegend') ?? false,
                showGrid: getBoolConfig(getConfig, 'chartShowGrid') ?? true,
                tension: 0.3,
                fill: true, // Area charts have fill
                scale,
                colorScheme,
                referenceLine,
                aggregationMethod,
                movingAveragePeriod,
                showTrendInfo: getBoolConfig(getConfig, 'chartShowTrend') ?? true
            } as ChartConfig

        case VisualizationType.BarChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: getBoolConfig(getConfig, 'chartShowLegend') ?? false,
                showGrid: getBoolConfig(getConfig, 'chartShowGrid') ?? true,
                tension: 0.3,
                scale,
                colorScheme,
                referenceLine,
                aggregationMethod,
                showTrendInfo: getBoolConfig(getConfig, 'chartShowTrend') ?? true
            } as ChartConfig

        case VisualizationType.PieChart:
        case VisualizationType.DoughnutChart:
        case VisualizationType.RadarChart:
        case VisualizationType.PolarAreaChart:
        case VisualizationType.ScatterChart:
        case VisualizationType.BubbleChart:
            return {
                ...baseConfig,
                chartType: mapVisualizationTypeToChartType(vizType),
                showLegend: getBoolConfig(getConfig, 'chartShowLegend') ?? false,
                showGrid: getBoolConfig(getConfig, 'chartShowGrid') ?? true,
                tension: 0.3,
                scale,
                colorScheme,
                aggregationMethod,
                legendPosition:
                    getEnumConfig(getConfig, 'chartLegendPosition', CHART_LEGEND_POSITIONS) ??
                    'right'
            } as ChartConfig

        case VisualizationType.TagCloud:
            return {
                ...baseConfig,
                minFontSize: 12,
                maxFontSize: 32,
                sortBy:
                    getEnumConfig(getConfig, 'tagCloudSortBy', ['frequency', 'alphabetical']) ??
                    'frequency',
                maxTags: getNumberConfig(getConfig, 'tagCloudMaxTags') ?? 50
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
