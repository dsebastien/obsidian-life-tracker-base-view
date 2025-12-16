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
    parse,
    setISOWeek,
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
import { TimeGranularity, TimeFrame, type DatePattern } from '../app/types'

/**
 * Supported date patterns for filename parsing
 */
const DATE_PATTERNS: DatePattern[] = [
    {
        // Daily: YYYY-MM-DD
        regex: /^(\d{4})-(\d{2})-(\d{2})$/,
        granularity: TimeGranularity.Daily,
        parser: (match: RegExpMatchArray): Date | null => {
            const dateStr = match[0]
            if (!dateStr) return null
            const date = parse(dateStr, 'yyyy-MM-dd', new Date())
            return isValidDate(date) ? date : null
        }
    },
    {
        // Weekly: YYYY-Www (ISO week)
        regex: /^(\d{4})-W(\d{2})$/,
        granularity: TimeGranularity.Weekly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            const weekStr = match[2]
            if (!yearStr || !weekStr) return null
            const year = parseInt(yearStr, 10)
            const week = parseInt(weekStr, 10)
            return getDateFromISOWeek(year, week)
        }
    },
    {
        // Monthly: YYYY-MM
        regex: /^(\d{4})-(\d{2})$/,
        granularity: TimeGranularity.Monthly,
        parser: (match: RegExpMatchArray): Date | null => {
            const dateStr = match[0]
            if (!dateStr) return null
            const date = parse(dateStr, 'yyyy-MM', new Date())
            return isValidDate(date) ? date : null
        }
    },
    {
        // Quarterly: YYYY-Qq
        regex: /^(\d{4})-Q([1-4])$/,
        granularity: TimeGranularity.Quarterly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            const quarterStr = match[2]
            if (!yearStr || !quarterStr) return null
            const year = parseInt(yearStr, 10)
            const quarter = parseInt(quarterStr, 10)
            const month = (quarter - 1) * 3
            const date = new Date(year, month, 1)
            return isValidDate(date) ? date : null
        }
    },
    {
        // Yearly: YYYY
        regex: /^(\d{4})$/,
        granularity: TimeGranularity.Yearly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            if (!yearStr) return null
            const year = parseInt(yearStr, 10)
            const date = new Date(year, 0, 1)
            return isValidDate(date) ? date : null
        }
    }
]

/**
 * Check if a date is valid
 */
export function isValidDate(date: Date): boolean {
    return isValid(date)
}

/**
 * Parse date from filename (without extension)
 */
export function parseDateFromFilename(
    filename: string
): { date: Date; granularity: TimeGranularity } | null {
    for (const pattern of DATE_PATTERNS) {
        const match = filename.match(pattern.regex)
        if (match) {
            const date = pattern.parser(match)
            if (date) {
                return { date, granularity: pattern.granularity }
            }
        }
    }
    return null
}

/**
 * Get date from ISO week number
 * Returns the Monday of the given ISO week
 */
export function getDateFromISOWeek(year: number, week: number): Date | null {
    if (week < 1 || week > 53) return null

    // Start with January 4th of the year (always in week 1)
    const jan4 = new Date(year, 0, 4)
    // Set to the target ISO week, which gives us a date in that week
    const targetDate = setISOWeek(jan4, week)
    // Get the Monday of that week (ISO weeks start on Monday)
    const monday = dateFnsStartOfWeek(targetDate, { weekStartsOn: 1 })

    return isValidDate(monday) ? monday : null
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
 * Check if two dates are in the same week (ISO week, Monday start)
 */
export function isSameWeek(a: Date, b: Date): boolean {
    return dateFnsIsSameWeek(a, b, { weekStartsOn: 1 })
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
 * Get start of week (Monday)
 */
export function startOfWeek(date: Date): Date {
    return dateFnsStartOfWeek(date, { weekStartsOn: 1 })
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
    return eachWeekOfInterval({ start: startDate, end: endDate }, { weekStartsOn: 1 })
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
    return format(date, 'yyyy-MM-dd')
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
                start: dateFnsStartOfWeek(today, { weekStartsOn: 1 }),
                end: dateFnsEndOfWeek(today, { weekStartsOn: 1 })
            }

        case TimeFrame.LastWeek: {
            const lastWeek = dateFnsSubDays(today, 7)
            return {
                start: dateFnsStartOfWeek(lastWeek, { weekStartsOn: 1 }),
                end: dateFnsEndOfWeek(lastWeek, { weekStartsOn: 1 })
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
