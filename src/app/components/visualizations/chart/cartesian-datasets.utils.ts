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

/** Everything the cartesian chart needs to draw one state of its data */
export interface CartesianModel {
    /** Chart.js datasets, in the same order as `chartData.datasets` */
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
    referenceLines: ReferenceLineSpec[] | undefined
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
            includeInRange: !dataset.isMovingAverage
        })),
        referenceValues: referenceLineValues(referenceLines, chartData.labels.length),
        scale: chartConfig.scale,
        beginAtZero,
        valueFormat: chartConfig.valueFormat
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

    return { datasets, yPlan, beginAtZero }
}
