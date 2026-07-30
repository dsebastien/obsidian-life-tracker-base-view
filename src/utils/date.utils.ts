import {
    addDays as dateFnsAddDays,
    addMonths as dateFnsAddMonths,
    addWeeks as dateFnsAddWeeks,
    subDays as dateFnsSubDays,
    subMonths as dateFnsSubMonths,
    subYears as dateFnsSubYears,
    format,
    getISOWeek,
    getQuarter as dateFnsGetQuarter,
    isValid,
    isWithinInterval,
    parseISO,
    startOfDay as dateFnsStartOfDay,
    startOfMonth as dateFnsStartOfMonth,
    startOfQuarter as dateFnsStartOfQuarter,
    startOfWeek as dateFnsStartOfWeek,
    startOfYear as dateFnsStartOfYear,
    endOfDay as dateFnsEndOfDay,
    endOfMonth as dateFnsEndOfMonth,
    endOfWeek as dateFnsEndOfWeek,
    endOfYear as dateFnsEndOfYear,
    isSameDay as dateFnsIsSameDay,
    isSameWeek as dateFnsIsSameWeek,
    isSameMonth as dateFnsIsSameMonth,
    isSameQuarter as dateFnsIsSameQuarter,
    isSameYear as dateFnsIsSameYear,
    eachWeekOfInterval
} from 'date-fns'
import { TimeGranularity, TimeFrame } from '../app/types'

/**
 * First day of the week, using date-fns' `weekStartsOn` convention.
 * 0 = Sunday, 1 = Monday. Defaults to Monday (issue #99).
 *
 * Note: this only affects week grouping/boundaries used for display
 * (weekly aggregation buckets, heatmap week columns, "this/last week"
 * ranges). ISO week parsing/labels (`YYYY-Www` filenames) stay Monday-based
 * per the ISO-8601 standard.
 */
export type WeekStartDay = 0 | 1

let configuredWeekStart: WeekStartDay = 1

/** Set the configured first day of the week (called from plugin settings). */
export function setWeekStartDay(day: WeekStartDay): void {
    configuredWeekStart = day
}

/** Get the configured first day of the week (0 = Sunday, 1 = Monday). */
export function getWeekStartDay(): WeekStartDay {
    return configuredWeekStart
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: Date): boolean {
    return isValid(date)
}

/**
 * Get ISO week number for a date
 */
export function getISOWeekNumber(date: Date): number {
    return getISOWeek(date)
}

/**
 * Get quarter number for a date (1-4)
 */
export function getQuarter(date: Date): number {
    return dateFnsGetQuarter(date)
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
    return dateFnsAddDays(date, days)
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
    return dateFnsAddWeeks(date, weeks)
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
    return dateFnsAddMonths(date, months)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(a: Date, b: Date): boolean {
    return dateFnsIsSameDay(a, b)
}

/**
 * Check if two dates are in the same week (respecting the configured week start)
 */
export function isSameWeek(a: Date, b: Date): boolean {
    return dateFnsIsSameWeek(a, b, { weekStartsOn: configuredWeekStart })
}

/**
 * Check if two dates are in the same month
 */
export function isSameMonth(a: Date, b: Date): boolean {
    return dateFnsIsSameMonth(a, b)
}

/**
 * Check if two dates are in the same quarter
 */
export function isSameQuarter(a: Date, b: Date): boolean {
    return dateFnsIsSameQuarter(a, b)
}

/**
 * Check if two dates are in the same year
 */
export function isSameYear(a: Date, b: Date): boolean {
    return dateFnsIsSameYear(a, b)
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
    return dateFnsStartOfDay(date)
}

/**
 * Get start of week (respecting the configured week start)
 */
export function startOfWeek(date: Date): Date {
    return dateFnsStartOfWeek(date, { weekStartsOn: configuredWeekStart })
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
    return dateFnsStartOfMonth(date)
}

/**
 * Get start of quarter
 */
export function startOfQuarter(date: Date): Date {
    return dateFnsStartOfQuarter(date)
}

/**
 * Get start of year
 */
export function startOfYear(date: Date): Date {
    return dateFnsStartOfYear(date)
}

/**
 * Get all weeks between two dates
 */
export function getWeeksBetween(startDate: Date, endDate: Date): Date[] {
    return eachWeekOfInterval(
        { start: startDate, end: endDate },
        { weekStartsOn: configuredWeekStart }
    )
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
    return format(date, 'yyyy-MM-dd')
}

/**
 * Format a date string for a native date / datetime-local input.
 * ISO strings are parsed as local time (date-only strings = local midnight)
 * and formatted from local components, so values never shift by a day across
 * timezones (issue #94: `new Date()` + `toISOString()` round-tripped through
 * UTC). Returns the original string when unparseable.
 */
export function formatDateForInput(value: string, includeTime: boolean): string {
    let date = parseISO(value)
    if (!isValid(date)) {
        date = new Date(value)
    }
    if (!isValid(date)) {
        return value
    }
    return includeTime ? format(date, "yyyy-MM-dd'T'HH:mm") : format(date, 'yyyy-MM-dd')
}

/**
 * Current local date/time formatted for a native date / datetime-local input
 * (`yyyy-MM-dd` or `yyyy-MM-dd'T'HH:mm`). Local components are used so the value
 * matches what the user sees in their timezone (see `formatDateForInput`).
 */
export function formatNowForInput(includeTime: boolean): string {
    const now = new Date()
    return includeTime ? format(now, "yyyy-MM-dd'T'HH:mm") : format(now, 'yyyy-MM-dd')
}

/**
 * Format date based on time granularity
 * - Daily: YYYY-MM-DD
 * - Weekly: YYYY-Www (ISO week)
 * - Monthly: YYYY-MM
 * - Quarterly: YYYY-Qq
 * - Yearly: YYYY
 */
export function formatDateByGranularity(date: Date, granularity: TimeGranularity): string {
    switch (granularity) {
        case TimeGranularity.Daily:
            return format(date, 'yyyy-MM-dd')
        case TimeGranularity.Weekly: {
            const year = format(date, 'yyyy')
            const week = String(getISOWeek(date)).padStart(2, '0')
            return `${year}-W${week}`
        }
        case TimeGranularity.Monthly:
            return format(date, 'yyyy-MM')
        case TimeGranularity.Quarterly: {
            const year = format(date, 'yyyy')
            const quarter = dateFnsGetQuarter(date)
            return `${year}-Q${quarter}`
        }
        case TimeGranularity.Yearly:
            return format(date, 'yyyy')
        default:
            return format(date, 'yyyy-MM-dd')
    }
}

/**
 * Get month name
 */
export function getMonthName(date: Date, formatType: 'short' | 'long' = 'short'): string {
    return format(date, formatType === 'short' ? 'MMM' : 'MMMM')
}

/**
 * Format file title, adding weekday for YYYY-MM-DD formatted names
 * Example: "2025-01-15" becomes "2025-01-15 (Wednesday)"
 */
export function formatFileTitleWithWeekday(basename: string): string {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(basename)
    if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
        const year = parseInt(dateMatch[1])
        const month = parseInt(dateMatch[2]) - 1
        const day = parseInt(dateMatch[3])
        const date = new Date(year, month, day)
        if (!isNaN(date.getTime())) {
            const weekday = format(date, 'EEEE')
            return `${basename} (${weekday})`
        }
    }
    return basename
}

/**
 * Date range representing a time frame filter
 */
export interface TimeFrameDateRange {
    start: Date
    end: Date
}

/**
 * Get the date range for a given time frame.
 * Returns null for AllTime (no filtering).
 */
export function getTimeFrameDateRange(timeFrame: TimeFrame): TimeFrameDateRange | null {
    const now = new Date()
    const today = dateFnsStartOfDay(now)

    switch (timeFrame) {
        case TimeFrame.AllTime:
            return null

        case TimeFrame.ThisYear:
            return {
                start: dateFnsStartOfYear(today),
                end: dateFnsEndOfYear(today)
            }

        case TimeFrame.LastYear: {
            const lastYear = dateFnsSubYears(today, 1)
            return {
                start: dateFnsStartOfYear(lastYear),
                end: dateFnsEndOfYear(lastYear)
            }
        }

        case TimeFrame.ThisMonth:
            return {
                start: dateFnsStartOfMonth(today),
                end: dateFnsEndOfMonth(today)
            }

        case TimeFrame.LastMonth: {
            const lastMonth = dateFnsSubMonths(today, 1)
            return {
                start: dateFnsStartOfMonth(lastMonth),
                end: dateFnsEndOfMonth(lastMonth)
            }
        }

        case TimeFrame.ThisWeek:
            return {
                start: dateFnsStartOfWeek(today, { weekStartsOn: configuredWeekStart }),
                end: dateFnsEndOfWeek(today, { weekStartsOn: configuredWeekStart })
            }

        case TimeFrame.LastWeek: {
            const lastWeek = dateFnsSubDays(today, 7)
            return {
                start: dateFnsStartOfWeek(lastWeek, { weekStartsOn: configuredWeekStart }),
                end: dateFnsEndOfWeek(lastWeek, { weekStartsOn: configuredWeekStart })
            }
        }

        case TimeFrame.Last7Days:
            return {
                start: dateFnsStartOfDay(dateFnsSubDays(today, 6)),
                end: dateFnsEndOfDay(today)
            }

        case TimeFrame.Last30Days:
            return {
                start: dateFnsStartOfDay(dateFnsSubDays(today, 29)),
                end: dateFnsEndOfDay(today)
            }

        case TimeFrame.Last90Days:
            return {
                start: dateFnsStartOfDay(dateFnsSubDays(today, 89)),
                end: dateFnsEndOfDay(today)
            }

        case TimeFrame.Last365Days:
            return {
                start: dateFnsStartOfDay(dateFnsSubDays(today, 364)),
                end: dateFnsEndOfDay(today)
            }

        default:
            return null
    }
}

/**
 * Check if a date is within a time frame date range.
 * Returns true if the date range is null (AllTime).
 */
export function isDateInTimeFrame(date: Date, dateRange: TimeFrameDateRange | null): boolean {
    if (!dateRange) {
        return true
    }
    return isWithinInterval(date, { start: dateRange.start, end: dateRange.end })
}
