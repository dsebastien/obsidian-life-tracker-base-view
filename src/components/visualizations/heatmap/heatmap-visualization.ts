import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    HeatmapConfig,
    HeatmapData,
    VisualizationDataPoint
} from '../../../app/types/visualization.types'
import { DataAggregationService } from '../../../app/services/data-aggregation.service'
import { Tooltip, formatHeatmapTooltip } from '../../ui/tooltip'
import { renderHeatmapGrid } from './heatmap-renderer'
import { parseISO, isSameDay } from 'date-fns'
import { log } from '../../../utils/log'

/**
 * GitHub-contribution-style heatmap visualization
 */
export class HeatmapVisualization extends BaseVisualization {
    private heatmapConfig: HeatmapConfig
    private aggregationService: DataAggregationService
    private tooltip: Tooltip | null = null
    private gridEl: HTMLElement | null = null
    private heatmapData: HeatmapData | null = null

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: HeatmapConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.heatmapConfig = config
        this.aggregationService = new DataAggregationService()
    }

    /**
     * Render the heatmap with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering heatmap for ${this.displayName}`, 'debug')

        // Aggregate data
        this.heatmapData = this.aggregationService.aggregateForHeatmap(
            data,
            this.propertyId,
            this.displayName,
            this.heatmapConfig.granularity,
            this.heatmapConfig.showEmptyDates
        )

        // Apply scale override if configured
        if (this.heatmapConfig.scale) {
            if (this.heatmapConfig.scale.min !== null) {
                this.heatmapData.minValue = this.heatmapConfig.scale.min
            }
            if (this.heatmapConfig.scale.max !== null) {
                this.heatmapData.maxValue = this.heatmapConfig.scale.max
            }
        }

        if (this.heatmapData.cells.length === 0) {
            this.showEmptyState(`No data with dates found for "${this.displayName}"`)
            return
        }

        // Clear container
        this.containerEl.empty()

        // Create section header
        this.createSectionHeader(this.displayName)

        // Create heatmap container
        const heatmapEl = this.containerEl.createDiv({ cls: 'lt-heatmap' })

        // Create tooltip
        this.tooltip = new Tooltip(heatmapEl)

        // Render the grid
        this.gridEl = renderHeatmapGrid(heatmapEl, this.heatmapData, this.heatmapConfig)

        // Add event listeners
        this.addEventListeners()

        // Create legend
        this.createLegend(heatmapEl)
    }

    /**
     * Update the heatmap with new data
     */
    override update(data: VisualizationDataPoint[]): void {
        // Re-render for simplicity
        this.render(data)
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.tooltip?.destroy()
        this.tooltip = null
        this.gridEl = null
        this.heatmapData = null
    }

    /**
     * Add event listeners to heatmap cells
     */
    private addEventListeners(): void {
        if (!this.gridEl || !this.heatmapData) return

        const cells = this.gridEl.querySelectorAll('.lt-heatmap-cell')

        cells.forEach((cell) => {
            const cellEl = cell as HTMLElement

            // Hover events
            cellEl.addEventListener('mouseenter', (e) => this.handleCellHover(e, cellEl))
            cellEl.addEventListener('mouseleave', () => this.handleCellLeave())

            // Click event
            cellEl.addEventListener('click', () => this.handleCellClick(cellEl))
        })
    }

    /**
     * Handle cell hover - show tooltip
     */
    private handleCellHover(_event: MouseEvent, cellEl: HTMLElement): void {
        if (!this.tooltip || !this.heatmapData) return

        const dateStr = cellEl.dataset['date']
        const valueStr = cellEl.dataset['value']
        const countStr = cellEl.dataset['count']

        if (!dateStr) return

        const date = parseISO(dateStr)
        const value = valueStr ? parseFloat(valueStr) : null
        const count = countStr ? parseInt(countStr, 10) : 0

        const {
            title,
            value: tooltipValue,
            subtitle
        } = formatHeatmapTooltip(
            date,
            value,
            count,
            this.displayName,
            this.heatmapConfig.granularity
        )

        // Position tooltip near cursor
        const rect = cellEl.getBoundingClientRect()
        this.tooltip.show(rect.left + rect.width / 2, rect.top - 10, title, tooltipValue, subtitle)
    }

    /**
     * Handle cell leave - hide tooltip
     */
    private handleCellLeave(): void {
        this.tooltip?.hide()
    }

    /**
     * Handle cell click - open related entries
     */
    private handleCellClick(cellEl: HTMLElement): void {
        if (!this.heatmapData) return

        const dateStr = cellEl.dataset['date']
        if (!dateStr) return

        const date = parseISO(dateStr)

        // Find entries for this date
        const cell = this.heatmapData.cells.find((c) => isSameDay(c.date, date))

        if (cell && cell.entries.length > 0) {
            this.openEntries(cell.entries)
        }
    }

    /**
     * Create heatmap legend
     */
    private createLegend(container: HTMLElement): void {
        const legend = container.createDiv({ cls: 'lt-heatmap-legend' })

        legend.createSpan({ text: 'Less' })

        // Create color boxes
        for (let i = 0; i <= 4; i++) {
            const box = legend.createDiv({
                cls: `lt-heatmap-cell lt-heatmap-cell--level-${i}`
            })
            box.style.width = `${this.heatmapConfig.cellSize}px`
            box.style.height = `${this.heatmapConfig.cellSize}px`
        }

        legend.createSpan({ text: 'More' })
    }
}
