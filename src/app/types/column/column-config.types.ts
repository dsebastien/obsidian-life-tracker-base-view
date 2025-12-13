import type { BasesPropertyId } from 'obsidian'
import { VisualizationType } from '../visualization/visualization-type.intf'

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
 * Configuration for a single column's visualization
 */
export interface ColumnVisualizationConfig {
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
 * Map of property IDs to their visualization configs
 * Stored in view config to persist across sessions
 */
export type ColumnConfigMap = Record<BasesPropertyId, ColumnVisualizationConfig>
