import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { TimeGranularity } from './time-granularity.intf'
import type { ResolvedDateAnchor } from '../view/date-anchor.types'
import type { ScaleConfig } from '../column/column-config.types'

/**
 * A single data point for visualization
 */
export interface VisualizationDataPoint {
    entry: BasesEntry
    dateAnchor: ResolvedDateAnchor | null
    value: unknown
    normalizedValue: number | null
}

/**
 * Aggregated data for heatmap visualization
 */
export interface HeatmapData {
    propertyId: BasesPropertyId
    displayName: string
    granularity: TimeGranularity
    cells: HeatmapCell[]
    minDate: Date
    maxDate: Date
    minValue: number
    maxValue: number
}

/**
 * Single cell in a heatmap
 */
export interface HeatmapCell {
    date: Date
    value: number | null
    count: number
    entries: BasesEntry[]
}

/**
 * Aggregated data for chart visualization
 */
export interface ChartData {
    propertyId: BasesPropertyId
    displayName: string
    labels: string[]
    datasets: ChartDataset[]
}

/**
 * Dataset for chart visualization
 */
export interface ChartDataset {
    label: string
    data: (number | null)[]
    entries: BasesEntry[][]
}

/**
 * Aggregated data for pie/doughnut chart visualization
 * Shows distribution of values
 */
export interface PieChartData {
    propertyId: BasesPropertyId
    displayName: string
    labels: string[]
    values: number[]
    entries: BasesEntry[][]
}

/**
 * Single point for scatter chart
 */
export interface ScatterPoint {
    x: number
    y: number
}

/**
 * Single point for bubble chart (includes radius)
 */
export interface BubblePoint {
    x: number
    y: number
    r: number
}

/**
 * Aggregated data for scatter chart visualization
 * Shows correlation between time (x) and value (y)
 */
export interface ScatterChartData {
    propertyId: BasesPropertyId
    displayName: string
    points: ScatterPoint[]
    entries: BasesEntry[]
}

/**
 * Aggregated data for bubble chart visualization
 * Shows time (x), value (y), and count (r)
 */
export interface BubbleChartData {
    propertyId: BasesPropertyId
    displayName: string
    points: BubblePoint[]
    entries: BasesEntry[][]
}

/**
 * Aggregated data for tag cloud visualization
 */
export interface TagCloudData {
    propertyId: BasesPropertyId
    displayName: string
    tags: TagCloudItem[]
    maxFrequency: number
}

/**
 * Single tag item in tag cloud
 */
export interface TagCloudItem {
    tag: string
    frequency: number
    entries: BasesEntry[]
}

/**
 * Aggregated data for timeline visualization
 */
export interface TimelineData {
    propertyId: BasesPropertyId
    displayName: string
    points: TimelinePoint[]
    minDate: Date
    maxDate: Date
}

/**
 * Single point on timeline
 */
export interface TimelinePoint {
    date: Date
    label: string
    entries: BasesEntry[]
}

/**
 * Heatmap color scheme configuration
 */
export interface HeatmapColorScheme {
    empty: string
    levels: [string, string, string, string, string]
}

/**
 * Configuration for visualization rendering
 */
export interface VisualizationConfig {
    granularity: TimeGranularity
    /** Show empty values: includes dates with no entries AND dates where property value is null/empty */
    showEmptyValues: boolean
    embeddedHeight: number
}

/**
 * Heatmap-specific configuration
 */
export interface HeatmapConfig extends VisualizationConfig {
    colorScheme: HeatmapColorScheme
    cellSize: number
    cellGap: number
    showMonthLabels: boolean
    showDayLabels: boolean
    /** Optional scale configuration for value normalization */
    scale?: ScaleConfig
}

/**
 * Supported Chart.js chart types
 */
export type ChartJsType =
    | 'line'
    | 'bar'
    | 'pie'
    | 'doughnut'
    | 'radar'
    | 'polarArea'
    | 'scatter'
    | 'bubble'

/**
 * Chart-specific configuration
 */
export interface ChartConfig extends VisualizationConfig {
    chartType: ChartJsType
    showLegend: boolean
    showGrid: boolean
    tension: number
    /** Whether to fill area under line (for line/area charts) */
    fill?: boolean
    /** Optional scale configuration for Y-axis */
    scale?: ScaleConfig
    /** For pie/doughnut: whether to aggregate by value distribution */
    aggregateByValue?: boolean
}

/**
 * Tag cloud-specific configuration
 */
export interface TagCloudConfig extends VisualizationConfig {
    minFontSize: number
    maxFontSize: number
    sortBy: 'frequency' | 'alphabetical'
    maxTags: number
}
