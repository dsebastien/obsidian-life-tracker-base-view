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
import { applyCellColor, renderHeatmapGrid } from './heatmap-renderer'
import { parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns'
import {
    log,
    CSS_SELECTOR,
    applyHeatmapColorScheme,
    formatDateISO,
    getEventElement,
    isDiscreteHeatmapScheme,
    setCssProps
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
    private scrollEl: HTMLElement | null = null
    private streaksEl: HTMLElement | null = null
    private heatmapData: HeatmapData | null = null
    private pendingScrollFrame: number | null = null
    /** Detach the delegated grid listeners (issue #104) */
    private detachListeners: (() => void) | null = null
    /** Detach the scroll-position tracker used by `handleResize` */
    private detachScrollTracking: (() => void) | null = null
    /** Whether the user is looking at the end (freshest data) of the heatmap */
    private wasScrolledToEnd = true

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
            // The empty state replaces the whole card content, so drop the
            // references and listeners of the grid it removes — otherwise a
            // later update() would patch a detached grid and the card would
            // stay stuck on the empty state
            this.releaseRenderedGrid()
            this.showEmptyState(`No data with dates found for "${this.displayName}"`)
            return
        }

        // Clear container
        this.containerEl.empty()
        this.releaseRenderedGrid()

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
        this.scrollEl = scrollEl
        // Fresh render starts pinned to the end (see scrollToEnd below)
        this.wasScrolledToEnd = true
        this.trackScrollPosition(scrollEl)

        // Render the grid
        this.gridEl = renderHeatmapGrid(scrollEl, this.heatmapData, this.heatmapConfig)

        // Make cells reachable, then wire one delegated listener set
        this.applyCellAccessibility()
        this.attachGridListeners()

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
     * Drop everything tied to a grid that is about to be (or has just been)
     * removed from the DOM: listeners, scroll tracking, tooltip and element
     * references. Safe to call repeatedly.
     */
    private releaseRenderedGrid(): void {
        this.detachListeners?.()
        this.detachScrollTracking?.()
        this.tooltip?.destroy()
        this.tooltip = null
        this.gridEl = null
        this.scrollEl = null
        this.streaksEl = null
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

        // Losing every value must fall back to the empty state: empty data
        // reports today as its min/max, which can pass canUpdateInPlace() and
        // leave a grid of blank cells behind
        if (newData.cells.length === 0) {
            this.render(data)
            return
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

        // Cell values changed, so their accessible labels did too
        this.applyCellAccessibility()

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

        const colorScheme = this.heatmapConfig.colorScheme
        const isDiscrete = isDiscreteHeatmapScheme(colorScheme)

        // Query all existing cells
        const cells = this.gridEl.querySelectorAll(CSS_SELECTOR.HEATMAP_CELL)

        cells.forEach((cell) => {
            const cellEl = cell as HTMLElement
            const dateStr = cellEl.dataset['date']
            if (!dateStr) return

            const newCellData = newCellMap.get(dateStr)

            // Reset both coloring mechanisms: the scheme (and so which one
            // applies) can have changed since the cell was rendered
            for (let i = 0; i <= 4; i++) {
                cellEl.classList.remove(`lt-heatmap-cell--level-${i}`)
            }
            cellEl.classList.remove('lt-heatmap-cell--has-data')
            if (!isDiscrete) {
                // Leaving an inline background behind would win over the level
                // class when switching from a discrete scheme back to a gradient
                setCssProps(cellEl, { backgroundColor: '' })
            }

            // Update cell data
            if (newCellData) {
                applyCellColor(
                    cellEl,
                    newCellData.value,
                    colorScheme,
                    newData.minValue,
                    newData.maxValue
                )

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
                applyCellColor(cellEl, null, colorScheme, newData.minValue, newData.maxValue)
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
        this.releaseRenderedGrid()
        this.heatmapData = null
    }

    /**
     * Keep the freshest data in view when the pane is resized (issue #104).
     * The grid is CSS-driven so nothing needs redrawing, but a narrower pane
     * shifts the scroll window: re-pin to the end when the user was already
     * looking at the end, and leave their position alone otherwise.
     *
     * "Was at the end" is tracked on scroll rather than measured here: by the
     * time a resize is observed the geometry has already changed, so measuring
     * now would report a large distance from the end and never re-pin.
     */
    override handleResize(): void {
        const scrollEl = this.scrollEl
        if (!scrollEl) return

        if (this.wasScrolledToEnd) {
            this.scrollToEnd(scrollEl)
        }
    }

    /**
     * Track whether the user is looking at the end of the heatmap, so a resize
     * can decide whether to re-pin (see `handleResize`).
     */
    private trackScrollPosition(scrollEl: HTMLElement): void {
        this.detachScrollTracking?.()

        const onScroll = (): void => {
            const distanceFromEnd =
                scrollEl.scrollWidth - scrollEl.clientWidth - scrollEl.scrollLeft
            // A cell plus its gap of slack still counts as "at the end"
            const slack = this.heatmapConfig.cellSize + this.heatmapConfig.cellGap
            this.wasScrolledToEnd = distanceFromEnd <= slack
        }

        scrollEl.addEventListener('scroll', onScroll)
        this.detachScrollTracking = (): void => {
            scrollEl.removeEventListener('scroll', onScroll)
            this.detachScrollTracking = null
        }
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
     * Make every cell reachable and described: roving tabindex — the first cell
     * is the Tab stop, arrows move focus, Enter/Space opens the entries
     * (issue #110).
     */
    private applyCellAccessibility(): void {
        if (!this.gridEl || !this.heatmapData) return

        const cells = this.gridEl.querySelectorAll<HTMLElement>(CSS_SELECTOR.HEATMAP_CELL)

        // Keep the current Tab stop where the user left it: an in-place data
        // update must not send keyboard focus back to the first cell
        const existingTabStop = Array.from(cells).findIndex((cellEl) => cellEl.tabIndex === 0)
        const tabStopIndex = existingTabStop === -1 ? 0 : existingTabStop

        cells.forEach((cellEl, index) => {
            cellEl.tabIndex = index === tabStopIndex ? 0 : -1
            cellEl.setAttribute('role', 'button')
            const label = this.formatCellTooltip(cellEl)
            if (label) {
                cellEl.setAttribute(
                    'aria-label',
                    `${label.title}${label.value ? `: ${label.value}` : ''}`
                )
            }
        })
    }

    /**
     * Wire cell interaction with a single delegated listener set on the grid
     * root (issue #104). Multi-year heatmaps have thousands of cells; attaching
     * six listeners to each one was both slow to build and never torn down.
     *
     * `mouseover`/`mouseout` and `focusin`/`focusout` are used instead of
     * `mouseenter`/`mouseleave` and `focus`/`blur` because only the former
     * bubble to the delegate.
     */
    private attachGridListeners(): void {
        const gridEl = this.gridEl
        if (!gridEl) return

        // Replace any previous binding (render() can run repeatedly)
        this.detachListeners?.()

        const cellFrom = (event: Event): HTMLElement | null => {
            // getEventElement, not `instanceof Element`: popout windows have
            // their own Element constructor (issue #104)
            const target = getEventElement(event.target)
            if (!target) return null
            const cell = target.closest<HTMLElement>(CSS_SELECTOR.HEATMAP_CELL)
            return cell && gridEl.contains(cell) ? cell : null
        }

        const onMouseOver = (event: MouseEvent): void => {
            const cell = cellFrom(event)
            if (cell) this.handleCellHover(event, cell)
        }
        const onMouseOut = (event: MouseEvent): void => {
            if (cellFrom(event)) this.handleCellLeave()
        }
        const onClick = (event: MouseEvent): void => {
            const cell = cellFrom(event)
            if (cell) this.handleCellClick(cell)
        }
        const onFocusIn = (event: FocusEvent): void => {
            const cell = cellFrom(event)
            if (cell) this.handleCellFocus(cell)
        }
        const onFocusOut = (event: FocusEvent): void => {
            if (cellFrom(event)) this.handleCellLeave()
        }
        const onKeyDown = (event: KeyboardEvent): void => {
            const cell = cellFrom(event)
            if (cell) this.handleCellKeydown(event, cell)
        }

        gridEl.addEventListener('mouseover', onMouseOver)
        gridEl.addEventListener('mouseout', onMouseOut)
        gridEl.addEventListener('click', onClick)
        gridEl.addEventListener('focusin', onFocusIn)
        gridEl.addEventListener('focusout', onFocusOut)
        gridEl.addEventListener('keydown', onKeyDown)

        this.detachListeners = (): void => {
            gridEl.removeEventListener('mouseover', onMouseOver)
            gridEl.removeEventListener('mouseout', onMouseOut)
            gridEl.removeEventListener('click', onClick)
            gridEl.removeEventListener('focusin', onFocusIn)
            gridEl.removeEventListener('focusout', onFocusOut)
            gridEl.removeEventListener('keydown', onKeyDown)
            this.detachListeners = null
        }
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
     * Create heatmap legend.
     *
     * A gradient scheme gets the "Less → More" intensity ramp. A discrete
     * scheme has no ordering to communicate, so it gets one labelled swatch per
     * mapping entry instead — without it the colors are unreadable (issue #82).
     */
    private createLegend(container: HTMLElement): void {
        const { colorScheme, cellSize } = this.heatmapConfig

        if (isDiscreteHeatmapScheme(colorScheme)) {
            const entries = Object.entries(colorScheme.mapping)
            if (entries.length === 0) return

            const legend = container.createDiv({
                cls: 'lt-heatmap-legend lt-heatmap-legend--discrete'
            })

            for (const [value, color] of entries) {
                const item = legend.createDiv({ cls: 'lt-heatmap-legend-item' })
                const box = item.createDiv({ cls: 'lt-heatmap-cell' })
                setCssProps(box, { width: cellSize, height: cellSize, backgroundColor: color })
                item.createSpan({ text: value })
            }
            return
        }

        const legend = container.createDiv({ cls: 'lt-heatmap-legend' })

        legend.createSpan({ text: 'Less' })

        // Create color boxes
        for (let i = 0; i <= 4; i++) {
            const box = legend.createDiv({
                cls: `lt-heatmap-cell lt-heatmap-cell--level-${i}`
            })
            setCssProps(box, { width: cellSize, height: cellSize })
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
