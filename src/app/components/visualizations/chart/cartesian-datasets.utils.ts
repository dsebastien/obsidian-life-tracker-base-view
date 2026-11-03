import type { ChartConfig, ChartData, ChartDatasetConfig } from '../../../types'
import { getChartColorScheme, getColorWithAlpha } from '../../../../utils'
import { referenceLineValues, type ReferenceLineSpec } from './reference-lines.utils'
import { planYAxis, yAxisBeginsAtZero, type YAxisPlan } from './y-axis-plan.utils'
import { isolatedPointIndices } from '../../../services/series-gaps.utils'

/**
 * Chart.js datasets and y-axis plan for a line, bar or area chart. Built the
 * same way for the first render and for incremental updates, so both paths
 * always agree. Free of Chart.js itself, so it is testable on its own.
 */

/**
 * Above this many points per dataset, scatter charts shrink their dots (issue
 * #104). Scatter marks cannot be hidden: they *are* the data.
 */
export const DENSE_SERIES_POINT_THRESHOLD = 500

/**
 * Above this many points per dataset, line and area charts stop drawing point
 * markers (3.4.0; was 500, issue #104). 170 running sessions drew 170
 * overlapping dots that hid the line itself; the line carries the shape, and
 * a point still shows on hover. No data is dropped — every point is still
 * plotted and still hoverable through `pointHitRadius`.
 *
 * Chart.js' own decimation plugin cannot help here: it requires a `linear` or
 * `time` x scale with `parsing: false`, and most of these charts use a
 * category scale built from formatted period labels.
 */
export const POINT_MARKER_THRESHOLD = 40

/**
 * Point styling for a line/area dataset. Above the threshold the markers are
 * hidden but stay reachable: a hover radius shows the point under the cursor
 * and a generous hit radius keeps tooltips easy to trigger.
 */
export function densePointStyle(data: readonly (number | null)[]): {
    pointRadius?: number
    pointHoverRadius?: number
    pointHitRadius?: number
} {
    const pointCount = data.filter((value) => value !== null).length
    if (pointCount <= POINT_MARKER_THRESHOLD) {
        return {}
    }
    return { pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 8 }
}

/** Line width of the moving average when it is the main line */
export const MOVING_AVERAGE_LINE_WIDTH = 2.5

/** Opacity of the raw series drawn behind a moving average */
export const RAW_SERIES_ALPHA = 0.35

/**
 * Marker radius of a point no line reaches (issue #185): with markers hidden
 * above 40 points, a point alone between two gaps would not be drawn at all
 */
export const ISOLATED_POINT_RADIUS = 3

/**
 * Give the isolated points of a line a visible marker when its markers are
 * hidden (radius 0): a per-point radius, 0 everywhere else. A dataset that
 * already shows its points is left as is.
 */
function showIsolatedPoints(
    dataset: ChartDatasetConfig,
    breaks: readonly boolean[] | undefined
): void {
    if (dataset.pointRadius !== 0) return
    const data = dataset.data as (number | null)[]
    const isolated = isolatedPointIndices(data, breaks)
    if (isolated.length === 0) return
    const radius = new Array<number>(data.length).fill(0)
    for (const index of isolated) radius[index] = ISOLATED_POINT_RADIUS
    dataset.pointRadius = radius
}

/** Marker radius of a value drawn at the axis edge: always visible */
export const OUTLIER_MARKER_RADIUS = 6

/** Options that depend on how the data was aggregated, not on the card config */
export interface CartesianModelOptions {
    /** 0/1 presence datasets from a list property: never outlier-fitted */
    listData?: boolean
    /** Checkbox (boolean) values, averaged or summed per period: never outlier-fitted */
    booleanData?: boolean
}

/** Whether a Chart.js dataset is an outlier marker dataset */
export function isOutlierMarkerDataset(dataset: unknown): boolean {
    return (
        typeof dataset === 'object' &&
        dataset !== null &&
        typeof (dataset as { ltOutlierMarkerFor?: unknown }).ltOutlierMarkerFor === 'number'
    )
}

/** Everything the cartesian chart needs to draw one state of its data */
export interface CartesianModel {
    /**
     * Chart.js datasets: `chartData.datasets` in order, then one outlier
     * marker dataset per series with values drawn at the axis edge
     */
    datasets: ChartDatasetConfig[]
    /** Range, step and plotted values of the y-axis */
    yPlan: YAxisPlan
    /** Whether the y-axis includes 0 */
    beginAtZero: boolean
}

/**
 * Build the datasets and y-axis plan of a cartesian chart.
 */
export function buildCartesianModel(
    chartData: ChartData,
    chartConfig: ChartConfig,
    referenceLines: ReferenceLineSpec[] | undefined,
    options: CartesianModelOptions = {}
): CartesianModel {
    const colors = getChartColorScheme(chartConfig.colorScheme)
    // Use fill property from config (area charts have fill: true, line charts have fill: false)
    const shouldFill = chartConfig.fill ?? false
    const isBar = chartConfig.chartType === 'bar'

    const beginAtZero = yAxisBeginsAtZero(
        chartConfig.chartType,
        chartConfig.valueFormat,
        chartConfig.scale
    )

    const yPlan = planYAxis({
        series: chartData.datasets.map((dataset) => ({
            data: dataset.data,
            includeInRange: !dataset.isMovingAverage,
            // A cumulative series carries one jump into every later point, and
            // 0/1 presence has nothing to fit: only real values are fitted
            fitToBulk:
                !dataset.isMovingAverage &&
                !chartConfig.runningTotal &&
                !options.listData &&
                !options.booleanData &&
                !dataset.isBoolean
        })),
        referenceValues: referenceLineValues(referenceLines, chartData.labels.length),
        scale: chartConfig.scale,
        beginAtZero,
        valueFormat: chartConfig.valueFormat,
        outlierMode: chartConfig.outliers
    })

    // With a moving average on (issue #101), the average becomes the main line
    // and the raw series a faded line behind it (3.4.0): noisy per-session
    // values hid the trend the average exists to show
    const hasMovingAverage = chartData.datasets.some((dataset) => dataset.isMovingAverage)

    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = colors[index % colors.length]!
        const data = yPlan.data[index] ?? dataset.data

        // The synthetic moving-average dataset reuses its source dataset's
        // color, solid and thicker, drawn on top and listed first in the
        // legend and the tooltip (`order`)
        if (dataset.isMovingAverage) {
            const sourceColor = colors[0]!
            return {
                label: dataset.label,
                data,
                backgroundColor: sourceColor,
                borderColor: sourceColor,
                borderWidth: MOVING_AVERAGE_LINE_WIDTH,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHitRadius: 8,
                tension: chartConfig.tension,
                fill: false,
                order: 0
            }
        }

        if (hasMovingAverage) {
            // The raw series behind the average: thin, faded, no fill, small
            // faded points while there are few enough to show
            const faded = getColorWithAlpha(color, RAW_SERIES_ALPHA)
            const dense = densePointStyle(data)
            return {
                label: dataset.label,
                data,
                backgroundColor: faded,
                borderColor: faded,
                borderWidth: 1,
                tension: chartConfig.tension,
                fill: false,
                pointRadius: dense.pointRadius ?? 2,
                pointHoverRadius: 4,
                pointHitRadius: dense.pointHitRadius ?? 4,
                pointBackgroundColor: faded,
                pointBorderColor: faded,
                order: 1
            }
        }

        return {
            label: dataset.label,
            data,
            backgroundColor: isBar ? getColorWithAlpha(color, 0.7) : getColorWithAlpha(color, 0.3),
            borderColor: color,
            borderWidth: 2,
            tension: chartConfig.tension,
            fill: shouldFill,
            // Bars have no point markers to hide (issue #104)
            ...(isBar ? {} : densePointStyle(data))
        }
    })

    // A point that gap breaks leave without a line must still be drawn
    // (issue #185), on the raw series and on the moving average alike
    if (!isBar) {
        for (const dataset of datasets) showIsolatedPoints(dataset, chartData.gapBreaks)
    }

    // Values drawn at the axis edge get a triangle marker pointing the way
    // the real value lies (3.4.0). A separate line dataset without a line, so
    // it works on bar charts too and never alters the series' own styling
    yPlan.clamped.forEach((points, index) => {
        if (points.length === 0) return
        const color = colors[index % colors.length]!
        const source = datasets[index]
        const length = source?.data.length ?? 0
        const markerData: (number | null)[] = new Array<number | null>(length).fill(null)
        const rotation: number[] = new Array<number>(length).fill(0)
        for (const point of points) {
            markerData[point.index] = yPlan.data[index]?.[point.index] ?? null
            rotation[point.index] = point.side === 'above' ? 0 : 180
        }
        datasets.push({
            type: 'line',
            label: `${source?.label ?? ''} (outside the scale)`,
            data: markerData,
            showLine: false,
            fill: false,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            pointStyle: 'triangle',
            pointRotation: rotation,
            pointRadius: OUTLIER_MARKER_RADIUS,
            pointHoverRadius: OUTLIER_MARKER_RADIUS + 2,
            pointHitRadius: OUTLIER_MARKER_RADIUS,
            pointBackgroundColor: color,
            pointBorderColor: color,
            // Drawn on top of every series, and whole: a marker centered on
            // the axis edge would otherwise lose its outer half to clipping
            order: -1,
            clip: false,
            ltOutlierMarkerFor: index
        })
    })

    // A time-proportional axis (date-per-note, 3.4.0) places each point at its
    // own timestamp: Chart.js reads `{ x, y }` points on a linear x scale
    const xValues = chartData.xValues
    if (xValues) {
        for (const dataset of datasets) {
            dataset.data = (dataset.data as (number | null)[]).map((y, i) => ({
                x: xValues[i] ?? 0,
                y
            }))
        }
    }

    return { datasets, yPlan, beginAtZero }
}

/**
 * Dataset options that follow the data, so an incremental update must copy
 * them along with it: marker positions and directions shift with the clamped
 * points, and the 40-point marker rule flips as notes are added or removed.
 */
const DATA_DEPENDENT_KEYS = [
    'data',
    'label',
    'pointRotation',
    'pointRadius',
    'pointHoverRadius',
    'pointHitRadius'
] as const

/**
 * Copy the data-dependent options of a freshly built dataset onto the one the
 * chart already shows. An option the new dataset leaves unset is removed, so
 * Chart.js falls back to its default (markers come back below 40 points).
 */
export function syncDatasetFromModel(target: object, source: ChartDatasetConfig): void {
    const writable = target as Record<string, unknown>
    for (const key of DATA_DEPENDENT_KEYS) {
        const value = source[key]
        if (value === undefined) {
            delete writable[key]
        } else {
            writable[key] = value
        }
    }
}

/**
 * Datasets a legend click on `index` shows or hides: the series and its
 * outlier markers, which would otherwise linger over a hidden series
 */
export function datasetsToggledWith(datasets: readonly unknown[], index: number): number[] {
    const indices = [index]
    datasets.forEach((dataset, i) => {
        if (
            isOutlierMarkerDataset(dataset) &&
            (dataset as { ltOutlierMarkerFor?: number }).ltOutlierMarkerFor === index
        ) {
            indices.push(i)
        }
    })
    return indices
}
