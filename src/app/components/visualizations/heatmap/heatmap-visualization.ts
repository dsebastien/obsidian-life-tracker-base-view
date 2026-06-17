import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import { TimeGranularity } from '../../../types'
import type {
    ExportTable,
    HeatmapConfig,
    HeatmapData,
    VisualizationDataPoint
} from '../../../types'
import { sharedAggregationService } from '../../../services/data-aggregation.service'
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
 * Streak unit label per granularity (singular form)
 */
const GRANULARITY_UNIT: Record<TimeGranularity, string> = {
    [TimeGranularity.Daily]: 'day',
    [TimeGranularity.Weekly]: 'week',
    [TimeGranularity.Monthly]: 'month',
    [TimeGranularity.Quarterly]: 'quarter',
    [TimeGranularity.Yearly]: 'year'
}

/**
 * GitHub-contribution-style heatmap visualization
 */
export class HeatmapVisualization extends BaseVisualization {
    private heatmapConfig: HeatmapConfig
    private tooltip: Tooltip | null = null
    private gridEl: HTMLElement | null = null
    private streaksEl: HTMLElement | null = null
    private heatmapData: HeatmapData | null = null
    private pendingScrollFrame: number | null = null

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
            this.heatmapConfig.granularity,
            this.heatmapConfig.aggregationMethod
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

        // Only the grid scrolls horizontally. Rows outside the scroll
        // element (like the legend) stay visible regardless of the scroll
        // position — the auto scroll-to-end below was pushing them out of
        // view to the left.
        const scrollEl = heatmapEl.createDiv({ cls: 'lt-heatmap-scroll' })

        // Render the grid
        this.gridEl = renderHeatmapGrid(scrollEl, this.heatmapData, this.heatmapConfig)

        // Add event listeners
        this.addEventListeners()

        // Create legend (outside the scroll element so it is always visible)
        this.createLegend(heatmapEl)

        // Create streak stats row (issue #100), also outside the scroll
        // element so it stays visible at any scroll position
        this.streaksEl = heatmapEl.createDiv({ cls: 'lt-heatmap-streaks' })
        this.renderStreakStats()

        // Scroll horizontally to the end so the freshest data is visible.
        // Defer to next frame so the browser has computed layout/scrollWidth.
        this.scrollToEnd(scrollEl)
    }

    /**
     * Scroll the heatmap container horizontally to its end so the most recent
     * data is in view when the visualization first appears.
     */
    private scrollToEnd(scrollEl: HTMLElement): void {
        if (this.pendingScrollFrame !== null) {
            window.cancelAnimationFrame(this.pendingScrollFrame)
        }
        this.pendingScrollFrame = window.requestAnimationFrame(() => {
            this.pendingScrollFrame = null
            scrollEl.scrollLeft = scrollEl.scrollWidth
        })
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
            this.heatmapConfig.granularity,
            this.heatmapConfig.aggregationMethod
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

        // Refresh streak stats (cells changed, so streaks may have too)
        this.renderStreakStats()
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
            case TimeGranularity.Daily:
            case TimeGranularity.Weekly:
                // Check if min/max are within same week range
                return isSameMonth(oldMin, newMin) && isSameMonth(oldMax, newMax)
            case TimeGranularity.Monthly:
            case TimeGranularity.Quarterly:
                // Check if within same year range
                return isSameYear(oldMin, newMin) && isSameYear(oldMax, newMax)
            case TimeGranularity.Yearly:
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
     * Tabular view of the currently rendered heatmap cells (issue #102)
     */
    override getExportData(): ExportTable | null {
        if (!this.heatmapData) return null
        return {
            headers: ['Date', 'Value', 'Entries'],
            rows: this.heatmapData.cells.map((cell) => [
                formatDateISO(cell.date),
                cell.value,
                cell.count
            ])
        }
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        if (this.pendingScrollFrame !== null) {
            window.cancelAnimationFrame(this.pendingScrollFrame)
            this.pendingScrollFrame = null
        }
        this.tooltip?.destroy()
        this.tooltip = null
        this.gridEl = null
        this.streaksEl = null
        this.heatmapData = null
    }

    /**
     * Render the streak stats row below the legend.
     * Idempotent: clears and re-renders into the existing element.
     */
    private renderStreakStats(): void {
        if (!this.streaksEl || !this.heatmapData) return

        this.streaksEl.empty()

        // Toggleable via the "Show streak stats" view option
        if (this.heatmapConfig.showStreakInfo === false) return

        const { currentStreak, longestStreak, activeCount } = this.heatmapData.streaks
        if (activeCount === 0) return

        const unit = GRANULARITY_UNIT[this.heatmapData.granularity]
        const withUnit = (n: number): string => `${n} ${unit}${n === 1 ? '' : 's'}`

        this.streaksEl.createSpan({
            cls: 'lt-heatmap-streaks-item',
            text: `Streak: ${withUnit(currentStreak)}`
        })
        this.streaksEl.createSpan({
            cls: 'lt-heatmap-streaks-item',
            text: `Best: ${withUnit(longestStreak)}`
        })
        this.streaksEl.createSpan({
            cls: 'lt-heatmap-streaks-item',
            text: `Active: ${activeCount}`
        })
    }

    /**
     * Add event listeners to heatmap cells
     */
    private addEventListeners(): void {
        if (!this.gridEl || !this.heatmapData) return

        const cells = this.gridEl.querySelectorAll(CSS_SELECTOR.HEATMAP_CELL)

        cells.forEach((cell, index) => {
            const cellEl = cell as HTMLElement

            // Hover events
            cellEl.addEventListener('mouseenter', (e) => this.handleCellHover(e, cellEl))
            cellEl.addEventListener('mouseleave', () => this.handleCellLeave())

            // Click event
            cellEl.addEventListener('click', () => this.handleCellClick(cellEl))

            // Keyboard access (issue #110): roving tabindex — the first cell
            // is the Tab stop, arrows move focus, Enter/Space opens the
            // entries, and focusing shows the tooltip
            cellEl.tabIndex = index === 0 ? 0 : -1
            cellEl.setAttribute('role', 'button')
            const label = this.formatCellTooltip(cellEl)
            if (label) {
                cellEl.setAttribute(
                    'aria-label',
                    `${label.title}${label.value ? `: ${label.value}` : ''}`
                )
            }
            cellEl.addEventListener('focus', () => this.handleCellFocus(cellEl))
            cellEl.addEventListener('blur', () => this.handleCellLeave())
            cellEl.addEventListener('keydown', (e) => this.handleCellKeydown(e, cellEl))
        })
    }

    /**
     * Build tooltip content for a cell from its data attributes.
     * Returns null when the cell has no date.
     */
    private formatCellTooltip(
        cellEl: HTMLElement
    ): { title: string; value?: string; subtitle?: string } | null {
        if (!this.heatmapData) return null

        const dateStr = cellEl.dataset['date']
        if (!dateStr) return null

        const valueStr = cellEl.dataset['value']
        const countStr = cellEl.dataset['count']
        const date = parseISO(dateStr)
        const value = valueStr ? parseFloat(valueStr) : null
        const count = countStr ? parseInt(countStr, 10) : 0

        return formatHeatmapTooltip(
            date,
            value,
            count,
            this.displayName,
            this.heatmapConfig.granularity
        )
    }

    /**
     * Handle cell hover - show tooltip
     */
    private handleCellHover(event: MouseEvent, cellEl: HTMLElement): void {
        if (!this.tooltip) return

        const content = this.formatCellTooltip(cellEl)
        if (!content) return

        // Position tooltip above the mouse cursor
        this.tooltip.show(
            event.clientX,
            event.clientY - 10,
            content.title,
            content.value,
            content.subtitle
        )
    }

    /**
     * Handle cell focus - show tooltip anchored to the cell (keyboard access)
     */
    private handleCellFocus(cellEl: HTMLElement): void {
        if (!this.tooltip) return

        const content = this.formatCellTooltip(cellEl)
        if (!content) return

        const rect = cellEl.getBoundingClientRect()
        this.tooltip.show(
            rect.left + rect.width / 2,
            rect.top - 10,
            content.title,
            content.value,
            content.subtitle
        )
    }

    /**
     * Keyboard navigation between heatmap cells (issue #110)
     */
    private handleCellKeydown(event: KeyboardEvent, cellEl: HTMLElement): void {
        if (!this.gridEl) return

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.handleCellClick(cellEl)
            return
        }

        const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        if (!backward && !forward) return
        event.preventDefault()

        const cells = Array.from(
            this.gridEl.querySelectorAll<HTMLElement>(CSS_SELECTOR.HEATMAP_CELL)
        )
        const index = cells.indexOf(cellEl)
        const next = cells[backward ? index - 1 : index + 1]
        if (!next) return

        cellEl.tabIndex = -1
        next.tabIndex = 0
        next.focus()
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
