import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    ChartConfig,
    ChartData,
    VisualizationDataPoint
} from '../../../types/visualization.types'
import { DataAggregationService } from '../../../services/data-aggregation.service'
import { CHART_COLORS_HEX, getColorWithAlpha } from '../../../../utils/color-utils'
import { log } from '../../../../utils/log'

// Chart.js types - will be dynamically imported
type ChartType = 'line' | 'bar'

interface ChartInstance {
    destroy: () => void
    update: (mode?: string) => void
    resize: () => void
    reset: () => void
    data: {
        labels: string[]
        datasets: ChartDatasetConfig[]
    }
    options: {
        animation?: {
            duration?: number
            easing?: string
        }
    }
}

interface ChartDatasetConfig {
    label: string
    data: (number | null)[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
    tension?: number
    fill?: boolean
}

/**
 * Chart.js-based visualization for line and bar charts
 */
export class ChartVisualization extends BaseVisualization {
    private chartConfig: ChartConfig
    private aggregationService: DataAggregationService
    private chart: ChartInstance | null = null
    private canvasEl: HTMLCanvasElement | null = null
    private chartData: ChartData | null = null
    private resizeObserver: ResizeObserver | null = null
    private chartContainer: HTMLElement | null = null
    private originalData: (number | null)[][] = []
    private animationInterval: ReturnType<typeof setInterval> | null = null
    private currentAnimationIndex: number = 0

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: ChartConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.chartConfig = config
        this.aggregationService = new DataAggregationService()
    }

    /**
     * Render the chart with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering chart for ${this.displayName}`, 'debug')

        // Aggregate data
        this.chartData = this.aggregationService.aggregateForChart(
            data,
            this.propertyId,
            this.displayName,
            this.chartConfig.granularity
        )

        if (this.chartData.labels.length === 0) {
            this.showEmptyState(`No numeric data with dates found for "${this.displayName}"`)
            return
        }

        // Clear container
        this.containerEl.empty()

        // Create section header
        this.createSectionHeader(this.displayName)

        // Create chart container (auto-height, no scrolling)
        this.chartContainer = this.containerEl.createDiv({ cls: 'lt-chart' })

        // Create canvas with aspect ratio for natural sizing
        this.canvasEl = this.chartContainer.createEl('canvas', { cls: 'lt-chart-canvas' })

        // Initialize chart
        this.initChart()
    }

    /**
     * Initialize Chart.js
     */
    private async initChart(): Promise<void> {
        if (!this.canvasEl || !this.chartData) return

        try {
            // Dynamically import Chart.js
            const { Chart, registerables } = await import('chart.js')
            Chart.register(...registerables)

            const ctx = this.canvasEl.getContext('2d')
            if (!ctx) return

            // Prepare datasets
            const datasets: ChartDatasetConfig[] = this.chartData.datasets.map((dataset, index) => {
                const color = CHART_COLORS_HEX[index % CHART_COLORS_HEX.length]!

                return {
                    label: dataset.label,
                    data: dataset.data,
                    backgroundColor:
                        this.chartConfig.chartType === 'bar'
                            ? getColorWithAlpha(color, 0.7)
                            : getColorWithAlpha(color, 0.1),
                    borderColor: color,
                    borderWidth: 2,
                    tension: this.chartConfig.tension,
                    fill: this.chartConfig.chartType === 'line'
                }
            })

            // Create chart
            this.chart = new Chart(ctx, {
                type: this.chartConfig.chartType as ChartType,
                data: {
                    labels: this.chartData.labels,
                    datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 2.5, // Width:height ratio for compact display
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: this.chartConfig.showLegend
                        },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: (context) => {
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
                                display: this.chartConfig.showGrid
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: !this.chartConfig.scale?.min,
                            min: this.chartConfig.scale?.min ?? undefined,
                            max: this.chartConfig.scale?.max ?? undefined,
                            grid: {
                                display: this.chartConfig.showGrid
                            }
                        }
                    },
                    onClick: (
                        _event: unknown,
                        elements: Array<{ index: number; datasetIndex: number }>
                    ) => {
                        this.handleChartClick(elements)
                    }
                }
            }) as unknown as ChartInstance

            // Set up ResizeObserver to handle container size changes
            this.setupResizeObserver()
        } catch (error) {
            log('Failed to initialize Chart.js', 'error', error)
            this.showEmptyState('Failed to load chart library')
        }
    }

    /**
     * Set up ResizeObserver to handle container resize
     */
    private setupResizeObserver(): void {
        if (!this.chartContainer || !this.chart) return

        // Clean up any existing observer
        this.cleanupResizeObserver()

        this.resizeObserver = new ResizeObserver(() => {
            if (this.chart) {
                this.chart.resize()
            }
        })

        this.resizeObserver.observe(this.chartContainer)
    }

    /**
     * Clean up ResizeObserver
     */
    private cleanupResizeObserver(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
            this.resizeObserver = null
        }
    }

    /**
     * Update the chart with new data
     */
    override update(data: VisualizationDataPoint[]): void {
        // Re-render for simplicity
        this.destroy()
        this.render(data)
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.stopAnimation()
        this.cleanupResizeObserver()
        if (this.chart) {
            this.chart.destroy()
            this.chart = null
        }
        this.canvasEl = null
        this.chartContainer = null
        this.chartData = null
        this.originalData = []
    }

    /**
     * Chart.js supports animation
     */
    override supportsAnimation(): boolean {
        return true
    }

    /**
     * Play animation - progressively reveal data points from oldest to newest
     */
    override playAnimation(): void {
        if (!this.chart || !this.chartData || this.animationState === 'playing') return

        this.animationState = 'playing'
        this.updatePlayButtonIcon()

        // Store original data if not already stored
        if (this.originalData.length === 0) {
            this.originalData = this.chart.data.datasets.map((ds) => [...ds.data])
        }

        const totalPoints = this.originalData[0]?.length ?? 0
        if (totalPoints === 0) {
            this.animationState = 'idle'
            this.updatePlayButtonIcon()
            return
        }

        // Start with all null values (hidden)
        this.chart.data.datasets.forEach((dataset) => {
            dataset.data = dataset.data.map(() => null)
        })
        this.chart.update('none')

        // Reset animation index
        this.currentAnimationIndex = 0

        // Calculate interval to complete animation in configured duration
        const intervalMs = Math.max(30, this.animationDuration / totalPoints)

        // Progressively reveal data points from oldest (index 0) to newest
        this.animationInterval = setInterval(() => {
            if (!this.chart || this.animationState !== 'playing') {
                this.clearAnimationInterval()
                return
            }

            // Reveal the next data point for all datasets
            this.chart.data.datasets.forEach((dataset, datasetIndex) => {
                const original = this.originalData[datasetIndex]
                if (original && this.currentAnimationIndex < original.length) {
                    const value = original[this.currentAnimationIndex]
                    dataset.data[this.currentAnimationIndex] = value ?? null
                }
            })

            this.chart.update('none')
            this.currentAnimationIndex++

            // Check if animation is complete
            if (this.currentAnimationIndex >= totalPoints) {
                this.clearAnimationInterval()
                this.animationState = 'idle'
                this.updatePlayButtonIcon()
            }
        }, intervalMs)
    }

    /**
     * Clear the animation interval
     */
    private clearAnimationInterval(): void {
        if (this.animationInterval) {
            clearInterval(this.animationInterval)
            this.animationInterval = null
        }
    }

    /**
     * Stop animation and restore original data
     */
    override stopAnimation(): void {
        this.clearAnimationInterval()

        if (!this.chart) {
            this.animationState = 'idle'
            this.updatePlayButtonIcon()
            return
        }

        // Restore original data if we have it
        if (this.originalData.length > 0) {
            this.chart.data.datasets.forEach((dataset, i) => {
                const original = this.originalData[i]
                if (original) {
                    dataset.data = [...original]
                }
            })
            this.chart.update('none')
        }

        this.animationState = 'idle'
        this.updatePlayButtonIcon()
    }

    /**
     * Handle chart click - open related entries
     */
    private handleChartClick(elements: Array<{ index: number; datasetIndex: number }>): void {
        if (!this.chartData || elements.length === 0) return

        const element = elements[0]
        if (!element) return

        const dataset = this.chartData.datasets[element.datasetIndex]
        if (!dataset) return

        const entries = dataset.entries[element.index]
        if (entries && entries.length > 0) {
            this.openEntries(entries)
        }
    }
}
