import { format } from 'date-fns'
import { TimeGranularity, type HeatmapCell } from '../types'
import {
    addDays,
    addMonths,
    addWeeks,
    formatDateISO,
    getQuarter,
    isSameDay,
    isSameMonth,
    isSameQuarter,
    isSameWeek,
    isSameYear,
    startOfDay,
    startOfMonth,
    startOfQuarter,
    startOfWeek,
    startOfYear
} from '../../utils'

/**
 * Get time key for grouping dates
 */
export function getTimeKey(date: Date, granularity: TimeGranularity): string {
    switch (granularity) {
        case TimeGranularity.Daily:
            return formatDateISO(date)

        case TimeGranularity.Weekly:
            return formatDateISO(startOfWeek(date))

        case TimeGranularity.Monthly:
            return format(date, 'yyyy-MM')

        case TimeGranularity.Quarterly:
            return `${format(date, 'yyyy')}-Q${getQuarter(date)}`

        case TimeGranularity.Yearly:
            return format(date, 'yyyy')

        default:
            return formatDateISO(date)
    }
}

/**
 * Normalize date to start of time unit
 */
export function normalizeDate(date: Date, granularity: TimeGranularity): Date {
    switch (granularity) {
        case TimeGranularity.Daily:
            return startOfDay(date)

        case TimeGranularity.Weekly:
            return startOfWeek(date)

        case TimeGranularity.Monthly:
            return startOfMonth(date)

        case TimeGranularity.Quarterly:
            return startOfQuarter(date)

        case TimeGranularity.Yearly:
            return startOfYear(date)

        default:
            return startOfDay(date)
    }
}

/**
 * Increment date by granularity
 */
export function incrementDate(date: Date, granularity: TimeGranularity): Date {
    switch (granularity) {
        case TimeGranularity.Daily:
            return addDays(date, 1)

        case TimeGranularity.Weekly:
            return addWeeks(date, 1)

        case TimeGranularity.Monthly:
            return addMonths(date, 1)

        case TimeGranularity.Quarterly:
            return addMonths(date, 3)

        case TimeGranularity.Yearly:
            return addMonths(date, 12)

        default:
            return addDays(date, 1)
    }
}

/**
 * Check if two dates match based on granularity
 */
export function matchesByGranularity(
    date1: Date,
    date2: Date,
    granularity: TimeGranularity
): boolean {
    switch (granularity) {
        case TimeGranularity.Daily:
            return isSameDay(date1, date2)

        case TimeGranularity.Weekly:
            return isSameWeek(date1, date2)

        case TimeGranularity.Monthly:
            return isSameMonth(date1, date2)

        case TimeGranularity.Quarterly:
            return isSameQuarter(date1, date2)

        case TimeGranularity.Yearly:
            return isSameYear(date1, date2)

        default:
            return isSameDay(date1, date2)
    }
}

/**
 * Generate empty cells for date range
 */
export function generateEmptyCells(
    minDate: Date,
    maxDate: Date,
    granularity: TimeGranularity,
    existingCells: Map<string, unknown>
): HeatmapCell[] {
    const cells: HeatmapCell[] = []
    let current = normalizeDate(minDate, granularity)
    const end = normalizeDate(maxDate, granularity)

    while (current <= end) {
        const key = getTimeKey(current, granularity)

        if (!existingCells.has(key)) {
            cells.push({
                date: new Date(current),
                value: null,
                count: 0,
                entries: []
            })
        }

        current = incrementDate(current, granularity)
    }

    return cells
}
