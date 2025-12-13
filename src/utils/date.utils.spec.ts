import { describe, expect, test } from 'bun:test'
import {
    isValidDate,
    parseDateFromFilename,
    getDateFromISOWeek,
    getISOWeekNumber,
    getQuarter,
    addDays,
    addWeeks,
    addMonths,
    isSameDay,
    isSameWeek,
    isSameMonth,
    isSameQuarter,
    isSameYear,
    startOfDay,
    startOfWeek,
    startOfMonth,
    startOfQuarter,
    startOfYear,
    getWeeksBetween,
    formatDateISO,
    formatDateByGranularity,
    getMonthName,
    DATE_PATTERNS
} from './date.utils'
import { TimeGranularity } from '../app/types'

describe('date-utils', () => {
    describe('isValidDate', () => {
        test('returns true for valid date', () => {
            expect(isValidDate(new Date(2024, 0, 15))).toBe(true)
        })

        test('returns false for invalid date', () => {
            expect(isValidDate(new Date('invalid'))).toBe(false)
        })

        test('returns true for Date.now()', () => {
            expect(isValidDate(new Date())).toBe(true)
        })
    })

    describe('DATE_PATTERNS', () => {
        test('has 5 patterns', () => {
            expect(DATE_PATTERNS.length).toBe(5)
        })

        test('daily pattern matches YYYY-MM-DD', () => {
            const pattern = DATE_PATTERNS[0]!
            expect(pattern.granularity).toBe(TimeGranularity.Daily)
            expect('2024-01-15'.match(pattern.regex)).toBeTruthy()
            expect('2024-1-15'.match(pattern.regex)).toBeFalsy()
        })

        test('weekly pattern matches YYYY-Www', () => {
            const pattern = DATE_PATTERNS[1]!
            expect(pattern.granularity).toBe(TimeGranularity.Weekly)
            expect('2024-W01'.match(pattern.regex)).toBeTruthy()
            expect('2024-W1'.match(pattern.regex)).toBeFalsy()
        })

        test('monthly pattern matches YYYY-MM', () => {
            const pattern = DATE_PATTERNS[2]!
            expect(pattern.granularity).toBe(TimeGranularity.Monthly)
            expect('2024-01'.match(pattern.regex)).toBeTruthy()
            expect('2024-1'.match(pattern.regex)).toBeFalsy()
        })

        test('quarterly pattern matches YYYY-Qq', () => {
            const pattern = DATE_PATTERNS[3]!
            expect(pattern.granularity).toBe(TimeGranularity.Quarterly)
            expect('2024-Q1'.match(pattern.regex)).toBeTruthy()
            expect('2024-Q5'.match(pattern.regex)).toBeFalsy()
        })

        test('yearly pattern matches YYYY', () => {
            const pattern = DATE_PATTERNS[4]!
            expect(pattern.granularity).toBe(TimeGranularity.Yearly)
            expect('2024'.match(pattern.regex)).toBeTruthy()
            expect('24'.match(pattern.regex)).toBeFalsy()
        })
    })

    describe('parseDateFromFilename', () => {
        test('parses daily format YYYY-MM-DD', () => {
            const result = parseDateFromFilename('2024-01-15')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Daily)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(0) // January
            expect(result!.date.getDate()).toBe(15)
        })

        test('parses weekly format YYYY-Www', () => {
            const result = parseDateFromFilename('2024-W01')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Weekly)
            expect(result!.date.getFullYear()).toBe(2024)
        })

        test('parses monthly format YYYY-MM', () => {
            const result = parseDateFromFilename('2024-03')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Monthly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(2) // March
        })

        test('parses quarterly format YYYY-Qq', () => {
            const result = parseDateFromFilename('2024-Q2')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Quarterly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(3) // April (Q2 starts)
        })

        test('parses yearly format YYYY', () => {
            const result = parseDateFromFilename('2024')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Yearly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(0) // January
        })

        test('returns null for invalid filename', () => {
            expect(parseDateFromFilename('not-a-date')).toBeNull()
            expect(parseDateFromFilename('my-note')).toBeNull()
            expect(parseDateFromFilename('')).toBeNull()
        })
    })

    describe('getDateFromISOWeek', () => {
        test('returns Monday of the given ISO week', () => {
            // Week 1 of 2024 starts on Monday, January 1
            const result = getDateFromISOWeek(2024, 1)
            expect(result).not.toBeNull()
            expect(result!.getDay()).toBe(1) // Monday
        })

        test('returns null for invalid week numbers', () => {
            expect(getDateFromISOWeek(2024, 0)).toBeNull()
            expect(getDateFromISOWeek(2024, 54)).toBeNull()
            expect(getDateFromISOWeek(2024, -1)).toBeNull()
        })

        test('handles week 53 for years that have it', () => {
            // 2020 has 53 weeks
            const result = getDateFromISOWeek(2020, 53)
            expect(result).not.toBeNull()
        })
    })

    describe('getISOWeekNumber', () => {
        test('returns correct week number', () => {
            // January 4th is always in week 1
            expect(getISOWeekNumber(new Date(2024, 0, 4))).toBe(1)
        })

        test('handles year boundary correctly', () => {
            // December 31, 2024 might be in week 1 of 2025
            const dec31 = new Date(2024, 11, 31)
            const week = getISOWeekNumber(dec31)
            expect(week).toBeGreaterThanOrEqual(1)
            expect(week).toBeLessThanOrEqual(53)
        })
    })

    describe('getQuarter', () => {
        test('returns 1 for January-March', () => {
            expect(getQuarter(new Date(2024, 0, 15))).toBe(1)
            expect(getQuarter(new Date(2024, 1, 15))).toBe(1)
            expect(getQuarter(new Date(2024, 2, 15))).toBe(1)
        })

        test('returns 2 for April-June', () => {
            expect(getQuarter(new Date(2024, 3, 15))).toBe(2)
            expect(getQuarter(new Date(2024, 4, 15))).toBe(2)
            expect(getQuarter(new Date(2024, 5, 15))).toBe(2)
        })

        test('returns 3 for July-September', () => {
            expect(getQuarter(new Date(2024, 6, 15))).toBe(3)
            expect(getQuarter(new Date(2024, 7, 15))).toBe(3)
            expect(getQuarter(new Date(2024, 8, 15))).toBe(3)
        })

        test('returns 4 for October-December', () => {
            expect(getQuarter(new Date(2024, 9, 15))).toBe(4)
            expect(getQuarter(new Date(2024, 10, 15))).toBe(4)
            expect(getQuarter(new Date(2024, 11, 15))).toBe(4)
        })
    })

    describe('addDays', () => {
        test('adds positive days', () => {
            const date = new Date(2024, 0, 15)
            const result = addDays(date, 5)
            expect(result.getDate()).toBe(20)
        })

        test('adds negative days', () => {
            const date = new Date(2024, 0, 15)
            const result = addDays(date, -5)
            expect(result.getDate()).toBe(10)
        })

        test('handles month overflow', () => {
            const date = new Date(2024, 0, 31)
            const result = addDays(date, 1)
            expect(result.getMonth()).toBe(1) // February
            expect(result.getDate()).toBe(1)
        })
    })

    describe('addWeeks', () => {
        test('adds weeks correctly', () => {
            const date = new Date(2024, 0, 1)
            const result = addWeeks(date, 2)
            expect(result.getDate()).toBe(15)
        })

        test('handles negative weeks', () => {
            const date = new Date(2024, 0, 15)
            const result = addWeeks(date, -1)
            expect(result.getDate()).toBe(8)
        })
    })

    describe('addMonths', () => {
        test('adds months correctly', () => {
            const date = new Date(2024, 0, 15)
            const result = addMonths(date, 2)
            expect(result.getMonth()).toBe(2) // March
        })

        test('handles year overflow', () => {
            const date = new Date(2024, 11, 15) // December
            const result = addMonths(date, 2)
            expect(result.getFullYear()).toBe(2025)
            expect(result.getMonth()).toBe(1) // February
        })
    })

    describe('isSameDay', () => {
        test('returns true for same day', () => {
            const a = new Date(2024, 0, 15, 10, 30)
            const b = new Date(2024, 0, 15, 18, 45)
            expect(isSameDay(a, b)).toBe(true)
        })

        test('returns false for different days', () => {
            const a = new Date(2024, 0, 15)
            const b = new Date(2024, 0, 16)
            expect(isSameDay(a, b)).toBe(false)
        })
    })

    describe('isSameWeek', () => {
        test('returns true for same week', () => {
            // Monday and Friday of the same week
            const monday = new Date(2024, 0, 15) // Monday
            const friday = new Date(2024, 0, 19) // Friday
            expect(isSameWeek(monday, friday)).toBe(true)
        })

        test('returns false for different weeks', () => {
            const week1 = new Date(2024, 0, 15)
            const week2 = new Date(2024, 0, 22)
            expect(isSameWeek(week1, week2)).toBe(false)
        })
    })

    describe('isSameMonth', () => {
        test('returns true for same month', () => {
            const a = new Date(2024, 0, 1)
            const b = new Date(2024, 0, 31)
            expect(isSameMonth(a, b)).toBe(true)
        })

        test('returns false for different months', () => {
            const a = new Date(2024, 0, 15)
            const b = new Date(2024, 1, 15)
            expect(isSameMonth(a, b)).toBe(false)
        })
    })

    describe('isSameQuarter', () => {
        test('returns true for same quarter', () => {
            const jan = new Date(2024, 0, 15)
            const mar = new Date(2024, 2, 15)
            expect(isSameQuarter(jan, mar)).toBe(true)
        })

        test('returns false for different quarters', () => {
            const q1 = new Date(2024, 0, 15)
            const q2 = new Date(2024, 3, 15)
            expect(isSameQuarter(q1, q2)).toBe(false)
        })
    })

    describe('isSameYear', () => {
        test('returns true for same year', () => {
            const jan = new Date(2024, 0, 1)
            const dec = new Date(2024, 11, 31)
            expect(isSameYear(jan, dec)).toBe(true)
        })

        test('returns false for different years', () => {
            const y2024 = new Date(2024, 0, 15)
            const y2025 = new Date(2025, 0, 15)
            expect(isSameYear(y2024, y2025)).toBe(false)
        })
    })

    describe('startOfDay', () => {
        test('returns start of day', () => {
            const date = new Date(2024, 0, 15, 14, 30, 45)
            const result = startOfDay(date)
            expect(result.getHours()).toBe(0)
            expect(result.getMinutes()).toBe(0)
            expect(result.getSeconds()).toBe(0)
            expect(result.getMilliseconds()).toBe(0)
        })
    })

    describe('startOfWeek', () => {
        test('returns Monday of the week', () => {
            // Wednesday January 17, 2024
            const date = new Date(2024, 0, 17)
            const result = startOfWeek(date)
            expect(result.getDay()).toBe(1) // Monday
            expect(result.getDate()).toBe(15)
        })

        test('returns same day if already Monday', () => {
            const monday = new Date(2024, 0, 15)
            const result = startOfWeek(monday)
            expect(result.getDate()).toBe(15)
        })
    })

    describe('startOfMonth', () => {
        test('returns first day of month', () => {
            const date = new Date(2024, 0, 15)
            const result = startOfMonth(date)
            expect(result.getDate()).toBe(1)
        })
    })

    describe('startOfQuarter', () => {
        test('returns first day of Q1', () => {
            const date = new Date(2024, 1, 15) // February
            const result = startOfQuarter(date)
            expect(result.getMonth()).toBe(0) // January
            expect(result.getDate()).toBe(1)
        })

        test('returns first day of Q2', () => {
            const date = new Date(2024, 4, 15) // May
            const result = startOfQuarter(date)
            expect(result.getMonth()).toBe(3) // April
            expect(result.getDate()).toBe(1)
        })
    })

    describe('startOfYear', () => {
        test('returns January 1st', () => {
            const date = new Date(2024, 6, 15) // July
            const result = startOfYear(date)
            expect(result.getMonth()).toBe(0)
            expect(result.getDate()).toBe(1)
        })
    })

    describe('getWeeksBetween', () => {
        test('returns array of week start dates', () => {
            const start = new Date(2024, 0, 1)
            const end = new Date(2024, 0, 21)
            const result = getWeeksBetween(start, end)
            expect(result.length).toBeGreaterThanOrEqual(3)
            // All results should be Mondays
            result.forEach((date) => {
                expect(date.getDay()).toBe(1)
            })
        })

        test('returns single week for same week dates', () => {
            const start = new Date(2024, 0, 15) // Monday
            const end = new Date(2024, 0, 17) // Wednesday
            const result = getWeeksBetween(start, end)
            expect(result.length).toBe(1)
        })
    })

    describe('formatDateISO', () => {
        test('formats as YYYY-MM-DD', () => {
            const date = new Date(2024, 0, 15)
            expect(formatDateISO(date)).toBe('2024-01-15')
        })

        test('pads single digit months and days', () => {
            const date = new Date(2024, 0, 5)
            expect(formatDateISO(date)).toBe('2024-01-05')
        })
    })

    describe('formatDateByGranularity', () => {
        const date = new Date(2024, 3, 15) // April 15, 2024

        test('formats daily as YYYY-MM-DD', () => {
            expect(formatDateByGranularity(date, TimeGranularity.Daily)).toBe('2024-04-15')
        })

        test('formats weekly as YYYY-Www', () => {
            const result = formatDateByGranularity(date, TimeGranularity.Weekly)
            expect(result).toMatch(/^2024-W\d{2}$/)
        })

        test('formats monthly as YYYY-MM', () => {
            expect(formatDateByGranularity(date, TimeGranularity.Monthly)).toBe('2024-04')
        })

        test('formats quarterly as YYYY-Qq', () => {
            expect(formatDateByGranularity(date, TimeGranularity.Quarterly)).toBe('2024-Q2')
        })

        test('formats yearly as YYYY', () => {
            expect(formatDateByGranularity(date, TimeGranularity.Yearly)).toBe('2024')
        })
    })

    describe('getMonthName', () => {
        test('returns short month name', () => {
            const january = new Date(2024, 0, 15)
            expect(getMonthName(january, 'short')).toBe('Jan')
        })

        test('returns long month name', () => {
            const january = new Date(2024, 0, 15)
            expect(getMonthName(january, 'long')).toBe('January')
        })

        test('defaults to short', () => {
            const january = new Date(2024, 0, 15)
            expect(getMonthName(january)).toBe('Jan')
        })
    })
})
