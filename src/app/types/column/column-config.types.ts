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
 * Map of property IDs to their visualization configs (supports multiple per property)
 * Stored in view config to persist across sessions
 */
export type ColumnConfigMap = Record<BasesPropertyId, ColumnVisualizationConfig[]>

/**
 * Legacy format for migration (single config per property)
 * @deprecated Used only for migrating old config format
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
