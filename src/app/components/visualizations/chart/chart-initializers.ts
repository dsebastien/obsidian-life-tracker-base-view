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
import { CHART_COLORS_HEX, getColorWithAlpha } from '../../../../utils'

/**
 * Chart.js constructor type.
 * Uses 'any' because Chart.js is dynamically imported and its type system
 * is extremely complex with many generic parameters that vary by chart type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // Generate colors for each segment
    const backgroundColors = pieChartData.labels.map((_, index) => {
        const color = CHART_COLORS_HEX[index % CHART_COLORS_HEX.length]!
        return getColorWithAlpha(color, 0.7)
    })

    const borderColors = pieChartData.labels.map((_, index) => {
        return CHART_COLORS_HEX[index % CHART_COLORS_HEX.length]!
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
            aspectRatio: 1.5,
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
                            const value = context.parsed
                            const total = pieChartData.values.reduce((a, b) => a + b, 0) ?? 1
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
    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = CHART_COLORS_HEX[index % CHART_COLORS_HEX.length]!

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
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    display: chartConfig.showLegend
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
    onClick: (elements: ChartClickElement[]) => void
): ChartInstance {
    // Determine if this is an area chart (line with fill)
    const isAreaChart = chartConfig.chartType === 'line' && chartConfig.tension > 0

    const datasets: ChartDatasetConfig[] = chartData.datasets.map((dataset, index) => {
        const color = CHART_COLORS_HEX[index % CHART_COLORS_HEX.length]!

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
            fill: isAreaChart || chartConfig.chartType === 'line'
        }
    })

    // Map chart type (area uses line type)
    const chartJsType = chartConfig.chartType === 'line' ? 'line' : chartConfig.chartType

    return new Chart(ctx, {
        type: chartJsType as ChartType,
        data: {
            labels: chartData.labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
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
                        label: (context: CartesianTooltipContext) => {
                            const label = context.dataset.label ?? ''
                            const value = context.parsed.y
                            if (value === null || value === undefined) return label
                            return `${label}: ${value.toFixed(2)}`
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: chartConfig.showGrid
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
    const color = CHART_COLORS_HEX[0]!

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
                            const x = context.parsed.x?.toFixed(1) ?? 0
                            const y = context.parsed.y?.toFixed(2) ?? 0
                            return `Time: ${x}%, Value: ${y}`
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
    const color = CHART_COLORS_HEX[0]!

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
                            const y = context.parsed.y?.toFixed(2) ?? 0
                            const r = context.raw?.r ?? 0
                            // Calculate count from radius (reverse the formula)
                            const count = Math.round(((r - 5) / 25) * 10) || 1
                            return `Value: ${y}, Entries: ~${count}`
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
