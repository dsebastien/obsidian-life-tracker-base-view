import type {
    BubbleChartData,
    ChartConfig,
    ChartData,
    PieChartData,
    ScatterChartData,
    CartesianTooltipContext,
    ChartClickElement,
    ChartDatasetConfig,
    ChartInstance,
    ChartType,
    PieTooltipContext,
    PointTooltipContext
} from '../../../types'
import { getColorWithAlpha, getBooleanColor, getChartColorScheme } from '../../../../utils'

/**
 * Chart.js constructor type.
 * Uses 'any' because Chart.js is dynamically imported and its type system
 * is extremely complex with many generic parameters that vary by chart type.
 * The Chart constructor accepts different configurations depending on chart type,
 * making a precise type definition impractical.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js has complex generic types that vary by chart type, making precise typing impractical
type ChartClass = any

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
    const useSemanticBooleanColors =
        isBoolean && (!chartConfig.colorScheme || chartConfig.colorScheme === 'default')

    // Generate colors for each segment
    const backgroundColors = pieChartData.labels.map((label, index) => {
        const color = useSemanticBooleanColors
            ? getBooleanColor(label)
            : colors[index % colors.length]!
        return getColorWithAlpha(color, 0.7)
    })

    const borderColors = pieChartData.labels.map((label, index) => {
        return useSemanticBooleanColors ? getBooleanColor(label) : colors[index % colors.length]!
    })

    return new Chart(ctx, {
        type: chartConfig.chartType as ChartType,
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
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: chartConfig.showLegend,
                    position: 'right'
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
                                      ? (parsed as { r: number }).r
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
    }) as unknown as ChartInstance
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
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
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
    }) as unknown as ChartInstance
}

/**
 * Initialize cartesian chart (line, bar, area)
 */
export function initCartesianChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    chartConfig: ChartConfig,
    onClick: (elements: ChartClickElement[]) => void,
    referenceLines?: Array<{ value: number; label: string; color: string }>
): ChartInstance {
    // Use fill property from config (area charts have fill: true, line charts have fill: false)
    const shouldFill = chartConfig.fill ?? false

    // Get colors from the configured scheme (or default)
    const colors = getChartColorScheme(chartConfig.colorScheme)

    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = colors[index % colors.length]!

        return {
            label: dataset.label,
            data: dataset.data,
            backgroundColor:
                chartConfig.chartType === 'bar'
                    ? getColorWithAlpha(color, 0.7)
                    : getColorWithAlpha(color, 0.3),
            borderColor: color,
            borderWidth: 2,
            tension: chartConfig.tension,
            fill: shouldFill
        }
    })

    // Map chart type (area uses line type)
    const chartJsType = chartConfig.chartType === 'line' ? 'line' : chartConfig.chartType

    // Build annotation configuration if reference lines exist
    const annotations: Record<string, unknown> = {}

    if (referenceLines && referenceLines.length > 0) {
        referenceLines.forEach((line, index) => {
            annotations[`referenceLine${index}`] = {
                type: 'line',
                yMin: line.value,
                yMax: line.value,
                borderColor: line.color,
                borderWidth: 2,
                borderDash: [5, 5], // Dashed line
                label: {
                    display: true,
                    content: line.label,
                    enabled: true,
                    position: 'end',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    font: { size: 11, weight: 'normal' },
                    padding: 4,
                    borderRadius: 3,
                    xAdjust: -10,
                    yAdjust: 0
                }
            }
        })
    }

    return new Chart(ctx, {
        type: chartJsType as ChartType,
        data: {
            labels: chartData.labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
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
                    // Always show legend when there are multiple datasets (list data, overlays)
                    display: chartConfig.showLegend || datasets.length > 1
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: (context: CartesianTooltipContext) => {
                            const label = context.dataset.label ?? ''
                            const value = context.parsed.y
                            // Return empty string for null/undefined values (not "null")
                            if (value === null || value === undefined) return ''
                            return `${label}: ${value.toFixed(2)}`
                        }
                    }
                },
                annotation: {
                    annotations
                }
            },
            scales: {
                x: {
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
                    beginAtZero: !chartConfig.scale?.min,
                    min: chartConfig.scale?.min ?? undefined,
                    max: chartConfig.scale?.max ?? undefined,
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    }) as unknown as ChartInstance
}

/**
 * Initialize scatter chart
 */
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
                    pointRadius: 6,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
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
                            return `Time: ${x.toFixed(1)}%, Value: ${y.toFixed(2)}`
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
                    beginAtZero: !chartConfig.scale?.min,
                    min: chartConfig.scale?.min ?? undefined,
                    max: chartConfig.scale?.max ?? undefined,
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    }) as unknown as ChartInstance
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
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
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
                            const r = context.raw?.r ?? 0
                            // Calculate count from radius (reverse the formula)
                            const count = Math.round(((r - 5) / 25) * 10) || 1
                            return `Value: ${y.toFixed(2)}, Entries: ~${count}`
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
                    beginAtZero: !chartConfig.scale?.min,
                    min: chartConfig.scale?.min ?? undefined,
                    max: chartConfig.scale?.max ?? undefined,
                    grid: {
                        display: chartConfig.showGrid
                    }
                }
            },
            onClick: (_event: unknown, elements: ChartClickElement[]) => {
                onClick(elements)
            }
        }
    }) as unknown as ChartInstance
}
