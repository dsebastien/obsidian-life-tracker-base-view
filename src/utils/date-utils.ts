import type { DatePattern } from '../app/types/date-anchor.types'

/**
 * Supported date patterns for filename parsing
 */
export const DATE_PATTERNS: DatePattern[] = [
    {
        // Daily: YYYY-MM-DD
        regex: /^(\d{4})-(\d{2})-(\d{2})$/,
        granularity: 'daily',
        parser: (match: RegExpMatchArray): Date | null => {
            const year = parseInt(match[1]!, 10)
            const month = parseInt(match[2]!, 10) - 1
            const day = parseInt(match[3]!, 10)
            const date = new Date(year, month, day)
            return isValidDate(date) ? date : null
        }
    },
    {
        // Weekly: YYYY-Www (ISO week)
        regex: /^(\d{4})-W(\d{2})$/,
        granularity: 'weekly',
        parser: (match: RegExpMatchArray): Date | null => {
            const year = parseInt(match[1]!, 10)
            const week = parseInt(match[2]!, 10)
            return getDateFromISOWeek(year, week)
        }
    },
    {
        // Monthly: YYYY-MM
        regex: /^(\d{4})-(\d{2})$/,
        granularity: 'monthly',
        parser: (match: RegExpMatchArray): Date | null => {
            const year = parseInt(match[1]!, 10)
            const month = parseInt(match[2]!, 10) - 1
            const date = new Date(year, month, 1)
            return isValidDate(date) ? date : null
        }
    },
    {
        // Quarterly: YYYY-Qq
        regex: /^(\d{4})-Q([1-4])$/,
        granularity: 'quarterly',
        parser: (match: RegExpMatchArray): Date | null => {
            const year = parseInt(match[1]!, 10)
            const quarter = parseInt(match[2]!, 10)
            const month = (quarter - 1) * 3
            const date = new Date(year, month, 1)
            return isValidDate(date) ? date : null
        }
    },
    {
        // Yearly: YYYY
        regex: /^(\d{4})$/,
        granularity: 'yearly',
        parser: (match: RegExpMatchArray): Date | null => {
            const year = parseInt(match[1]!, 10)
            const date = new Date(year, 0, 1)
            return isValidDate(date) ? date : null
        }
    }
]

/**
 * Check if a date is valid
 */
export function isValidDate(date: Date): boolean {
    return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Parse date from filename (without extension)
 */
export function parseDateFromFilename(
    filename: string
): { date: Date; granularity: string } | null {
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
 */
export function getDateFromISOWeek(year: number, week: number): Date | null {
    if (week < 1 || week > 53) return null

    // January 4th is always in week 1
    const jan4 = new Date(year, 0, 4)
    const dayOfWeek = jan4.getDay() || 7 // Convert Sunday from 0 to 7

    // Calculate Monday of week 1
    const week1Monday = new Date(jan4)
    week1Monday.setDate(jan4.getDate() - dayOfWeek + 1)

    // Calculate Monday of target week
    const targetMonday = new Date(week1Monday)
    targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7)

    return isValidDate(targetMonday) ? targetMonday : null
}

/**
 * Get ISO week number for a date
 */
export function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/**
 * Get quarter number for a date (1-4)
 */
export function getQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
    return addDays(date, weeks * 7)
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
    const result = new Date(date)
    result.setMonth(result.getMonth() + months)
    return result
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    )
}

/**
 * Check if two dates are in the same week
 */
export function isSameWeek(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && getISOWeek(a) === getISOWeek(b)
}

/**
 * Check if two dates are in the same month
 */
export function isSameMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * Check if two dates are in the same quarter
 */
export function isSameQuarter(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && getQuarter(a) === getQuarter(b)
}

/**
 * Check if two dates are in the same year
 */
export function isSameYear(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    return result
}

/**
 * Get start of week (Monday)
 */
export function startOfWeek(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay() || 7 // Convert Sunday from 0 to 7
    result.setDate(result.getDate() - day + 1)
    result.setHours(0, 0, 0, 0)
    return result
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
    const result = new Date(date)
    result.setDate(1)
    result.setHours(0, 0, 0, 0)
    return result
}

/**
 * Get start of quarter
 */
export function startOfQuarter(date: Date): Date {
    const quarter = getQuarter(date)
    const month = (quarter - 1) * 3
    return new Date(date.getFullYear(), month, 1)
}

/**
 * Get start of year
 */
export function startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1)
}

/**
 * Get all weeks between two dates
 */
export function getWeeksBetween(startDate: Date, endDate: Date): Date[] {
    const weeks: Date[] = []
    let current = startOfWeek(startDate)
    const end = startOfWeek(endDate)

    while (current <= end) {
        weeks.push(new Date(current))
        current = addWeeks(current, 1)
    }

    return weeks
}

/**
 * Get all days between two dates
 */
export function getDaysBetween(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = []
    let current = startOfDay(startDate)
    const end = startOfDay(endDate)

    while (current <= end) {
        days.push(new Date(current))
        current = addDays(current, 1)
    }

    return days
}

/**
 * Format date for display
 */
export function formatDate(date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
    const options: Intl.DateTimeFormatOptions =
        format === 'short'
            ? { month: 'short', day: 'numeric' }
            : format === 'long'
              ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
              : { year: 'numeric', month: 'short', day: 'numeric' }

    return date.toLocaleDateString(undefined, options)
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Get day of week name (short)
 */
export function getDayName(date: Date, format: 'short' | 'long' = 'short'): string {
    return date.toLocaleDateString(undefined, { weekday: format })
}

/**
 * Get month name
 */
export function getMonthName(date: Date, format: 'short' | 'long' = 'short'): string {
    return date.toLocaleDateString(undefined, { month: format })
}
