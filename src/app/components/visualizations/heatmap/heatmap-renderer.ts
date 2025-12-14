import {
    TimeGranularity,
    type HeatmapConfig,
    type HeatmapData,
    type HeatmapCell
} from '../../../types'
import { compareAsc, format, getMonth, getYear } from 'date-fns'
import {
    addDays,
    formatDateISO,
    getMonthName,
    getWeeksBetween,
    isSameDay,
    getColorLevelForValue
} from '../../../../utils'

/**
 * Render the heatmap grid based on granularity
 */
export function renderHeatmapGrid(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    switch (config.granularity) {
        case TimeGranularity.Daily:
            return renderDailyHeatmap(container, data, config)

        case TimeGranularity.Weekly:
            return renderWeeklyHeatmap(container, data, config)

        case TimeGranularity.Monthly:
            return renderMonthlyHeatmap(container, data, config)

        case TimeGranularity.Quarterly:
            return renderQuarterlyHeatmap(container, data, config)

        case TimeGranularity.Yearly:
            return renderYearlyHeatmap(container, data, config)

        default:
            return renderDailyHeatmap(container, data, config)
    }
}

/**
 * Render daily heatmap (GitHub-style: 7 rows × N weeks)
 */
function renderDailyHeatmap(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    const wrapper = container.createDiv({ cls: 'lt-heatmap-wrapper' })

    // Day labels column
    if (config.showDayLabels) {
        const dayLabels = wrapper.createDiv({ cls: 'lt-heatmap-days' })
        // Set gap dynamically to match the grid cell gap
        dayLabels.style.gap = `${config.cellGap}px`
        const dayNames = ['Mon', '', 'Wed', '', 'Fri', '', '']
        for (const name of dayNames) {
            const labelEl = dayLabels.createDiv({ cls: 'lt-heatmap-day-label' })
            labelEl.style.height = `${config.cellSize}px`
            labelEl.style.lineHeight = `${config.cellSize}px`
            labelEl.textContent = name
        }
    }

    // Grid container
    const gridEl = wrapper.createDiv({ cls: 'lt-heatmap-grid' })
    gridEl.style.gap = `${config.cellGap}px`

    // Get weeks to render
    const weeks = getWeeksBetween(data.minDate, data.maxDate)

    // Render each week as a column
    weeks.forEach((weekStart, _weekIndex) => {
        const weekCol = gridEl.createDiv({ cls: 'lt-heatmap-week' })
        weekCol.style.gap = `${config.cellGap}px`

        // Render 7 days (Monday to Sunday)
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const date = addDays(weekStart, dayOffset)
            const cell = findCellForDate(data.cells, date)

            const cellEl = weekCol.createDiv({ cls: 'lt-heatmap-cell' })
            cellEl.style.width = `${config.cellSize}px`
            cellEl.style.height = `${config.cellSize}px`

            // Set color level
            const level = getColorLevelForValue(cell?.value ?? null, data.minValue, data.maxValue)
            cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

            // Store data attributes
            cellEl.dataset['date'] = formatDateISO(date)
            if (cell) {
                if (cell.value !== null) {
                    cellEl.dataset['value'] = String(cell.value)
                }
                cellEl.dataset['count'] = String(cell.count)
                if (cell.count > 0) {
                    cellEl.classList.add('lt-heatmap-cell--has-data')
                }
            }
        }
    })

    // Add month labels above grid
    if (config.showMonthLabels) {
        const monthRow = container.createDiv({ cls: 'lt-heatmap-months' })

        // Add spacer for day labels column with matching width
        if (config.showDayLabels) {
            const dayLabelsSpacer = monthRow.createDiv({ cls: 'lt-heatmap-month-spacer' })
            // Match the day labels column width (approx 24px for "Mon" + padding)
            dayLabelsSpacer.style.width = '28px'
            dayLabelsSpacer.style.flexShrink = '0'
        }

        // Create a flex container for month label slots that matches the grid structure
        const monthLabelsContainer = monthRow.createDiv({ cls: 'lt-heatmap-month-labels' })
        monthLabelsContainer.style.display = 'flex'
        monthLabelsContainer.style.gap = `${config.cellGap}px`

        // Create a slot for each week - only fill in month name when month changes
        let currentMonthForLabels = -1
        for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
            const weekStart = weeks[weekIndex]
            if (!weekStart) continue

            const monthNum = getMonth(weekStart)
            const slot = monthLabelsContainer.createDiv({ cls: 'lt-heatmap-month-slot' })
            slot.style.width = `${config.cellSize}px`
            slot.style.flexShrink = '0'

            // Only show month name at the start of a new month
            if (monthNum !== currentMonthForLabels) {
                slot.textContent = getMonthName(weekStart)
                slot.classList.add('lt-heatmap-month-label')
                currentMonthForLabels = monthNum
            }
        }

        // Insert month row before wrapper
        container.insertBefore(monthRow, wrapper)
    }

    return gridEl
}

/**
 * Render weekly heatmap (single row of weeks)
 */
function renderWeeklyHeatmap(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    const wrapper = container.createDiv({ cls: 'lt-heatmap-wrapper lt-heatmap-wrapper--weekly' })
    const gridEl = wrapper.createDiv({ cls: 'lt-heatmap-grid lt-heatmap-grid--weekly' })
    gridEl.style.gap = `${config.cellGap}px`

    // Sort cells by date
    const sortedCells = [...data.cells].sort((a, b) => compareAsc(a.date, b.date))

    for (const cell of sortedCells) {
        const cellEl = gridEl.createDiv({ cls: 'lt-heatmap-cell' })
        cellEl.style.width = `${config.cellSize * 2}px`
        cellEl.style.height = `${config.cellSize}px`

        const level = getColorLevelForValue(cell.value, data.minValue, data.maxValue)
        cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

        cellEl.dataset['date'] = formatDateISO(cell.date)
        if (cell.value !== null) {
            cellEl.dataset['value'] = String(cell.value)
        }
        cellEl.dataset['count'] = String(cell.count)

        if (cell.count > 0) {
            cellEl.classList.add('lt-heatmap-cell--has-data')
        }
    }

    return gridEl
}

/**
 * Render monthly heatmap (12 columns × rows for weeks)
 */
function renderMonthlyHeatmap(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    const wrapper = container.createDiv({ cls: 'lt-heatmap-wrapper lt-heatmap-wrapper--monthly' })

    // Group cells by year-month
    const byMonth = new Map<string, HeatmapCell>()
    for (const cell of data.cells) {
        const key = format(cell.date, 'yyyy-MM')
        byMonth.set(key, cell)
    }

    const gridEl = wrapper.createDiv({ cls: 'lt-heatmap-grid lt-heatmap-grid--monthly' })
    gridEl.style.gap = `${config.cellGap}px`
    gridEl.style.display = 'grid'
    gridEl.style.gridTemplateColumns = 'repeat(12, 1fr)'

    // Month labels
    if (config.showMonthLabels) {
        const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
        for (const month of months) {
            gridEl.createDiv({ cls: 'lt-heatmap-month-label', text: month })
        }
    }

    // Get year range
    const startYear = getYear(data.minDate)
    const endYear = getYear(data.maxDate)

    for (let year = startYear; year <= endYear; year++) {
        for (let month = 0; month < 12; month++) {
            const key = `${year}-${String(month + 1).padStart(2, '0')}`
            const cell = byMonth.get(key)

            const cellEl = gridEl.createDiv({ cls: 'lt-heatmap-cell' })
            cellEl.style.width = `${config.cellSize * 1.5}px`
            cellEl.style.height = `${config.cellSize}px`

            const level = getColorLevelForValue(cell?.value ?? null, data.minValue, data.maxValue)
            cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

            const date = new Date(year, month, 1)
            cellEl.dataset['date'] = formatDateISO(date)

            if (cell) {
                if (cell.value !== null) {
                    cellEl.dataset['value'] = String(cell.value)
                }
                cellEl.dataset['count'] = String(cell.count)
                if (cell.count > 0) {
                    cellEl.classList.add('lt-heatmap-cell--has-data')
                }
            }
        }
    }

    return gridEl
}

/**
 * Render quarterly heatmap (4 columns × rows for years)
 */
function renderQuarterlyHeatmap(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    const wrapper = container.createDiv({ cls: 'lt-heatmap-wrapper lt-heatmap-wrapper--quarterly' })
    const gridEl = wrapper.createDiv({ cls: 'lt-heatmap-grid lt-heatmap-grid--quarterly' })
    gridEl.style.gap = `${config.cellGap}px`
    gridEl.style.display = 'grid'
    gridEl.style.gridTemplateColumns = 'repeat(4, 1fr)'

    // Quarter labels
    if (config.showMonthLabels) {
        for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
            gridEl.createDiv({ cls: 'lt-heatmap-month-label', text: q })
        }
    }

    // Sort cells and render
    const sortedCells = [...data.cells].sort((a, b) => compareAsc(a.date, b.date))

    for (const cell of sortedCells) {
        const cellEl = gridEl.createDiv({ cls: 'lt-heatmap-cell' })
        cellEl.style.width = `${config.cellSize * 2}px`
        cellEl.style.height = `${config.cellSize}px`

        const level = getColorLevelForValue(cell.value, data.minValue, data.maxValue)
        cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

        cellEl.dataset['date'] = formatDateISO(cell.date)
        if (cell.value !== null) {
            cellEl.dataset['value'] = String(cell.value)
        }
        cellEl.dataset['count'] = String(cell.count)

        if (cell.count > 0) {
            cellEl.classList.add('lt-heatmap-cell--has-data')
        }
    }

    return gridEl
}

/**
 * Render yearly heatmap (single row of years)
 */
function renderYearlyHeatmap(
    container: HTMLElement,
    data: HeatmapData,
    config: HeatmapConfig
): HTMLElement {
    const wrapper = container.createDiv({ cls: 'lt-heatmap-wrapper lt-heatmap-wrapper--yearly' })
    const gridEl = wrapper.createDiv({ cls: 'lt-heatmap-grid lt-heatmap-grid--yearly' })
    gridEl.style.gap = `${config.cellGap}px`

    // Sort cells and render
    const sortedCells = [...data.cells].sort((a, b) => compareAsc(a.date, b.date))

    for (const cell of sortedCells) {
        const cellEl = gridEl.createDiv({ cls: 'lt-heatmap-cell' })
        cellEl.style.width = `${config.cellSize * 3}px`
        cellEl.style.height = `${config.cellSize}px`

        const level = getColorLevelForValue(cell.value, data.minValue, data.maxValue)
        cellEl.classList.add(`lt-heatmap-cell--level-${level}`)

        cellEl.dataset['date'] = formatDateISO(cell.date)
        if (cell.value !== null) {
            cellEl.dataset['value'] = String(cell.value)
        }
        cellEl.dataset['count'] = String(cell.count)

        if (cell.count > 0) {
            cellEl.classList.add('lt-heatmap-cell--has-data')
        }

        // Add year label
        cellEl.textContent = format(cell.date, 'yyyy')
    }

    return gridEl
}

/**
 * Find cell for a specific date
 */
function findCellForDate(cells: HeatmapCell[], date: Date): HeatmapCell | undefined {
    return cells.find((c) => isSameDay(c.date, date))
}
