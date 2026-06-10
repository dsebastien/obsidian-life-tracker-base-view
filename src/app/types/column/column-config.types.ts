import type { BasesPropertyId } from 'obsidian'
import { VisualizationType } from '../visualization/visualization-type.intf'
import type { ChartColorScheme } from '../../../utils/color.utils'

/**
 * Scale configuration for numeric visualizations
 */
export interface ScaleConfig {
    /** Minimum value for the scale (null = auto-detect from data) */
    min: number | null
    /** Maximum value for the scale (null = auto-detect from data) */
    max: number | null
}

/**
 * Reference line configuration for cartesian charts
 * Displays a horizontal line at a specific Y-axis value (e.g., target/goal)
 */
export interface ReferenceLineConfig {
    /** Whether the reference line is enabled */
    enabled: boolean
    /** The Y-axis value where the line should be drawn */
    value: number
    /** Optional custom label (defaults to "Target: {value}") */
    label?: string
}

/**
 * How multiple data points in the same time period are combined into a single value.
 * - 'average': arithmetic mean (default — preserves previous behavior)
 * - 'sum': add the values together (e.g., total workout calories across multiple sessions per day)
 */
export type AggregationMethod = 'average' | 'sum'

/**
 * Default aggregation method when none is configured.
 */
export const DEFAULT_AGGREGATION_METHOD: AggregationMethod = 'average'

/**
 * Configuration for a single visualization
 */
export interface ColumnVisualizationConfig {
    /** Unique visualization ID (for multiple visualizations per property) */
    id: string
    /** The property ID this config applies to */
    propertyId: BasesPropertyId
    /** User-selected visualization type */
    visualizationType: VisualizationType
    /** Display name (cached from when configured) */
    displayName: string
    /** Timestamp when configured */
    configuredAt: number
    /** Scale configuration for numeric visualizations (Heatmap, BarChart, LineChart) */
    scale?: ScaleConfig
    /** Color scheme for chart visualizations */
    colorScheme?: ChartColorScheme
    /** Heatmap cell size override (pixels) */
    heatmapCellSize?: number
    /** Heatmap show month labels override */
    heatmapShowMonthLabels?: boolean
    /** Heatmap show day labels override */
    heatmapShowDayLabels?: boolean
    /** Reference line configuration for cartesian charts */
    referenceLine?: ReferenceLineConfig
    /** How to combine multiple values within a time period (cartesian/bubble charts) */
    aggregationMethod?: AggregationMethod
    /** Rolling mean window for line/area charts; undefined = off (issue #101) */
    movingAveragePeriod?: number
}

/**
 * Visualization types that support scale configuration
 */
export const SCALE_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.Heatmap,
    VisualizationType.BarChart,
    VisualizationType.LineChart,
    VisualizationType.AreaChart,
    VisualizationType.RadarChart,
    VisualizationType.ScatterChart,
    VisualizationType.BubbleChart
]

/**
 * Check if a visualization type supports scale configuration
 */
export function supportsScale(vizType: VisualizationType): boolean {
    return SCALE_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Visualization types that support color scheme configuration
 * All chart types plus Heatmap and Timeline. Excludes TagCloud.
 */
export const COLOR_SCHEME_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.Heatmap,
    VisualizationType.BarChart,
    VisualizationType.LineChart,
    VisualizationType.AreaChart,
    VisualizationType.PieChart,
    VisualizationType.DoughnutChart,
    VisualizationType.RadarChart,
    VisualizationType.PolarAreaChart,
    VisualizationType.ScatterChart,
    VisualizationType.BubbleChart,
    VisualizationType.Timeline
]

/**
 * Check if a visualization type supports color scheme configuration
 */
export function supportsColorScheme(vizType: VisualizationType): boolean {
    return COLOR_SCHEME_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Visualization types that support reference lines (cartesian charts only)
 */
export const REFERENCE_LINE_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.BarChart,
    VisualizationType.AreaChart
]

/**
 * Check if a visualization type supports reference lines
 */
export function supportsReferenceLine(vizType: VisualizationType): boolean {
    return REFERENCE_LINE_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Visualization types that aggregate multiple values per time period and therefore
 * support choosing between average and sum aggregation.
 * Pie/scatter/tag-cloud/timeline either count occurrences or plot raw points, so
 * sum vs average doesn't apply.
 */
export const AGGREGATION_METHOD_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.BarChart,
    VisualizationType.AreaChart,
    VisualizationType.RadarChart,
    VisualizationType.BubbleChart
]

/**
 * Check if a visualization type supports choosing the aggregation method
 */
export function supportsAggregationMethod(vizType: VisualizationType): boolean {
    return AGGREGATION_METHOD_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Visualization types that support a moving-average overlay (issue #101)
 */
export const MOVING_AVERAGE_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.AreaChart
]

/**
 * Check if a visualization type supports a moving-average overlay
 */
export function supportsMovingAverage(vizType: VisualizationType): boolean {
    return MOVING_AVERAGE_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Window sizes offered for the moving average in the UI
 */
export const MOVING_AVERAGE_PERIOD_OPTIONS = [7, 14, 30]

/**
 * Types rendered on a canvas by Chart.js — the only ones that can export an
 * image (issue #102). Heatmap, tag cloud and timeline are DOM-based.
 */
export const IMAGE_EXPORT_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.BarChart,
    VisualizationType.AreaChart,
    VisualizationType.PieChart,
    VisualizationType.DoughnutChart,
    VisualizationType.RadarChart,
    VisualizationType.PolarAreaChart,
    VisualizationType.ScatterChart,
    VisualizationType.BubbleChart
]

/**
 * Check if a visualization type supports exporting a PNG image
 */
export function supportsImageExport(vizType: VisualizationType): boolean {
    return IMAGE_EXPORT_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Map of property IDs to their visualization configs (supports multiple per property)
 * Stored in view config to persist across sessions
 */
export type ColumnConfigMap = Record<BasesPropertyId, ColumnVisualizationConfig[]>

/**
 * Legacy on-disk format from earlier plugin versions: a single visualization config per
 * property, instead of the array-of-configs `ColumnConfigMap` used by the current version.
 *
 * Still consumed by `ColumnConfigService.migrateToArrayFormat` to read configs persisted
 * by older versions and convert them on first load. New writes always use
 * `ColumnConfigMap`, so this type is not "deprecated" — it intentionally describes the V1
 * shape and stays as long as we have to read it from existing vaults.
 */
export type LegacyColumnConfigMap = Record<BasesPropertyId, Omit<ColumnVisualizationConfig, 'id'>>

/**
 * Configuration for an overlay visualization (multiple properties on one chart)
 */
export interface OverlayVisualizationConfig {
    /** Unique visualization ID */
    id: string
    /** Array of property IDs to overlay on the same chart */
    propertyIds: BasesPropertyId[]
    /** Visualization type (only cartesian charts: LineChart, BarChart, AreaChart) */
    visualizationType: VisualizationType
    /** Display name for the overlay card */
    displayName: string
    /** Timestamp when configured */
    configuredAt: number
    /** Scale configuration for Y-axis */
    scale?: ScaleConfig
    /** Color scheme for chart colors */
    colorScheme?: ChartColorScheme
    /** Reference line configurations per property ID (for overlays with multiple properties) */
    referenceLines?: Record<BasesPropertyId, ReferenceLineConfig>
    /** Hide individual visualizations for properties in this overlay (default: false) */
    hideIndividualVisualizations?: boolean
    /** How to combine multiple values within a time period (default: 'average') */
    aggregationMethod?: AggregationMethod
}

/**
 * Map of overlay IDs to their configs
 * Stored in view config to persist across sessions
 */
export type OverlayConfigMap = Record<string, OverlayVisualizationConfig>

/**
 * Visualization types that support overlay mode (multiple properties on one chart)
 * Only cartesian chart types make sense for overlays
 */
export const OVERLAY_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.BarChart,
    VisualizationType.AreaChart
]

/**
 * Check if a visualization type supports overlay mode
 */
export function supportsOverlay(vizType: VisualizationType): boolean {
    return OVERLAY_SUPPORTED_TYPES.includes(vizType)
}

/**
 * Generate a unique visualization ID
 */
export function generateVisualizationId(): string {
    return crypto.randomUUID()
}
