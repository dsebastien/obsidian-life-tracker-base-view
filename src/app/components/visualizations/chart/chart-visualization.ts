import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import { TouchNavigationGate } from '../touch-navigation'
import type {
    BubbleChartData,
    ChartConfig,
    ChartData,
    ExportTable,
    PieChartData,
    ReferenceLineConfig,
    ScatterChartData,
    VisualizationDataPoint
} from '../../../types'
import { sharedAggregationService } from '../../../services/data-aggregation.service'
import { ChartLoaderService } from '../../../services/chart-loader.service'
import {
    log,
    getBooleanColor,
    getChartColorScheme,
    getColorWithAlpha,
    resolveTrendSentiment,
    describeTrendSentiment
} from '../../../../utils'
import type { ChartClickElement, ChartInstance } from './chart-types'
import {
    initBubbleChart,
    initCartesianChart,
    initPieChart,
    initRadarChart,
    initScatterChart
} from './chart-initializers'
import {
    computeMovingAverage,
    computeRunningTotal,
    computeTrend
} from '../../../services/chart-aggregation.utils'
import { buildCartesianReferenceLines } from './reference-lines.utils'

/**
 * Chart.js-based visualization for line and bar charts
 */
export class ChartVisualization extends BaseVisualization {
    private chartConfig: ChartConfig
    private chart: ChartInstance | null = null
    private canvasEl: HTMLCanvasElement | null = null
    /**
     * Tap-to-inspect gate: on touch screens the first tap on a point shows its
     * tooltip and only a second tap opens the note (issue #154)
     */
    private readonly touchNavigation = new TouchNavigationGate()
    private chartData: ChartData | null = null
    private pieChartData: PieChartData | null = null
    private scatterChartData: ScatterChartData | null = null
    private bubbleChartData: BubbleChartData | null = null
    private chartContainer: HTMLElement | null = null
    private trendStatsEl: HTMLElement | null = null
    /**
     * Per-period values kept aside when a running total replaces the plotted
     * series, so the trend row still describes the rate (issue #142). Null
     * whenever the running total is off, in which case the plotted series is
     * already the per-period one.
     */
    private trendSourceData: (number | null)[] | null = null
    /**
     * Whether the rendered chart came from list aggregation. Dataset *count* is
     * not enough to decide the incremental path is safe: a numeric series with a
     * moving average and a list property with two values both produce two
     * datasets, but the second one means different things (a dashed average vs a
     * value's presence), so swapping only data and labels would keep the wrong
     * styling.
     */
    private renderedListAggregation = false
    private originalData: (number | null)[][] = []
    private animationInterval: number | null = null
    private currentAnimationIndex: number = 0
    private overlayReferenceLines?: Record<BasesPropertyId, ReferenceLineConfig>

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: ChartConfig,
        overlayReferenceLines?: Record<BasesPropertyId, ReferenceLineConfig>
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.chartConfig = config
        this.overlayReferenceLines = overlayReferenceLines
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
        // A previous chart (if any) is bound to a canvas this render is
        // about to remove — destroy it so its listeners die with it
        this.disposeChart()

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
                this.chartConfig.granularity,
                this.chartConfig.aggregationMethod
            )

            if (this.bubbleChartData.points.length === 0) {
                this.showEmptyState(`No numeric data with dates found for "${this.displayName}"`)
                return
            }
        } else {
            // For cartesian charts, check if data contains list values
            const hasListValues = sharedAggregationService.hasListData(data)
            this.renderedListAggregation = hasListValues && this.isCartesianType()

            if (hasListValues && this.isCartesianType()) {
                // Use list aggregation: creates one dataset per unique value with 0/1 presence
                // This path applies no running total, so drop any stash from a
                // previous numeric render rather than leaving it to be read
                // against a differently shaped dataset.
                this.trendSourceData = null
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
                    this.chartConfig.granularity,
                    this.chartConfig.aggregationMethod
                )

                // Accumulate before overlaying (issue #142): the moving average
                // is taken over whichever series is plotted.
                this.applyRunningTotal(this.chartData)

                // Append the moving-average overlay when configured (issue #101)
                this.applyMovingAverage(this.chartData)
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

        // The canvas is sized by `.lt-chart`, which is relatively positioned and
        // dedicated to it; the canvas itself is out of flow (issue #144).
        this.canvasEl = this.chartContainer.createEl('canvas', { cls: 'lt-chart-canvas' })
        this.touchNavigation.observe(this.canvasEl)

        // Trend arrow in the title + trend row below the chart (issue #101)
        this.trendStatsEl = this.containerEl.createDiv({ cls: 'lt-chart-trend' })
        this.renderTrendInfo()

        // Initialize chart (async, errors handled internally)
        void this.initChart()
    }

    /**
     * Replace the plotted values with their cumulative total (issue #142).
     * Runs before `applyMovingAverage`, so a moving average is taken over the
     * series that actually ends up on the chart.
     *
     * The label gains a suffix: the series no longer means what the bare
     * property name says, and this label is what both the legend and the CSV
     * export show.
     */
    private applyRunningTotal(chartData: ChartData): void {
        this.trendSourceData = null
        if (!this.chartConfig.runningTotal) return

        const source = chartData.datasets[0]
        if (!source) return

        // Keep the per-period values for the trend row. A cumulative series
        // rises by construction whenever the data is positive, so a trend taken
        // over it would report the arithmetic of accumulating rather than any
        // change in behavior: a steady 10 pages a period becomes 10, 20, 30, 40
        // and "reads" as +133%. The rate is what the arrow is meant to convey.
        this.trendSourceData = [...source.data]

        source.data = computeRunningTotal(source.data)
        source.label = `${source.label} (running total)`
    }

    /**
     * Append the configured moving-average dataset (issue #101).
     * Only applies to single-dataset numeric charts: list data and overlays
     * already carry multiple datasets.
     */
    private applyMovingAverage(chartData: ChartData): void {
        const period = this.chartConfig.movingAveragePeriod
        if (!period || period < 2) return
        if (chartData.datasets.length !== 1) return

        const source = chartData.datasets[0]
        if (!source) return

        chartData.datasets.push({
            label: `${period}-period average`,
            data: computeMovingAverage(source.data, period),
            filePaths: chartData.labels.map(() => []),
            isMovingAverage: true
        })
    }

    /**
     * Render the trend arrow and the trend row (issue #101).
     * The arrow lives inside the section title so the play/maximize buttons
     * never shift; the row below the chart mirrors the heatmap streak row.
     * Idempotent; only shown for single-dataset cartesian charts with
     * enough data to compare two windows, and toggleable via the
     * "Show trend" view option.
     */
    private renderTrendInfo(): void {
        const titleEl = this.containerEl.querySelector<HTMLElement>('.lt-section-title')
        titleEl?.querySelector('.lt-trend-indicator')?.remove()
        this.trendStatsEl?.empty()

        if (this.chartConfig.showTrendInfo === false) return
        if (!this.chartData || !this.isCartesianType()) return

        const sources = this.chartData.datasets.filter((d) => !d.isMovingAverage)
        const source = sources[0]
        if (!source || sources.length !== 1) return

        // With a running total, trend on the per-period values, not the
        // cumulative ones (see applyRunningTotal). Say so in the label: next
        // to an ever-rising cumulative line, a bare "Trend: ↓" reads as a
        // contradiction (issue #149) — it describes the per-period rate.
        const isPerPeriodRate = this.trendSourceData !== null
        const trendLabel = isPerPeriodRate ? 'Per-period trend' : 'Trend'
        const trend = computeTrend(this.trendSourceData ?? source.data)
        if (!trend) return

        const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'
        const sign = trend.changePercent > 0 ? '+' : ''

        // Whether the move is good or bad depends entirely on the property
        // (issue #21): rising mood is an improvement, rising cigarettes is not.
        // Without a configured polarity this stays neutral, as before.
        const polarity = this.chartConfig.polarity
        const sentiment = resolveTrendSentiment(trend.direction, polarity)
        const wording = describeTrendSentiment(trend.direction, polarity)

        const description = `${wording}, ${sign}${trend.changePercent.toFixed(1)}% vs previous ${trend.periodCount} ${
            trend.periodCount === 1 ? 'period' : 'periods'
        }`

        // Arrow inside the title: the header is justify-between, so a
        // sibling element would push the action buttons around. Only
        // `aria-label` — Obsidian renders it as its styled tooltip.
        titleEl?.createSpan({
            cls: `lt-trend-indicator lt-trend-indicator--${trend.direction} lt-trend-indicator--${sentiment}`,
            text: arrow,
            attr: { 'aria-label': `${trendLabel}: ${description}` }
        })

        // Trend row below the chart, same style as the heatmap streak row.
        // The sentiment class colors this too, so the meaning is not carried by
        // the arrow's color alone (which colorblind users may not resolve).
        this.trendStatsEl?.createSpan({
            cls: `lt-chart-trend-item lt-chart-trend-item--${sentiment}`,
            text:
                sentiment === 'neutral'
                    ? `${trendLabel}: ${arrow} ${sign}${trend.changePercent.toFixed(1)}%`
                    : `${trendLabel}: ${arrow} ${sign}${trend.changePercent.toFixed(1)}% (${wording})`
        })
        this.trendStatsEl?.createSpan({
            cls: 'lt-chart-trend-item',
            text: `vs previous ${trend.periodCount} ${
                trend.periodCount === 1 ? 'period' : 'periods'
            }`
        })
    }

    /**
     * Render the chart with pre-aggregated chart data (used for overlay charts)
     */
    renderChartData(data: ChartData): void {
        // A previous chart (if any) is bound to a canvas this render is
        // about to remove — destroy it so its listeners die with it
        this.disposeChart()

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

        // The canvas is sized by `.lt-chart`, which is relatively positioned and
        // dedicated to it; the canvas itself is out of flow (issue #144).
        this.canvasEl = this.chartContainer.createEl('canvas', { cls: 'lt-chart-canvas' })
        this.touchNavigation.observe(this.canvasEl)

        // Initialize chart (async, errors handled internally)
        void this.initChart()
    }

    /**
     * Initialize Chart.js
     */
    private async initChart(): Promise<void> {
        const canvas = this.canvasEl
        if (!canvas) return

        // Check we have appropriate data for the chart type
        if (this.isPieType() && !this.pieChartData) return
        if (this.isScatterType() && !this.scatterChartData) return
        if (this.isBubbleType() && !this.bubbleChartData) return
        if (!this.isPieType() && !this.isScatterType() && !this.isBubbleType() && !this.chartData)
            return

        try {
            // Use ChartLoaderService for efficient loading (registers only once)
            const { Chart } = await ChartLoaderService.getChartJs()

            // The await can outlive this render: a config change can trigger
            // another render (new canvas) or destroy() before we resume. A
            // stale init must abort — it would otherwise create a chart
            // nobody manages, leaving live Chart.js listeners on a chart
            // that later gets destroyed under their feet (clipArea crash on
            // a nulled context) or fighting the current chart for the canvas.
            if (this.canvasEl !== canvas || !canvas.isConnected) return

            // Replace any previous chart instance before binding a new one
            this.disposeChart()

            const ctx = canvas.getContext('2d')
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
                // Every horizontal line this chart draws: explicit reference
                // line, goal target, and overlay per-property lines. Both the
                // reference line and the target render when both are set
                // (issue #156)
                const referenceLines = buildCartesianReferenceLines(
                    this.chartConfig,
                    this.overlayReferenceLines,
                    this.chartData.datasets
                )

                this.chart = initCartesianChart(
                    Chart,
                    ctx,
                    this.chartData,
                    this.chartConfig,
                    (elements) => this.handleChartClick(elements),
                    referenceLines
                )
            }
        } catch (error) {
            log('Failed to initialize Chart.js', 'error', error)
            // Only report on the current render: a stale init failing must
            // not wipe out the chart that replaced it
            if (this.canvasEl === canvas) {
                this.showEmptyState('Failed to load chart library')
            }
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
            dataset.backgroundColor = backgroundColors
            dataset.borderColor = borderColors
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
            dataset.data = newScatterData.points
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
            this.chartConfig.granularity,
            this.chartConfig.aggregationMethod
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
            dataset.data = newBubbleData.points
        }

        this.chart!.update()
    }

    /**
     * Incremental update for cartesian and radar charts
     */
    private updateCartesianChart(data: VisualizationDataPoint[]): void {
        // Check if data contains list values
        const hasListValues = sharedAggregationService.hasListData(data)

        // A property that flips between numeric and list values changes what the
        // datasets mean, not just how many there are, so the in-place update is
        // unsafe even when the counts happen to match.
        if ((hasListValues && this.isCartesianType()) !== this.renderedListAggregation) {
            this.destroy()
            this.render(data)
            return
        }

        let newChartData: ChartData
        if (hasListValues && this.isCartesianType()) {
            // No running total on this path — see the same reset in render().
            this.trendSourceData = null
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
                this.chartConfig.granularity,
                this.chartConfig.aggregationMethod
            )

            // Same order as the initial render (issue #142)
            this.applyRunningTotal(newChartData)

            // Keep the moving-average overlay in sync (issue #101). A
            // dataset-count change (toggling the option) falls through to
            // the full re-render below.
            this.applyMovingAverage(newChartData)
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

        // Trend may have changed with the data (issue #101)
        this.renderTrendInfo()
    }

    /**
     * Handle container resize by resizing the chart
     */
    override handleResize(): void {
        if (this.chart && this.canvasEl && this.chartContainer) {
            // Clear explicit canvas dimensions (both styles and attributes)
            // to allow Chart.js to properly recalculate size
            this.canvasEl.style.removeProperty('width')
            this.canvasEl.style.removeProperty('height')
            this.canvasEl.removeAttribute('width')
            this.canvasEl.removeAttribute('height')

            // Use requestAnimationFrame to ensure layout is complete before resize
            window.requestAnimationFrame(() => {
                if (this.chart) {
                    this.chart.resize()
                }
            })
        }
    }

    /**
     * PNG data URL of the chart canvas in its current state (issue #102)
     */
    getImageDataUrl(): string | null {
        return this.chart ? this.chart.toBase64Image() : null
    }

    /**
     * Tabular view of the currently rendered chart data (issue #102)
     */
    override getExportData(): ExportTable | null {
        if (this.pieChartData) {
            const data = this.pieChartData
            return {
                headers: ['Label', 'Count'],
                rows: data.labels.map((label, i) => [label, data.values[i] ?? null])
            }
        }

        if (this.scatterChartData) {
            return {
                headers: ['Time (% of range)', 'Value'],
                rows: this.scatterChartData.points.map((p) => [p.x, p.y])
            }
        }

        if (this.bubbleChartData) {
            return {
                headers: ['Time (% of range)', 'Value', 'Radius'],
                rows: this.bubbleChartData.points.map((p) => [p.x, p.y, p.r])
            }
        }

        if (this.chartData) {
            const data = this.chartData
            return {
                headers: ['Period', ...data.datasets.map((d) => d.label)],
                rows: data.labels.map((label, i) => [
                    label,
                    ...data.datasets.map((d) => d.data[i] ?? null)
                ])
            }
        }

        return null
    }

    /**
     * Clean up resources
     */
    /**
     * Stop any running animation and destroy the Chart.js instance,
     * removing its canvas listeners. Safe to call when no chart exists.
     */
    private disposeChart(): void {
        this.stopAnimation()
        if (this.chart) {
            this.chart.destroy()
            this.chart = null
        }
    }

    override destroy(): void {
        this.disposeChart()
        this.touchNavigation.dispose()
        this.canvasEl = null
        this.chartContainer = null
        this.trendStatsEl = null
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

        // Store original data if not already stored.
        // Animation is only ever triggered for cartesian/area chart types (see
        // `supportsAnimation` above), so every dataset.data here is `(number | null)[]`.
        if (this.originalData.length === 0) {
            this.originalData = this.chart.data.datasets.map((ds) => [
                ...(ds.data as (number | null)[])
            ])
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
        this.animationInterval = window.setInterval(() => {
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
            window.clearInterval(this.animationInterval)
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
            // On touch, the first tap only reveals the tooltip (issue #154)
            if (!this.touchNavigation.shouldNavigate(`${element.datasetIndex}:${element.index}`)) {
                return
            }
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
            if (!this.touchNavigation.shouldNavigate(`pie:${element.index}`)) {
                return
            }
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
            if (!this.touchNavigation.shouldNavigate(`scatter:${element.index}`)) {
                return
            }
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
            if (!this.touchNavigation.shouldNavigate(`bubble:${element.index}`)) {
                return
            }
            this.openFilePaths(filePaths)
        }
    }
}
