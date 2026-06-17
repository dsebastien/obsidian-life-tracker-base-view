import { describe, expect, test } from 'bun:test'
import type { HeatmapCell } from '../types'
import { TimeGranularity } from '../types'
import {
    getTimeKey,
    normalizeDate,
    incrementDate,
    matchesByGranularity,
    generateEmptyCells
} from './date-grouping.utils'

// ─── getTimeKey ───────────────────────────────────────────────────────────────

describe('getTimeKey', () => {
    describe('Daily', () => {
        test('returns YYYY-MM-DD', () => {
            expect(getTimeKey(new Date('2024-03-15'), TimeGranularity.Daily)).toBe('2024-03-15')
        })

        test('pads single-digit month and day', () => {
            expect(getTimeKey(new Date('2024-01-05'), TimeGranularity.Daily)).toBe('2024-01-05')
        })
    })

    describe('Weekly', () => {
        test('key is the Monday of the week in YYYY-MM-DD format', () => {
            // Wednesday 2024-03-13 → week starts Monday 2024-03-11
            const key = getTimeKey(new Date('2024-03-13'), TimeGranularity.Weekly)
            expect(key).toBe('2024-03-11')
        })

        test('Monday itself yields itself as the key', () => {
            const key = getTimeKey(new Date('2024-03-11'), TimeGranularity.Weekly)
            expect(key).toBe('2024-03-11')
        })

        test('Sunday crosses into previous week', () => {
            // Sunday 2024-03-10 belongs to the week starting 2024-03-04
            const key = getTimeKey(new Date('2024-03-10'), TimeGranularity.Weekly)
            expect(key).toBe('2024-03-04')
        })
    })

    describe('Monthly', () => {
        test('returns YYYY-MM', () => {
            expect(getTimeKey(new Date('2024-07-15'), TimeGranularity.Monthly)).toBe('2024-07')
        })

        test('pads single-digit month', () => {
            expect(getTimeKey(new Date('2024-01-31'), TimeGranularity.Monthly)).toBe('2024-01')
        })
    })

    describe('Quarterly', () => {
        test('Q1 for January', () => {
            expect(getTimeKey(new Date('2024-01-15'), TimeGranularity.Quarterly)).toBe('2024-Q1')
        })

        test('Q2 for April', () => {
            expect(getTimeKey(new Date('2024-04-01'), TimeGranularity.Quarterly)).toBe('2024-Q2')
        })

        test('Q3 for September', () => {
            expect(getTimeKey(new Date('2024-09-30'), TimeGranularity.Quarterly)).toBe('2024-Q3')
        })

        test('Q4 for December', () => {
            expect(getTimeKey(new Date('2024-12-31'), TimeGranularity.Quarterly)).toBe('2024-Q4')
        })
    })

    describe('Yearly', () => {
        test('returns YYYY', () => {
            expect(getTimeKey(new Date('2024-06-15'), TimeGranularity.Yearly)).toBe('2024')
        })
    })

    describe('ISO week boundary edge cases', () => {
        test('Jan 1 2024 (Monday) is in W1 2024, key starts on Jan 1', () => {
            // 2024-01-01 is a Monday → key = '2024-01-01'
            const key = getTimeKey(new Date('2024-01-01'), TimeGranularity.Weekly)
            expect(key).toBe('2024-01-01')
        })

        test('Dec 30 2024 (Monday) key is itself', () => {
            // 2024-12-30 is a Monday
            const key = getTimeKey(new Date('2024-12-30'), TimeGranularity.Weekly)
            expect(key).toBe('2024-12-30')
        })
    })
})

// ─── normalizeDate ────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
    test('Daily → start of day (midnight)', () => {
        const d = new Date('2024-03-15T14:30:00')
        const norm = normalizeDate(d, TimeGranularity.Daily)
        expect(norm.getHours()).toBe(0)
        expect(norm.getMinutes()).toBe(0)
        expect(norm.getSeconds()).toBe(0)
        expect(norm.getMilliseconds()).toBe(0)
    })

    test('Weekly → Monday of the week', () => {
        // Friday 2024-03-15 → Monday 2024-03-11
        const d = new Date('2024-03-15')
        const norm = normalizeDate(d, TimeGranularity.Weekly)
        expect(norm.getDay()).toBe(1) // Monday
        expect(norm.getDate()).toBe(11)
    })

    test('Monthly → first day of month', () => {
        const d = new Date('2024-07-25')
        const norm = normalizeDate(d, TimeGranularity.Monthly)
        expect(norm.getDate()).toBe(1)
        expect(norm.getMonth()).toBe(6) // July
    })

    test('Quarterly → first day of the quarter', () => {
        // August is in Q3, which starts in July
        const d = new Date('2024-08-15')
        const norm = normalizeDate(d, TimeGranularity.Quarterly)
        expect(norm.getMonth()).toBe(6) // July
        expect(norm.getDate()).toBe(1)
    })

    test('Yearly → January 1', () => {
        const d = new Date('2024-11-20')
        const norm = normalizeDate(d, TimeGranularity.Yearly)
        expect(norm.getMonth()).toBe(0)
        expect(norm.getDate()).toBe(1)
        expect(norm.getFullYear()).toBe(2024)
    })
})

// ─── incrementDate ────────────────────────────────────────────────────────────

describe('incrementDate', () => {
    test('Daily advances by exactly one day', () => {
        const d = new Date('2024-03-15')
        const next = incrementDate(d, TimeGranularity.Daily)
        expect(next.getDate()).toBe(16)
        expect(next.getMonth()).toBe(2) // March
    })

    test('Daily crosses month boundary', () => {
        const d = new Date('2024-03-31')
        const next = incrementDate(d, TimeGranularity.Daily)
        expect(next.getMonth()).toBe(3) // April
        expect(next.getDate()).toBe(1)
    })

    test('Weekly advances by exactly 7 days', () => {
        const d = new Date('2024-03-11') // Monday
        const next = incrementDate(d, TimeGranularity.Weekly)
        expect(next.getDate()).toBe(18)
        expect(next.getDay()).toBe(1) // still Monday
    })

    test('Monthly advances to the same day of next month', () => {
        const d = new Date('2024-01-15')
        const next = incrementDate(d, TimeGranularity.Monthly)
        expect(next.getMonth()).toBe(1) // February
        expect(next.getDate()).toBe(15)
    })

    test('Monthly crosses year boundary', () => {
        const d = new Date('2024-12-01')
        const next = incrementDate(d, TimeGranularity.Monthly)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(0) // January
    })

    test('Quarterly advances by 3 months', () => {
        const d = new Date('2024-01-01') // Q1 start
        const next = incrementDate(d, TimeGranularity.Quarterly)
        expect(next.getMonth()).toBe(3) // April = Q2 start
    })

    test('Yearly advances by 12 months', () => {
        const d = new Date('2024-01-01')
        const next = incrementDate(d, TimeGranularity.Yearly)
        expect(next.getFullYear()).toBe(2025)
        expect(next.getMonth()).toBe(0)
    })
})

// ─── matchesByGranularity ─────────────────────────────────────────────────────

describe('matchesByGranularity', () => {
    test('Daily: same date matches', () => {
        expect(
            matchesByGranularity(
                new Date('2024-03-15T08:00'),
                new Date('2024-03-15T20:00'),
                TimeGranularity.Daily
            )
        ).toBe(true)
    })

    test('Daily: different dates do not match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-03-15'),
                new Date('2024-03-16'),
                TimeGranularity.Daily
            )
        ).toBe(false)
    })

    test('Weekly: Monday and Friday of same week match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-03-11'), // Mon
                new Date('2024-03-15'), // Fri
                TimeGranularity.Weekly
            )
        ).toBe(true)
    })

    test('Weekly: different weeks do not match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-03-11'),
                new Date('2024-03-18'),
                TimeGranularity.Weekly
            )
        ).toBe(false)
    })

    test('Monthly: same month but different days match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-06-01'),
                new Date('2024-06-30'),
                TimeGranularity.Monthly
            )
        ).toBe(true)
    })

    test('Quarterly: Jan and Mar are in same quarter', () => {
        expect(
            matchesByGranularity(
                new Date('2024-01-01'),
                new Date('2024-03-31'),
                TimeGranularity.Quarterly
            )
        ).toBe(true)
    })

    test('Quarterly: Q1 and Q2 do not match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-03-31'),
                new Date('2024-04-01'),
                TimeGranularity.Quarterly
            )
        ).toBe(false)
    })

    test('Yearly: same year matches', () => {
        expect(
            matchesByGranularity(
                new Date('2024-01-01'),
                new Date('2024-12-31'),
                TimeGranularity.Yearly
            )
        ).toBe(true)
    })

    test('Yearly: different years do not match', () => {
        expect(
            matchesByGranularity(
                new Date('2024-12-31'),
                new Date('2025-01-01'),
                TimeGranularity.Yearly
            )
        ).toBe(false)
    })
})

// ─── generateEmptyCells ────────────────────────────────────────────────────────

describe('generateEmptyCells', () => {
    function cellMap(keys: string[]): Map<string, unknown> {
        return new Map(keys.map((k) => [k, true]))
    }

    test('generates daily cells for the given range', () => {
        const cells = generateEmptyCells(
            new Date('2024-01-01'),
            new Date('2024-01-03'),
            TimeGranularity.Daily,
            new Map()
        )
        expect(cells).toHaveLength(3)
        cells.forEach((c) => {
            expect(c.value).toBeNull()
            expect(c.count).toBe(0)
            expect(c.filePaths).toHaveLength(0)
        })
    })

    test('skips dates already in existingCells map', () => {
        const existing = cellMap(['2024-01-02'])
        const cells = generateEmptyCells(
            new Date('2024-01-01'),
            new Date('2024-01-03'),
            TimeGranularity.Daily,
            existing
        )
        // 2024-01-02 is skipped → 2 cells
        expect(cells).toHaveLength(2)
        const dates = cells.map((c) => c.date.getDate())
        expect(dates).not.toContain(2)
    })

    test('returns empty array when all cells already exist', () => {
        const existing = cellMap(['2024-01-01', '2024-01-02', '2024-01-03'])
        const cells = generateEmptyCells(
            new Date('2024-01-01'),
            new Date('2024-01-03'),
            TimeGranularity.Daily,
            existing
        )
        expect(cells).toHaveLength(0)
    })

    test('generates weekly cells — one per week in range', () => {
        const cells = generateEmptyCells(
            new Date('2024-03-11'), // Monday W11
            new Date('2024-03-25'), // Monday W13
            TimeGranularity.Weekly,
            new Map()
        )
        expect(cells).toHaveLength(3)
        // All should be Mondays
        cells.forEach((c) => expect(c.date.getDay()).toBe(1))
    })

    test('year boundary edge case — Dec 31 to Jan 2 produces 3 daily cells', () => {
        const cells = generateEmptyCells(
            new Date('2024-12-31'),
            new Date('2025-01-02'),
            TimeGranularity.Daily,
            new Map()
        )
        expect(cells).toHaveLength(3)
    })

    test('single-day range produces exactly one cell', () => {
        const cells = generateEmptyCells(
            new Date('2024-06-15'),
            new Date('2024-06-15'),
            TimeGranularity.Daily,
            new Map()
        )
        expect(cells).toHaveLength(1)
    })

    test('HeatmapCell structure is correct', () => {
        const cells = generateEmptyCells(
            new Date('2024-01-01'),
            new Date('2024-01-01'),
            TimeGranularity.Daily,
            new Map()
        )
        const cell = cells[0] as HeatmapCell
        expect(cell.value).toBeNull()
        expect(cell.count).toBe(0)
        expect(cell.filePaths).toEqual([])
        expect(cell.date).toBeInstanceOf(Date)
    })
})
