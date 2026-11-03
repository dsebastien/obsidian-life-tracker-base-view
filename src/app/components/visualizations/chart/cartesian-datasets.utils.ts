import type { ChartConfig, ChartData, ChartDatasetConfig } from '../../../types'
import { getChartColorScheme, getColorWithAlpha } from '../../../../utils'
import { referenceLineValues, type ReferenceLineSpec } from './reference-lines.utils'
import { planYAxis, yAxisBeginsAtZero, type YAxisPlan } from './y-axis-plan.utils'

/**
 * Chart.js datasets and y-axis plan for a line, bar or area chart. Built the
 * same way for the first render and for incremental updates, so both paths
 * always agree. Free of Chart.js itself, so it is testable on its own.
 */

/**
 * Above this many points per dataset, line/area charts stop drawing point
 * markers (issue #104). Multi-year daily vaults plot thousands of points; the
 * markers dominate both draw time and visual noise, while the line itself stays
 * cheap. No data is dropped — every point is still plotted and still
 * hoverable through `pointHitRadius`.
 *
 * Chart.js' own decimation plugin cannot help here: it requires a `linear` or
 * `time` x scale with `parsing: false`, and these charts use a category scale
 * built from formatted period labels.
 */
export const DENSE_SERIES_POINT_THRESHOLD = 500

/**
 * Point styling for a dataset of `pointCount` values. Dense series hide their
 * markers but keep a generous hit radius so tooltips still work.
 */
export function densePointStyle(pointCount: number): {
    pointRadius?: number
    pointHoverRadius?: number
    pointHitRadius?: number
} {
    if (pointCount <= DENSE_SERIES_POINT_THRESHOLD) {
        return {}
    }
    return { pointRadius: 0, pointHoverRadius: 4, pointHitRadius: 8 }
}

/** Marker radius of a value drawn at the axis edge: always visible */
export const OUTLIER_MARKER_RADIUS = 6

/** Options that depend on how the data was aggregated, not on the card config */
export interface CartesianModelOptions {
    /** 0/1 presence datasets from a list property: never outlier-fitted */
    listData?: boolean
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
            fitToBulk: !dataset.isMovingAverage && !chartConfig.runningTotal && !options.listData
        })),
        referenceValues: referenceLineValues(referenceLines, chartData.labels.length),
        scale: chartConfig.scale,
        beginAtZero,
        valueFormat: chartConfig.valueFormat,
        outlierMode: chartConfig.outliers
    })

    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = colors[index % colors.length]!
        const data = yPlan.data[index] ?? dataset.data

        // The synthetic moving-average dataset (issue #101) reuses its
        // source dataset's color but renders as a thin dashed line without
        // points or fill, so it reads as an annotation rather than data
        if (dataset.isMovingAverage) {
            const sourceColor = colors[0]!
            return {
                label: dataset.label,
                data,
                backgroundColor: 'transparent',
                borderColor: getColorWithAlpha(sourceColor, 0.7),
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                tension: chartConfig.tension,
                fill: false
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
            ...(isBar ? {} : densePointStyle(data.length))
        }
    })

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

    return { datasets, yPlan, beginAtZero }
}
