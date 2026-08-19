import type { BasesPropertyId } from 'obsidian'
import type { TimeGranularity } from './time-granularity.intf'
import type { ResolvedDateAnchor } from '../view/date-anchor.types'
import type {
    ScaleConfig,
    ReferenceLineConfig,
    AggregationMethod,
    TargetConfig,
    XAxisSource
} from '../column/column-config.types'
import type { ChartColorScheme } from '../../../utils/color.utils'
import type { EmojiMapping, ValuePolarity } from '../property/property-definition.types'

/**
 * A single data point for visualization.
 * All data is pre-extracted and cleaned - no raw Obsidian values or entries.
 */
export interface VisualizationDataPoint {
    /** File path for navigation (to open the source file) */
    filePath: string
    /** Resolved date anchor (null if no date could be determined) */
    dateAnchor: ResolvedDateAnchor | null
    /** Extracted numeric value (null if not numeric or empty) */
    numericValue: number | null
    /** Extracted boolean value (null if not a boolean) */
    booleanValue: boolean | null
    /** Extracted display label (null if empty/no data) */
    displayLabel: string | null
    /** Extracted list/tag values for tag cloud visualization (empty array if not a list) */
    listValues: string[]
}

/**
 * Direction and magnitude of the recent trend in a chart's data,
 * comparing the last N periods against the previous N (issue #101)
 */
export interface TrendInfo {
    direction: 'up' | 'down' | 'flat'
    changePercent: number
    /** Number of periods in each compared window */
    periodCount: number
}

/**
 * Tabular representation of what a visualization currently displays,
 * used for CSV export (issue #102)
 */
export interface ExportTable {
    headers: string[]
    rows: (string | number | null)[][]
}

/**
 * A closed date span. Used to tell a visualization which period the view is
 * showing, independently of which dates actually carry a value (issue #153).
 */
export interface VisualizationDateRange {
    minDate: Date
    maxDate: Date
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
    streaks: StreakStats
}

/**
 * Streak statistics over a run of periods (issue #100).
 * Periods follow the visualization's granularity (days, weeks, ...).
 */
export interface StreakStats {
    /** Consecutive active periods reaching the present (0 if the run is broken) */
    currentStreak: number
    /** Longest run of consecutive active periods */
    longestStreak: number
    /** Total number of active periods */
    activeCount: number
}

/**
 * Single cell in a heatmap
 */
export interface HeatmapCell {
    date: Date
    value: number | null
    count: number
    filePaths: string[]
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
    filePaths: string[][]
    /** Property ID this dataset represents (used in overlay charts for click handling) */
    propertyId?: BasesPropertyId
    /** Marks the synthetic moving-average dataset (dashed styling, issue #101) */
    isMovingAverage?: boolean
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
    filePaths: string[][]
    /** Whether the data represents boolean values (for color coding) */
    isBooleanData: boolean
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
    /** Exact number of entries in this bubble's period (radius is lossy) */
    count: number
}

/**
 * Aggregated data for scatter chart visualization
 * Shows correlation between time (x) and value (y)
 */
export interface ScatterChartData {
    propertyId: BasesPropertyId
    displayName: string
    points: ScatterPoint[]
    filePaths: string[]
}

/**
 * Aggregated data for bubble chart visualization
 * Shows time (x), value (y), and count (r)
 */
export interface BubbleChartData {
    propertyId: BasesPropertyId
    displayName: string
    points: BubblePoint[]
    filePaths: string[][]
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
    filePaths: string[]
}

/**
 * How a period compares to its target (issue #126).
 *
 * `no-data` is distinct from `behind`: for an average or a latest reading, a
 * period with nothing recorded is unknown, not zero. Treating it as zero would
 * make an at-most target ("at most 80 kg") read as met in every week you
 * forgot to weigh yourself.
 */
export type ProgressStatus = 'met' | 'close' | 'behind' | 'no-data'

/**
 * One period measured against a target
 */
export interface ProgressPeriod {
    /** Start of the period */
    date: Date
    /** The period's value, folded according to the target's metric */
    actual: number
    /** Whether the target was met */
    met: boolean
    /** Whether the period recorded any value at all */
    hasData: boolean
    status: ProgressStatus
    /** `actual` as a fraction of the target, clamped to 0-1 */
    ratio: number
    /** Notes that contributed to this period */
    filePaths: string[]
}

/**
 * Aggregated data for the progress ring visualization (issues #6, #126)
 */
export interface ProgressData {
    propertyId: BasesPropertyId
    displayName: string
    target: TargetConfig
    /** Every period in range, ascending */
    periods: ProgressPeriod[]
    /** The period the ring shows: the one the view's last day falls in */
    current: ProgressPeriod | null
    /** How many periods met the target */
    metCount: number
    /** How many periods the range covers */
    periodCount: number
    /** Streaks of periods that met the target */
    streaks: StreakStats
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
    value: number | null
    filePaths: string[]
}

/**
 * Heatmap color scheme that shades a single hue by intensity: values are
 * bucketed into 5 levels against the cell min/max and looked up in `levels`.
 */
export interface GradientHeatmapColorScheme {
    kind: 'gradient'
    empty: string
    levels: [string, string, string, string, string]
}

/**
 * Heatmap color scheme that maps specific values to specific colors (issue #82).
 * Fits categorical-feeling numeric data such as mood scores, where each value
 * deserves its own hue rather than a shade of the same one.
 */
export interface DiscreteHeatmapColorScheme {
    kind: 'discrete'
    empty: string
    /** Map of stringified value → color. Numeric values become "1", "2", ... */
    mapping: Record<string, string>
    /** Color for values with no entry in `mapping`. Defaults to `empty`. */
    fallback?: string
}

/**
 * Heatmap color scheme configuration: either an intensity gradient or an
 * explicit value → color mapping.
 */
export type HeatmapColorScheme = GradientHeatmapColorScheme | DiscreteHeatmapColorScheme

/**
 * Configuration for visualization rendering
 */
export interface VisualizationConfig {
    granularity: TimeGranularity
    /** Show empty values: includes dates with no entries AND dates where property value is null/empty */
    showEmptyValues: boolean
    embeddedHeight: number
    /**
     * Whether high values are good or bad for the visualized property, taken
     * from its definition (issue #21). Absent is read as neutral.
     */
    polarity?: ValuePolarity
    /** Value/range → emoji map from the property definition (issue #22) */
    valueEmojis?: EmojiMapping | null
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
    /** Show the streak stats row below the legend (default true) */
    showStreakInfo?: boolean
    /** Optional scale configuration for value normalization */
    scale?: ScaleConfig
    /** How to combine multiple values within a cell's time period (issue #98) */
    aggregationMethod?: AggregationMethod
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
    /** Color scheme for chart colors */
    colorScheme?: ChartColorScheme
    /**
     * The heatmap's value → color scheme for the same property, so
     * pie/doughnut/polarArea segments over numeric values can match the
     * heatmap's colors (issue #150). Only honored when no explicit chart
     * color scheme is chosen.
     */
    valueColorScheme?: HeatmapColorScheme
    /** Reference line configuration for cartesian charts */
    referenceLine?: ReferenceLineConfig
    /** How to combine multiple values within a time period (cartesian/bubble charts) */
    aggregationMethod?: AggregationMethod
    /** Rolling mean window for line/area charts; undefined = off (issue #101) */
    movingAveragePeriod?: number
    /** Plot the cumulative total instead of the per-period value (issue #142) */
    runningTotal?: boolean
    /** What the x-axis plots: time periods (default) or one point per note (issue #69) */
    xAxisSource?: XAxisSource
    /** Show the trend arrow and trend row (default true) */
    showTrendInfo?: boolean
    /** Legend placement for pie/doughnut/polar charts (default 'right') */
    legendPosition?: ChartLegendPosition
    /** Goal target, drawn as a reference line on cartesian charts (issue #6) */
    target?: TargetConfig
}

/**
 * Legend placement options for charts.
 */
export type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'left'

/** All legend placement values, for runtime validation of stored config. */
export const CHART_LEGEND_POSITIONS: readonly ChartLegendPosition[] = [
    'top',
    'right',
    'bottom',
    'left'
]

/**
 * Tag cloud-specific configuration
 */
export interface TagCloudConfig extends VisualizationConfig {
    minFontSize: number
    maxFontSize: number
    sortBy: 'frequency' | 'alphabetical'
    maxTags: number
}

/**
 * Progress ring configuration (issue #126).
 *
 * The target is optional so the card can render a "configure a target" prompt
 * instead of failing when the type is chosen before the goal is set.
 */
export interface ProgressConfig extends VisualizationConfig {
    target?: TargetConfig
    /** Show the hit rate across the selected range below the ring (default true) */
    showHitRate?: boolean
}

/**
 * Timeline-specific configuration
 */
export interface TimelineConfig extends VisualizationConfig {
    /** Color scheme for timeline points */
    colorScheme?: ChartColorScheme
}
