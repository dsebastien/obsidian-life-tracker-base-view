import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    BubbleChartData,
    ChartConfig,
    ChartData,
    PieChartData,
    ScatterChartData,
    VisualizationDataPoint
} from '../../../types'
import { DataAggregationService } from '../../../services/data-aggregation.service'
import { ChartLoaderService } from '../../../services/chart-loader.service'
import { log, getBooleanColor, getChartColorScheme, getColorWithAlpha } from '../../../../utils'
import type { ChartClickElement, ChartInstance } from './chart-types'
import {
    initBubbleChart,
    initCartesianChart,
    initPieChart,
    initRadarChart,
    initScatterChart
} from './chart-initializers'

/**
 * Shared aggregation service instance for all chart visualizations
 */
const sharedAggregationService = new DataAggregationService()

/**
 * Chart.js-based visualization for line and bar charts
 */
export class ChartVisualization extends BaseVisualization {
    private chartConfig: ChartConfig
    private chart: ChartInstance | null = null
    private canvasEl: HTMLCanvasElement | null = null
    private chartData: ChartData | null = null
    private pieChartData: PieChartData | null = null
    private scatterChartData: ScatterChartData | null = null
    private bubbleChartData: BubbleChartData | null = null
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
    }

    /**
     * Check if this is a pie-type chart (pie, doughnut, polarArea)
     */
    private isPieType(): boolean {
        return ['pie', 'doughnut', 'polarArea'].includes(this.chartConfig.chartType)
    }

    /**
     * Check if this is a scatter chart
     */
    private isScatterType(): boolean {
        return this.chartConfig.chartType === 'scatter'
    }

    /**
     * Check if this is a bubble chart
     */
    private isBubbleType(): boolean {
        return this.chartConfig.chartType === 'bubble'
    }

    /**
     * Check if this is a cartesian chart type that supports list data visualization
     * (line, bar, area, radar)
     */
    private isCartesianType(): boolean {
        return ['line', 'bar', 'radar'].includes(this.chartConfig.chartType)
    }

    /**
     * Render the chart with data
     */
    override render(data: VisualizationDataPoint[]): void {
        // Reset all data
        this.chartData = null
        this.pieChartData = null
        this.scatterChartData = null
        this.bubbleChartData = null

        // Aggregate data based on chart type (use shared service)
        if (this.isPieType()) {
            this.pieChartData = sharedAggregationService.aggregateForPieChart(
                data,
                this.propertyId,
                this.displayName
            )

            if (this.pieChartData.labels.length === 0) {
                this.showEmptyState(`No data found for "${this.displayName}"`)
                return
            }
        } else if (this.isScatterType()) {
            this.scatterChartData = sharedAggregationService.aggregateForScatterChart(
                data,
                this.propertyId,
                this.displayName
            )

            if (this.scatterChartData.points.length === 0) {
                this.showEmptyState(`No numeric data with dates found for "${this.displayName}"`)
                return
            }
        } else if (this.isBubbleType()) {
            this.bubbleChartData = sharedAggregationService.aggregateForBubbleChart(
                data,
                this.propertyId,
                this.displayName,
                this.chartConfig.granularity
            )

            if (this.bubbleChartData.points.length === 0) {
                this.showEmptyState(`No numeric data with dates found for "${this.displayName}"`)
                return
            }
        } else {
            // For cartesian charts, check if data contains list values
            const hasListValues = sharedAggregationService.hasListData(data)

            if (hasListValues && this.isCartesianType()) {
                // Use list aggregation: creates one dataset per unique value with 0/1 presence
                this.chartData = sharedAggregationService.aggregateListForChart(
                    data,
                    this.propertyId,
                    this.displayName,
                    this.chartConfig.granularity
                )
            } else {
                // Standard numeric aggregation
                this.chartData = sharedAggregationService.aggregateForChart(
                    data,
                    this.propertyId,
                    this.displayName,
                    this.chartConfig.granularity
                )
            }

            if (this.chartData.labels.length === 0) {
                const message = hasListValues
                    ? `No list data with dates found for "${this.displayName}"`
                    : `No numeric data with dates found for "${this.displayName}"`
                this.showEmptyState(message)
                return
            }
        }

        // Clear container
        this.containerEl.empty()

        // Create section header
        this.createSectionHeader(this.displayName)

        // Create chart container (auto-height, no scrolling)
        this.chartContainer = this.containerEl.createDiv({ cls: 'lt-chart' })

        // Create canvas with aspect ratio for natural sizing
        this.canvasEl = this.chartContainer.createEl('canvas', { cls: 'lt-chart-canvas' })

        // Initialize chart (async, errors handled internally)
        void this.initChart()
    }

    /**
     * Render the chart with pre-aggregated chart data (used for overlay charts)
     */
    renderChartData(data: ChartData): void {
        // Reset all data
        this.chartData = null
        this.pieChartData = null
        this.scatterChartData = null
        this.bubbleChartData = null

        // Use the provided chart data directly
        this.chartData = data

        if (this.chartData.labels.length === 0) {
            this.showEmptyState(`No data found for "${this.displayName}"`)
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

        // Initialize chart (async, errors handled internally)
        void this.initChart()
    }

    /**
     * Initialize Chart.js
     */
    private async initChart(): Promise<void> {
        if (!this.canvasEl) return

        // Check we have appropriate data for the chart type
        if (this.isPieType() && !this.pieChartData) return
        if (this.isScatterType() && !this.scatterChartData) return
        if (this.isBubbleType() && !this.bubbleChartData) return
        if (!this.isPieType() && !this.isScatterType() && !this.isBubbleType() && !this.chartData)
            return

        try {
            // Use ChartLoaderService for efficient loading (registers only once)
            const { Chart } = await ChartLoaderService.getChartJs()

            const ctx = this.canvasEl.getContext('2d')
            if (!ctx) return

            // Build chart configuration based on type
            if (this.isPieType() && this.pieChartData) {
                this.chart = initPieChart(
                    Chart,
                    ctx,
                    this.pieChartData,
                    this.chartConfig,
                    this.displayName,
                    (elements) => this.handlePieChartClick(elements)
                )
            } else if (this.chartConfig.chartType === 'radar' && this.chartData) {
                this.chart = initRadarChart(
                    Chart,
                    ctx,
                    this.chartData,
                    this.chartConfig,
                    (elements) => this.handleChartClick(elements)
                )
            } else if (this.isScatterType() && this.scatterChartData) {
                this.chart = initScatterChart(
                    Chart,
                    ctx,
                    this.scatterChartData,
                    this.chartConfig,
                    this.displayName,
                    (elements) => this.handleScatterChartClick(elements)
                )
            } else if (this.isBubbleType() && this.bubbleChartData) {
                this.chart = initBubbleChart(
                    Chart,
                    ctx,
                    this.bubbleChartData,
                    this.chartConfig,
                    this.displayName,
                    (elements) => this.handleBubbleChartClick(elements)
                )
            } else if (this.chartData) {
                this.chart = initCartesianChart(
                    Chart,
                    ctx,
                    this.chartData,
                    this.chartConfig,
                    (elements) => this.handleChartClick(elements)
                )
            }
        } catch (error) {
            log('Failed to initialize Chart.js', 'error', error)
            this.showEmptyState('Failed to load chart library')
        }
    }

    /**
     * Update the chart with new data using Chart.js incremental update
     */
    override update(data: VisualizationDataPoint[]): void {
        // If no chart exists, do a full render
        if (!this.chart) {
            this.render(data)
            return
        }

        // Handle pie/doughnut/polarArea charts
        if (this.isPieType()) {
            this.updatePieChart(data)
            return
        }

        // Handle scatter charts
        if (this.isScatterType()) {
            this.updateScatterChart(data)
            return
        }

        // Handle bubble charts
        if (this.isBubbleType()) {
            this.updateBubbleChart(data)
            return
        }

        // Handle radar charts (same structure as cartesian)
        if (this.chartConfig.chartType === 'radar') {
            this.updateCartesianChart(data)
            return
        }

        // Handle cartesian charts (line, bar, area)
        this.updateCartesianChart(data)
    }

    /**
     * Incremental update for pie/doughnut/polarArea charts
     */
    private updatePieChart(data: VisualizationDataPoint[]): void {
        const newPieData = sharedAggregationService.aggregateForPieChart(
            data,
            this.propertyId,
            this.displayName
        )

        if (newPieData.labels.length === 0) {
            this.destroy()
            this.render(data)
            return
        }

        // Update stored data
        this.pieChartData = newPieData

        // Update chart data in place
        this.chart!.data.labels = newPieData.labels

        const dataset = this.chart!.data.datasets[0]
        if (dataset) {
            dataset.data = newPieData.values

            // Regenerate colors for new labels using configured color scheme
            // Chart.js dataset colors can be arrays, but types may not reflect this
            const isBoolean = newPieData.isBooleanData
            const colors = getChartColorScheme(this.chartConfig.colorScheme)

            // Use semantic boolean colors (green/red) only when:
            // 1. Data is boolean AND
            // 2. No custom color scheme is set (undefined or 'default')
            const useSemanticBooleanColors =
                isBoolean &&
                (!this.chartConfig.colorScheme || this.chartConfig.colorScheme === 'default')

            const backgroundColors = newPieData.labels.map((label, index) => {
                const color = useSemanticBooleanColors
                    ? getBooleanColor(label)
                    : colors[index % colors.length]!
                return getColorWithAlpha(color, 0.7)
            })
            const borderColors = newPieData.labels.map((label, index) => {
                return useSemanticBooleanColors
                    ? getBooleanColor(label)
                    : colors[index % colors.length]!
            })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js types don't fully reflect that colors can be arrays
            ;(dataset as any).backgroundColor = backgroundColors
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js types don't fully reflect that colors can be arrays
            ;(dataset as any).borderColor = borderColors
        }

        this.chart!.update()
    }

    /**
     * Incremental update for scatter charts
     */
    private updateScatterChart(data: VisualizationDataPoint[]): void {
        const newScatterData = sharedAggregationService.aggregateForScatterChart(
            data,
            this.propertyId,
            this.displayName
        )

        if (newScatterData.points.length === 0) {
            this.destroy()
            this.render(data)
            return
        }

        // Update stored data
        this.scatterChartData = newScatterData

        // Update chart data in place
        const dataset = this.chart!.data.datasets[0]
        if (dataset) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js scatter data type is different from cartesian
            ;(dataset as any).data = newScatterData.points
        }

        this.chart!.update()
    }

    /**
     * Incremental update for bubble charts
     */
    private updateBubbleChart(data: VisualizationDataPoint[]): void {
        const newBubbleData = sharedAggregationService.aggregateForBubbleChart(
            data,
            this.propertyId,
            this.displayName,
            this.chartConfig.granularity
        )

        if (newBubbleData.points.length === 0) {
            this.destroy()
            this.render(data)
            return
        }

        // Update stored data
        this.bubbleChartData = newBubbleData

        // Update chart data in place
        const dataset = this.chart!.data.datasets[0]
        if (dataset) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.js bubble data type is different from cartesian
            ;(dataset as any).data = newBubbleData.points
        }

        this.chart!.update()
    }

    /**
     * Incremental update for cartesian and radar charts
     */
    private updateCartesianChart(data: VisualizationDataPoint[]): void {
        // Check if data contains list values
        const hasListValues = sharedAggregationService.hasListData(data)

        let newChartData: ChartData
        if (hasListValues && this.isCartesianType()) {
            newChartData = sharedAggregationService.aggregateListForChart(
                data,
                this.propertyId,
                this.displayName,
                this.chartConfig.granularity
            )
        } else {
            newChartData = sharedAggregationService.aggregateForChart(
                data,
                this.propertyId,
                this.displayName,
                this.chartConfig.granularity
            )
        }

        if (newChartData.labels.length === 0) {
            this.destroy()
            this.render(data)
            return
        }

        // Check if structure changed (different number of datasets) - need full re-render
        const currentDatasetCount = this.chart!.data.datasets.length
        const newDatasetCount = newChartData.datasets.length
        if (currentDatasetCount !== newDatasetCount) {
            this.destroy()
            this.render(data)
            return
        }

        // Update stored data
        this.chartData = newChartData

        // Update chart data in place
        this.chart!.data.labels = newChartData.labels

        // Update all datasets (supports multiple datasets for list data)
        for (let i = 0; i < newChartData.datasets.length; i++) {
            const newDataset = newChartData.datasets[i]
            const chartDataset = this.chart!.data.datasets[i]
            if (newDataset && chartDataset) {
                chartDataset.data = newDataset.data
                chartDataset.label = newDataset.label
            }
        }

        // Clear animation state since data changed
        this.originalData = []

        this.chart!.update()
    }

    /**
     * Handle container resize by resizing the chart
     */
    override handleResize(): void {
        if (this.chart && this.canvasEl && this.chartContainer) {
            // Clear explicit canvas dimensions (both styles and attributes)
            // to allow Chart.js to properly recalculate size
            this.canvasEl.style.width = ''
            this.canvasEl.style.height = ''
            this.canvasEl.removeAttribute('width')
            this.canvasEl.removeAttribute('height')

            // Use requestAnimationFrame to ensure layout is complete before resize
            requestAnimationFrame(() => {
                if (this.chart) {
                    this.chart.resize()
                }
            })
        }
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.stopAnimation()
        if (this.chart) {
            this.chart.destroy()
            this.chart = null
        }
        this.canvasEl = null
        this.chartContainer = null
        this.chartData = null
        this.pieChartData = null
        this.scatterChartData = null
        this.bubbleChartData = null
        this.originalData = []
    }

    /**
     * Chart.js supports animation (only for cartesian charts)
     */
    override supportsAnimation(): boolean {
        // Only line/bar/area charts support progressive animation well
        return (
            !this.isPieType() &&
            !this.isScatterType() &&
            !this.isBubbleType() &&
            this.chartConfig.chartType !== 'radar'
        )
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
     * Handle chart click - open related files
     */
    private handleChartClick(elements: ChartClickElement[]): void {
        if (!this.chartData || elements.length === 0) return

        const element = elements[0]
        if (!element) return

        const dataset = this.chartData.datasets[element.datasetIndex]
        if (!dataset) return

        const filePaths = dataset.filePaths[element.index]
        if (filePaths && filePaths.length > 0) {
            this.openFilePaths(filePaths)
        }
    }

    /**
     * Handle pie chart click - open related files for the segment
     */
    private handlePieChartClick(elements: ChartClickElement[]): void {
        if (!this.pieChartData || elements.length === 0) return

        const element = elements[0]
        if (!element) return

        const filePaths = this.pieChartData.filePaths[element.index]
        if (filePaths && filePaths.length > 0) {
            this.openFilePaths(filePaths)
        }
    }

    /**
     * Handle scatter chart click - open related file for the point
     */
    private handleScatterChartClick(elements: ChartClickElement[]): void {
        if (!this.scatterChartData || elements.length === 0) return

        const element = elements[0]
        if (!element) return

        const filePath = this.scatterChartData.filePaths[element.index]
        if (filePath) {
            this.openFileByPath(filePath)
        }
    }

    /**
     * Handle bubble chart click - open related files for the bubble
     */
    private handleBubbleChartClick(elements: ChartClickElement[]): void {
        if (!this.bubbleChartData || elements.length === 0) return

        const element = elements[0]
        if (!element) return

        const filePaths = this.bubbleChartData.filePaths[element.index]
        if (filePaths && filePaths.length > 0) {
            this.openFilePaths(filePaths)
        }
    }
}
