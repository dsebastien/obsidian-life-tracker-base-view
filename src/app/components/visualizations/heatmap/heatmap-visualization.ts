import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type { HeatmapConfig, HeatmapData, VisualizationDataPoint } from '../../../types'
import { DataAggregationService } from '../../../services/data-aggregation.service'
import { Tooltip, formatHeatmapTooltip } from '../../ui/tooltip'
import { renderHeatmapGrid } from './heatmap-renderer'
import { parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns'
import {
    log,
    CSS_SELECTOR,
    applyHeatmapColorScheme,
    formatDateISO,
    getColorLevelForValue
} from '../../../../utils'

/**
 * Shared aggregation service instance for all heatmap visualizations
 */
const sharedAggregationService = new DataAggregationService()

/**
 * GitHub-contribution-style heatmap visualization
 */
export class HeatmapVisualization extends BaseVisualization {
    private heatmapConfig: HeatmapConfig
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
    }

    /**
     * Render the heatmap with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering heatmap for ${this.displayName}`, 'debug')

        log('Heatmap data', 'debug', data)

        // Aggregate data (use shared service)
        // Data is already pre-filtered based on showEmptyValues
        this.heatmapData = sharedAggregationService.aggregateForHeatmap(
            data,
            this.propertyId,
            this.displayName,
            this.heatmapConfig.granularity
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

        // Apply color scheme CSS variables
        this.applyColorScheme(heatmapEl)

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
     * Update the heatmap with new data using in-place cell updates when possible
     */
    override update(data: VisualizationDataPoint[]): void {
        // If no grid exists, do a full render
        if (!this.gridEl || !this.heatmapData) {
            this.render(data)
            return
        }

        // Re-aggregate data (data is already pre-filtered based on showEmptyValues)
        const newData = sharedAggregationService.aggregateForHeatmap(
            data,
            this.propertyId,
            this.displayName,
            this.heatmapConfig.granularity
        )

        // Apply scale override if configured
        if (this.heatmapConfig.scale) {
            if (this.heatmapConfig.scale.min !== null) {
                newData.minValue = this.heatmapConfig.scale.min
            }
            if (this.heatmapConfig.scale.max !== null) {
                newData.maxValue = this.heatmapConfig.scale.max
            }
        }

        // If date range changed significantly, do a full re-render
        if (!this.canUpdateInPlace(newData)) {
            this.render(data)
            return
        }

        // Update cells in place
        this.updateCellsInPlace(newData)

        // Update stored data
        this.heatmapData = newData
    }

    /**
     * Check if we can update cells in place without re-rendering the entire grid
     * Returns false if date range changed (which would require structural changes)
     */
    private canUpdateInPlace(newData: HeatmapData): boolean {
        if (!this.heatmapData) return false

        // For daily/weekly granularity, check if the week range is the same
        // For monthly/quarterly/yearly, check if the year range is the same
        const oldMin = this.heatmapData.minDate
        const oldMax = this.heatmapData.maxDate
        const newMin = newData.minDate
        const newMax = newData.maxDate

        switch (this.heatmapConfig.granularity) {
            case 'daily':
            case 'weekly':
                // Check if min/max are within same week range
                return isSameMonth(oldMin, newMin) && isSameMonth(oldMax, newMax)
            case 'monthly':
            case 'quarterly':
                // Check if within same year range
                return isSameYear(oldMin, newMin) && isSameYear(oldMax, newMax)
            case 'yearly':
                // For yearly, only re-render if years changed
                return (
                    oldMin.getFullYear() === newMin.getFullYear() &&
                    oldMax.getFullYear() === newMax.getFullYear()
                )
            default:
                return false
        }
    }

    /**
     * Update existing cells in place with new data
     */
    private updateCellsInPlace(newData: HeatmapData): void {
        if (!this.gridEl) return

        // Build a map of new cell data by date string for O(1) lookup
        const newCellMap = new Map<string, { value: number | null; count: number }>()
        for (const cell of newData.cells) {
            const key = formatDateISO(cell.date)
            newCellMap.set(key, { value: cell.value, count: cell.count })
        }

        // Query all existing cells
        const cells = this.gridEl.querySelectorAll(CSS_SELECTOR.HEATMAP_CELL)

        cells.forEach((cell) => {
            const cellEl = cell as HTMLElement
            const dateStr = cellEl.dataset['date']
            if (!dateStr) return

            const newCellData = newCellMap.get(dateStr)

            // Remove all level classes
            for (let i = 0; i <= 4; i++) {
                cellEl.classList.remove(`lt-heatmap-cell--level-${i}`)
            }
            cellEl.classList.remove('lt-heatmap-cell--has-data')

            // Update cell data
            if (newCellData) {
                const level = getColorLevelForValue(
                    newCellData.value,
                    newData.minValue,
                    newData.maxValue
                )
                cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

                if (newCellData.value !== null) {
                    cellEl.dataset['value'] = String(newCellData.value)
                } else {
                    delete cellEl.dataset['value']
                }

                cellEl.dataset['count'] = String(newCellData.count)

                if (newCellData.count > 0) {
                    cellEl.classList.add('lt-heatmap-cell--has-data')
                }
            } else {
                // No data for this cell
                cellEl.classList.add('lt-heatmap-cell--level-0')
                delete cellEl.dataset['value']
                cellEl.dataset['count'] = '0'
            }
        })
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

        const cells = this.gridEl.querySelectorAll(CSS_SELECTOR.HEATMAP_CELL)

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
     * Handle cell click - open related files
     */
    private handleCellClick(cellEl: HTMLElement): void {
        if (!this.heatmapData) return

        const dateStr = cellEl.dataset['date']
        if (!dateStr) return

        const date = parseISO(dateStr)

        // Find file paths for this date
        const cell = this.heatmapData.cells.find((c) => isSameDay(c.date, date))

        if (cell && cell.filePaths.length > 0) {
            this.openFilePaths(cell.filePaths)
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

    /**
     * Apply color scheme CSS variables to the heatmap container
     */
    private applyColorScheme(container: HTMLElement): void {
        const { colorScheme } = this.heatmapConfig
        if (!colorScheme) return

        applyHeatmapColorScheme(container, colorScheme)
    }
}
