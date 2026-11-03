import type {
    BubbleChartData,
    ChartConfig,
    ChartData,
    PieChartData,
    RangeChartData,
    ScatterChartData,
    CartesianTooltipContext,
    RangeTooltipContext,
    ChartClickElement,
    ChartDatasetConfig,
    ChartInstance,
    PieTooltipContext,
    PointTooltipContext,
    ValueFormat
} from '../../../types'
import {
    getColorWithAlpha,
    getBooleanColor,
    getChartColorScheme,
    getValueMatchedSegmentColors,
    prefersReducedMotion,
    formatValueWithEmoji,
    formatValue,
    isDurationFormat,
    maxOf,
    minOf
} from '../../../../utils'
import type { Chart as ChartJsChart, Plugin, ScaleOptions } from 'chart.js'
import type { AnnotationOptions } from 'chartjs-plugin-annotation'
import { referenceLineEndValue, type ReferenceLineSpec } from './reference-lines.utils'
import { format } from 'date-fns'
import { areAllValuesIntegers, formatMetricValue, stripNoteTypeSuffix } from './chart-format.utils'
import { formatHoursAsTime } from '../../../services/range-aggregation.utils'
import {
    DENSE_SERIES_POINT_THRESHOLD,
    datasetsToggledWith,
    isOutlierMarkerDataset,
    type CartesianModel
} from './cartesian-datasets.utils'
import { planYAxis, yAxisBeginsAtZero } from './y-axis-plan.utils'
import { buildDateTicks, dateTickPixelWidth } from './date-ticks.utils'
import {
    cartesianInteraction,
    TIME_AXIS_MAX_BAR_THICKNESS,
    timeAxisBarThickness,
    timeAxisBounds,
    timeAxisRange
} from './time-axis.utils'

/** Format an epoch-ms x value as a compact date for scatter axis ticks / tooltips. */
function formatTimestamp(ms: number): string {
    return format(new Date(ms), 'MMM d, yyyy')
}

/**
 * Chart.js constructor type. We pin to `typeof ChartJsChart` (a type-only import) so the
 * dynamically loaded `chart.js` module surfaces in our signatures without runtime cost.
 */
type ChartClass = typeof ChartJsChart

/**
 * Chart.js animation option honoring the user's reduced-motion preference.
 * `false` disables all Chart.js animations; `undefined` keeps the defaults.
 */
function chartAnimation(): false | undefined {
    return prefersReducedMotion() ? false : undefined
}

/*
 * Why every chart below sets `maintainAspectRatio: false` (issue #144).
 *
 * Cards are far wider than they are tall. With `maintainAspectRatio: true` and
 * an `aspectRatio` of 2, Chart.js first derived the height from the width
 * (`width / 2`), found it taller than the card, and then shrank the *width* back
 * to `height * aspectRatio` (see `getMaximumSize` in Chart.js' DOM helpers). The
 * result was a small chart pinned to the left with most of the card empty — the
 * more columns, the worse it got.
 *
 * With it off, the canvas fills its container in both directions. Chart.js needs
 * a container with a definite height for that, which `.lt-chart` provides
 * (`flex: 1` plus a `min-height`), and it must be dedicated to the canvas and
 * relatively positioned — both true of `.lt-chart`.
 */

/**
 * Initialize pie/doughnut/polarArea chart
 */
export function initPieChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    pieChartData: PieChartData,
    chartConfig: ChartConfig,
    displayName: string,
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    // Use pre-computed isBooleanData flag for consistent coloring
    const isBoolean = pieChartData.isBooleanData

    // Get colors from the configured scheme (or default)
    const colors = getChartColorScheme(chartConfig.colorScheme)

    // Use semantic boolean colors (green/red) only when:
    // 1. Data is boolean AND
    // 2. No custom color scheme is set (undefined or 'default')
    // Otherwise, respect the user's custom color scheme choice
    const hasExplicitScheme = !!chartConfig.colorScheme && chartConfig.colorScheme !== 'default'
    const useSemanticBooleanColors = isBoolean && !hasExplicitScheme

    // Numeric segments match the heatmap's value → color mapping so the same
    // value shows the same color in both visualizations (issue #150). An
    // explicit chart color scheme still wins.
    const valueMatchedColors =
        !isBoolean && !hasExplicitScheme && chartConfig.valueColorScheme
            ? getValueMatchedSegmentColors(
                  pieChartData.labels,
                  chartConfig.valueColorScheme,
                  chartConfig.scale
              )
            : null

    // Generate colors for each segment
    const segmentColor = (label: string, index: number): string => {
        if (useSemanticBooleanColors) return getBooleanColor(label)
        return valueMatchedColors?.[index] ?? colors[index % colors.length]!
    }

    const backgroundColors = pieChartData.labels.map((label, index) => {
        return getColorWithAlpha(segmentColor(label, index), 0.7)
    })

    const borderColors = pieChartData.labels.map((label, index) => {
        return segmentColor(label, index)
    })

    return new Chart(ctx, {
        type: chartConfig.chartType,
        data: {
            labels: pieChartData.labels,
            datasets: [
                {
                    label: displayName,
                    data: pieChartData.values,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2
                }
            ]
        },
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartConfig.showLegend,
                    position: chartConfig.legendPosition ?? 'right'
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: PieTooltipContext) => {
                            const label = context.label ?? ''
                            // Skip if label is empty or "null"
                            if (!label || label === 'null') return ''
                            // For pie/doughnut, parsed is a number
                            // For polarArea, parsed is an object { r: number }
                            const parsed = context.parsed
                            const value =
                                typeof parsed === 'number'
                                    ? parsed
                                    : typeof parsed === 'object' && parsed !== null && 'r' in parsed
                                      ? parsed.r
                                      : null
                            if (value === null || value === undefined) return ''
                            const total = pieChartData.values.reduce((a, b) => a + b, 0) || 1
                            const percentage = ((value / total) * 100).toFixed(1)
                            return `${label}: ${value} (${percentage}%)`
                        }
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}

/**
 * Initialize radar chart
 */
export function initRadarChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    chartConfig: ChartConfig,
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    // Get colors from the configured scheme (or default)
    const colors = getChartColorScheme(chartConfig.colorScheme)

    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = colors[index % colors.length]!

        return {
            label: dataset.label,
            data: dataset.data,
            backgroundColor: getColorWithAlpha(color, 0.2),
            borderColor: color,
            borderWidth: 2,
            fill: true
        }
    })

    return new Chart(ctx, {
        type: 'radar',
        data: {
            labels: chartData.labels,
            datasets
        },
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    // Always show legend when there are multiple datasets (list data, overlays)
                    display: chartConfig.showLegend || datasets.length > 1
                },
                tooltip: {
                    enabled: true
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}

/**
 * suggestedMin/Max so every reference line stays visible; an explicit user
 * scale still wins (min/max override suggested bounds).
 */
export function referenceLineBounds(
    referenceLines: ReferenceLineSpec[] | undefined,
    labelCount: number,
    chartConfig: ChartConfig
): { suggestedMin: number | undefined; suggestedMax: number | undefined } {
    const startValues = (referenceLines ?? []).map((line) => line.value)
    const endValues = (referenceLines ?? []).map((line) => referenceLineEndValue(line, labelCount))
    return {
        suggestedMin:
            startValues.length > 0 && chartConfig.scale?.min == null
                ? minOf([...startValues, ...endValues])
                : undefined,
        suggestedMax:
            endValues.length > 0 && chartConfig.scale?.max == null
                ? maxOf([...startValues, ...endValues])
                : undefined
    }
}

/**
 * Build the annotation set for a cartesian chart's reference lines.
 *
 * Horizontal lines span the full width at their value. A cumulative target
 * line (issue #158) slopes from `value` at the first period to
 * `value × periods` at the last, matching how a running total accrues —
 * exported so the incremental update path can rebuild it when the period
 * count changes.
 */
export function buildReferenceLineAnnotations(
    referenceLines: ReferenceLineSpec[] | undefined,
    labelCount: number,
    /**
     * First and last x values on a time-proportional axis (date-per-note,
     * 3.4.0). Absent on category axes, where x values are label indices
     */
    xRange?: { min: number; max: number }
): Record<string, AnnotationOptions> {
    const annotations: Record<string, AnnotationOptions> = {}

    if (referenceLines && referenceLines.length > 0) {
        referenceLines.forEach((line, index) => {
            // Anchor each label per its spec: reference labels sit at the
            // right edge, the goal target's at the left, so two lines at the
            // same value stay individually readable (issue #156)
            const position = line.labelPosition ?? 'end'
            const isSloped = line.cumulativePerPeriod === true && labelCount > 1
            annotations[`referenceLine${index}`] = {
                type: 'line',
                // A sloped line needs explicit x endpoints (category indices);
                // a horizontal one spans the chart on its own
                ...(isSloped
                    ? { xMin: xRange?.min ?? 0, xMax: xRange?.max ?? labelCount - 1 }
                    : {}),
                yMin: line.value,
                yMax: referenceLineEndValue(line, labelCount),
                borderColor: line.color,
                borderWidth: 2,
                borderDash: line.dash ?? [5, 5],
                label: {
                    display: true,
                    content: line.label,
                    position,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    font: { size: 11, weight: 'normal' },
                    padding: 4,
                    borderRadius: 3,
                    xAdjust: position === 'start' ? 10 : -10,
                    yAdjust: 0
                }
            }
        })
    }

    return annotations
}

/**
 * Y-axis tick options for a value format: a duration axis gets its step from
 * the plan and labels like `5:30`. The number format sets nothing, so
 * Chart.js keeps its own tick labels (unchanged behavior).
 */
function valueTickOptions(
    valueFormat: ValueFormat | undefined,
    stepSize: number | undefined
): { stepSize?: number; callback?: (value: number | string) => string } {
    return {
        ...(stepSize !== undefined ? { stepSize } : {}),
        ...(isDurationFormat(valueFormat)
            ? {
                  callback: (value: number | string): string =>
                      formatValue(Number(value), valueFormat)
              }
            : {})
    }
}

/**
 * Y-axis bounds of a cartesian chart from its plan. Explicit plan bounds win
 * over the reference-line hints; an explicit user scale wins over both.
 */
export function cartesianYBounds(
    model: CartesianModel,
    referenceLines: ReferenceLineSpec[] | undefined,
    labelCount: number,
    chartConfig: ChartConfig
): {
    min: number | undefined
    max: number | undefined
    suggestedMin: number | undefined
    suggestedMax: number | undefined
} {
    // Reference lines outside the data range were invisible: the annotation
    // plugin does not extend the scale. suggestedMin/Max widen the auto-fit
    // range to include every reference line value; an explicit user scale
    // still wins (min/max override suggested bounds).
    const { suggestedMin, suggestedMax } = referenceLineBounds(
        referenceLines,
        labelCount,
        chartConfig
    )
    return {
        min: chartConfig.scale?.min ?? model.yPlan.min ?? undefined,
        max: chartConfig.scale?.max ?? model.yPlan.max ?? undefined,
        suggestedMin,
        suggestedMax
    }
}

/**
 * The x-axis of the date-per-note axis (3.4.0): a linear scale over epoch-ms
 * values with calendar-aligned date ticks, horizontal labels, auto-skipped.
 * Chart.js has no date adapter in this bundle, so ticks come from
 * `buildDateTicks` instead of a `time` scale.
 */
export function timeXAxis(xValues: number[], chartConfig: ChartConfig): ScaleOptions<'linear'> {
    const bounds = timeAxisBounds(xValues, chartConfig.chartType === 'bar')
    let tickFormat = 'MMM d, yyyy'

    return {
        type: 'linear',
        display: true,
        min: bounds.min,
        max: bounds.max,
        // Never `offset` here: on a linear scale it reserves room per tick
        // (counted before auto-skip) and squeezes the notes toward the middle.
        // Bars get their room from the half-day padding instead
        offset: false,
        grid: {
            display: chartConfig.showGrid
        },
        afterBuildTicks: (axis): void => {
            const width = axis.width > 0 ? axis.width : 300
            // Size the tick count for the short format first, then for the
            // format the chosen unit actually uses
            let ticks = buildDateTicks(axis.min, axis.max, width / dateTickPixelWidth('MMM d'))
            const fitting = buildDateTicks(
                axis.min,
                axis.max,
                width / dateTickPixelWidth(ticks.format)
            )
            if (fitting.values.length < ticks.values.length) ticks = fitting
            tickFormat = ticks.format
            axis.ticks = ticks.values.map((value) => ({ value }))
        },
        ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: 12,
            callback: (value): string => format(new Date(Number(value)), tickFormat)
        }
    }
}

/**
 * Sets the bar width on the date-per-note axis right before the bars are
 * laid out, when the axis width is known (3.4.0). Chart.js sizes bars on a
 * linear axis from the smallest gap between two notes, which turns a year of
 * runs into hairlines, and has no minimum width of its own.
 */
function timeAxisBarThicknessPlugin(getChartData: () => ChartData | null): Plugin {
    return {
        id: 'ltTimeAxisBarThickness',
        beforeDatasetsUpdate: (chart): void => {
            const xScale = chart.scales['x']
            const xValues = getChartData()?.xValues
            if (!xScale || !xValues) return
            const thickness = timeAxisBarThickness(xValues, xScale.width, xScale.min, xScale.max)
            for (const dataset of chart.data.datasets) {
                if (isOutlierMarkerDataset(dataset)) continue
                Object.assign(dataset, {
                    barThickness: thickness,
                    maxBarThickness: TIME_AXIS_MAX_BAR_THICKNESS
                })
            }
        }
    }
}

/**
 * The x-axis of the note-name axis (3.4.0): labels without the note-type
 * suffix, horizontal when they fit, rotated up to 45° otherwise, and
 * auto-skipped so they never overlap. Tooltips keep the full note name.
 */
function noteNameXAxis(
    getChartData: () => ChartData | null,
    chartConfig: ChartConfig
): ScaleOptions<'category'> {
    return {
        display: true,
        offset: true, // Add space at edges for first/last bars
        grid: {
            display: chartConfig.showGrid,
            offset: true
        },
        ticks: {
            minRotation: 0,
            maxRotation: 45,
            autoSkip: true,
            autoSkipPadding: 10,
            align: 'center',
            // Category ticks carry the label index as their value
            callback: (value): string =>
                stripNoteTypeSuffix(getChartData()?.labels[Number(value)] ?? String(value))
        }
    }
}

/**
 * Initialize cartesian chart (line, bar, area)
 */
export function initCartesianChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    /**
     * The chart data currently shown, real values included: incremental
     * updates replace it, and tooltips must read the latest
     */
    getChartData: () => ChartData | null,
    model: CartesianModel,
    chartConfig: ChartConfig,
    onClick: (elements: ChartClickElement[]) => void,
    referenceLines?: ReferenceLineSpec[]
): ChartInstance {
    const datasets = model.datasets

    // Counts (habits, sessions) should render without decimals: detect when every
    // plotted value is a whole number so the tooltip drops the `.00` (issue #103).
    const allValues: unknown[] = chartData.datasets.flatMap((dataset) => dataset.data as unknown[])
    const integersOnly = areAllValuesIntegers(allValues)
    const valueFormat = chartConfig.valueFormat

    // Map chart type (area uses line type)
    const chartJsType = chartConfig.chartType === 'line' ? 'line' : chartConfig.chartType

    const labelCount = chartData.labels.length
    const yBounds = cartesianYBounds(model, referenceLines, labelCount, chartConfig)

    // Build annotation configuration if reference lines exist
    const annotations = buildReferenceLineAnnotations(
        referenceLines,
        labelCount,
        timeAxisRange(chartData)
    )

    return new Chart(ctx, {
        type: chartJsType,
        data: {
            labels: chartData.labels,
            datasets
        },
        // Bars on the time axis need a width Chart.js cannot derive (3.4.0)
        plugins:
            chartData.xValues && chartConfig.chartType === 'bar'
                ? [timeAxisBarThicknessPlugin(getChartData)]
                : [],
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 60 // Extra space for last x-axis labels
                }
            },
            interaction: cartesianInteraction(chartData.xValues !== undefined),
            plugins: {
                legend: {
                    // Always show legend when there are multiple datasets (list
                    // data, overlays). Outlier markers are not series of their own
                    display: chartConfig.showLegend || chartData.datasets.length > 1,
                    labels: {
                        filter: (item, data): boolean =>
                            !isOutlierMarkerDataset(data.datasets[item.datasetIndex ?? -1])
                    },
                    // Hiding a series hides its outlier markers with it (3.4.0)
                    onClick: (_event, item, legend): void => {
                        const index = item.datasetIndex
                        if (index === undefined) return
                        const chart = legend.chart
                        const visible = !chart.isDatasetVisible(index)
                        for (const i of datasetsToggledWith(chart.data.datasets, index)) {
                            chart.setDatasetVisibility(i, visible)
                        }
                        chart.update()
                    }
                },
                tooltip: {
                    enabled: true,
                    // The marker repeats the series' own point: one row is enough
                    filter: (item): boolean => !isOutlierMarkerDataset(item.dataset),
                    callbacks: {
                        // On a time axis the default title is a raw timestamp:
                        // say the date and the note instead (3.4.0)
                        ...(chartData.xValues
                            ? {
                                  title: (items: { dataIndex: number }[]): string => {
                                      const index = items[0]?.dataIndex
                                      const current = getChartData()
                                      if (index === undefined || !current) return ''
                                      const x = current.xValues?.[index]
                                      const name = current.labels[index] ?? ''
                                      return x === undefined
                                          ? name
                                          : `${format(new Date(x), 'MMM d, yyyy')} · ${name}`
                                  }
                              }
                            : {}),
                        label: (context: CartesianTooltipContext) => {
                            const label = context.dataset.label ?? ''
                            const plotted = context.parsed.y
                            // Return empty string for null/undefined values (not "null")
                            if (plotted === null || plotted === undefined) return ''
                            // A value drawn at the axis edge reads as itself (3.4.0)
                            const real =
                                getChartData()?.datasets[context.datasetIndex]?.data[
                                    context.dataIndex
                                ] ?? null
                            const value = real ?? plotted
                            const outside = real !== null && real !== plotted
                            // Emoji summary when the property defines one (#22)
                            return `${label}: ${formatValueWithEmoji(
                                value,
                                chartConfig.valueEmojis,
                                formatValue(value, valueFormat, (v) =>
                                    formatMetricValue(v, integersOnly)
                                )
                            )}${outside ? ' (outside the scale)' : ''}`
                        }
                    }
                },
                annotation: {
                    annotations
                }
            },
            scales: {
                x: chartData.xValues
                    ? timeXAxis(chartData.xValues, chartConfig)
                    : chartConfig.xAxisSource === 'note-name'
                      ? noteNameXAxis(getChartData, chartConfig)
                      : {
                            display: true,
                            offset: true, // Add space at edges for first/last bars
                            bounds: 'ticks', // Ensure edge ticks remain visible
                            grid: {
                                display: chartConfig.showGrid,
                                offset: true
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkipPadding: 10,
                                includeBounds: true, // Include first/last labels
                                align: 'center'
                            }
                        },
                y: {
                    display: true,
                    beginAtZero: model.beginAtZero,
                    min: yBounds.min,
                    max: yBounds.max,
                    suggestedMin: yBounds.suggestedMin,
                    suggestedMax: yBounds.suggestedMax,
                    ticks: valueTickOptions(valueFormat, model.yPlan.stepSize),
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}

/**
 * Initialize scatter chart
 */
/**
 * Initialize a range chart (issue #81): floating bars per period, spanning
 * from a start property's value to an end property's value. In time mode the
 * y-axis and tooltips read as clock times, wrapping past midnight.
 */
export function initRangeChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    data: RangeChartData,
    chartConfig: ChartConfig,
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    const colors = getChartColorScheme(chartConfig.colorScheme)
    const color = colors[0] ?? '#8884d8'

    const flatValues = data.bars.flatMap((bar) => (bar === null ? [] : bar))
    const integersOnly = areAllValuesIntegers(flatValues)
    const formatValue = (value: number): string =>
        data.timeMode ? formatHoursAsTime(value) : formatMetricValue(value, integersOnly)

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: data.displayName,
                    // Chart.js floating bars: one [start, end] tuple per slot
                    data: data.bars as unknown as number[],
                    backgroundColor: getColorWithAlpha(color, 0.55),
                    borderColor: color,
                    borderWidth: 1.5,
                    borderRadius: 3,
                    borderSkipped: false
                }
            ]
        },
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 60 // Extra space for last x-axis labels
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: chartConfig.showLegend
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: RangeTooltipContext): string[] => {
                            const raw = context.raw as [number, number] | null
                            if (!raw) return []
                            const [start, end] = raw
                            return [
                                `${data.startLabel}: ${formatValue(start)}`,
                                `${data.endLabel}: ${formatValue(end)}`
                            ]
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    offset: true,
                    bounds: 'ticks',
                    grid: {
                        display: chartConfig.showGrid,
                        offset: true
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkipPadding: 10,
                        includeBounds: true,
                        align: 'center'
                    }
                },
                y: {
                    display: true,
                    grid: {
                        display: chartConfig.showGrid
                    },
                    ticks: {
                        // Whole hours in time mode: "21:00", "22:00", ...
                        ...(data.timeMode ? { stepSize: 1 } : {}),
                        callback: (value): string => formatValue(Number(value))
                    },
                    ...(chartConfig.scale?.min != null ? { min: chartConfig.scale.min } : {}),
                    ...(chartConfig.scale?.max != null ? { max: chartConfig.scale.max } : {})
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}

export function initScatterChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    scatterChartData: ScatterChartData,
    chartConfig: ChartConfig,
    displayName: string,
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    // Get colors from the configured scheme (or default)
    const colors = getChartColorScheme(chartConfig.colorScheme)
    const color = colors[0]!

    // Scatter marks cannot be hidden (they *are* the data), but dense series get
    // smaller dots so thousands of points stay readable and cheap (issue #104)
    const isDense = scatterChartData.points.length > DENSE_SERIES_POINT_THRESHOLD

    return new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: displayName,
                    data: scatterChartData.points,
                    backgroundColor: getColorWithAlpha(color, 0.7),
                    borderColor: color,
                    borderWidth: 1,
                    pointRadius: isDense ? 2 : 6,
                    pointHoverRadius: isDense ? 5 : 8
                }
            ]
        },
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartConfig.showLegend
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: PointTooltipContext) => {
                            const x = context.parsed.x
                            const y = context.parsed.y
                            // Return empty string for null/undefined values
                            if (x === null || x === undefined || y === null || y === undefined)
                                return ''
                            // x is an epoch-ms timestamp (issue #97)
                            return `${formatTimestamp(x)}: ${formatValueWithEmoji(
                                y,
                                chartConfig.valueEmojis,
                                formatValue(y, chartConfig.valueFormat, (v) =>
                                    formatMetricValue(v, false)
                                )
                            )}`
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        // x values are epoch-ms timestamps; render them as dates
                        callback: (value) => formatTimestamp(Number(value)),
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkipPadding: 12
                    },
                    grid: {
                        display: chartConfig.showGrid
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Value'
                    },
                    ...pointChartYAxis(
                        scatterChartData.points.map((p) => p.y),
                        chartConfig
                    ),
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}

/**
 * Y-axis range and ticks for scatter and bubble charts: same rules as the
 * cartesian charts (explicit scale wins, durations fit their data and tick on
 * the duration ladder), without reference lines or outlier fitting.
 */
function pointChartYAxis(
    values: number[],
    chartConfig: ChartConfig
): {
    beginAtZero: boolean
    min: number | undefined
    max: number | undefined
    ticks: ReturnType<typeof valueTickOptions>
} {
    const beginAtZero = yAxisBeginsAtZero(
        chartConfig.chartType,
        chartConfig.valueFormat,
        chartConfig.scale
    )
    const plan = planYAxis({
        series: [{ data: values }],
        referenceValues: [],
        scale: chartConfig.scale,
        beginAtZero,
        valueFormat: chartConfig.valueFormat
    })
    return {
        beginAtZero,
        min: chartConfig.scale?.min ?? undefined,
        max: chartConfig.scale?.max ?? undefined,
        ticks: valueTickOptions(chartConfig.valueFormat, plan.stepSize)
    }
}

/**
 * Initialize bubble chart
 */
export function initBubbleChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    bubbleChartData: BubbleChartData,
    chartConfig: ChartConfig,
    displayName: string,
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    // Get colors from the configured scheme (or default)
    const colors = getChartColorScheme(chartConfig.colorScheme)
    const color = colors[0]!

    return new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [
                {
                    label: displayName,
                    data: bubbleChartData.points,
                    backgroundColor: getColorWithAlpha(color, 0.5),
                    borderColor: color,
                    borderWidth: 2
                }
            ]
        },
        options: {
            animation: chartAnimation(),
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: chartConfig.showLegend
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: PointTooltipContext) => {
                            const y = context.parsed.y
                            // Return empty string for null/undefined values
                            if (y === null || y === undefined) return ''
                            const raw = context.raw
                            // Read the exact count stored on the point (issue #103)
                            const count =
                                raw &&
                                typeof raw === 'object' &&
                                'count' in raw &&
                                typeof raw.count === 'number'
                                    ? raw.count
                                    : 0
                            const entries = count === 1 ? '1 entry' : `${count} entries`
                            // Emoji summary when the property defines one (#22)
                            return `Value: ${formatValueWithEmoji(
                                y,
                                chartConfig.valueEmojis,
                                formatValue(y, chartConfig.valueFormat, (v) =>
                                    formatMetricValue(v, false)
                                )
                            )}, ${entries}`
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time →'
                    },
                    min: 0,
                    max: 100,
                    grid: {
                        display: chartConfig.showGrid
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Value'
                    },
                    ...pointChartYAxis(
                        bubbleChartData.points.map((p) => p.y),
                        chartConfig
                    ),
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    })
}
