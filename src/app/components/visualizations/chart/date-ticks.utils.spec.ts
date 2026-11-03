import { describe, expect, test } from 'bun:test'
import { format } from 'date-fns'
import { buildDateTicks } from './date-ticks.utils'
import { timeAxisBounds } from './time-axis.utils'

/** Local-midnight epoch ms for a calendar day */
function day(year: number, month: number, date: number): number {
    return new Date(year, month - 1, date).getTime()
}

function labels(min: number, max: number, maxTicks: number): string[] {
    const ticks = buildDateTicks(min, max, maxTicks)
    return ticks.values.map((v) => format(new Date(v), ticks.format))
}

describe('buildDateTicks (3.4.0)', () => {
    test('a short span ticks daily', () => {
        expect(labels(day(2025, 6, 20), day(2025, 6, 24), 10)).toEqual([
            'Jun 20',
            'Jun 21',
            'Jun 22',
            'Jun 23',
            'Jun 24'
        ])
    })

    test('a narrow axis coarsens the step', () => {
        const ticks = buildDateTicks(day(2025, 6, 1), day(2025, 6, 30), 5)
        expect(ticks.values.length).toBeLessThanOrEqual(5)
        expect(ticks.values.length).toBeGreaterThanOrEqual(1)
    })

    test('a year of runs ticks on month starts, aligned with January', () => {
        const result = labels(day(2025, 1, 10), day(2025, 12, 20), 6)
        expect(result).toEqual(['Mar 2025', 'May 2025', 'Jul 2025', 'Sep 2025', 'Nov 2025'])
    })

    test('quarters start in January, April, July, October', () => {
        const result = labels(day(2024, 2, 1), day(2025, 12, 1), 8)
        expect(result).toEqual([
            'Apr 2024',
            'Jul 2024',
            'Oct 2024',
            'Jan 2025',
            'Apr 2025',
            'Jul 2025',
            'Oct 2025'
        ])
    })

    test('multi-year spans tick on years', () => {
        expect(labels(day(2015, 3, 1), day(2025, 3, 1), 6)).toEqual([
            '2016',
            '2018',
            '2020',
            '2022',
            '2024'
        ])
    })

    test('day labels carry the year when the span crosses one', () => {
        const ticks = buildDateTicks(day(2024, 12, 30), day(2025, 1, 2), 10)
        expect(ticks.format).toBe('MMM d, yyyy')
    })

    test('ticks never fall outside the span', () => {
        const min = day(2025, 6, 20) + 3600_000
        const max = day(2025, 6, 23)
        const ticks = buildDateTicks(min, max, 10)
        for (const value of ticks.values) {
            expect(value).toBeGreaterThanOrEqual(min)
            expect(value).toBeLessThanOrEqual(max)
        }
        expect(ticks.values[0]).toBe(day(2025, 6, 21))
    })

    test('a single day, as the axis really pads it, gets one tick on that day', () => {
        // Every note on one day: the axis spans that midnight ± half a day
        const bounds = timeAxisBounds([day(2025, 6, 24)])
        const ticks = buildDateTicks(bounds.min, bounds.max, 10)
        expect(ticks.values).toEqual([day(2025, 6, 24)])
        expect(ticks.format).toBe('MMM d')
    })

    test('a degenerate zero-width span still gets a tick', () => {
        const ticks = buildDateTicks(day(2025, 6, 24), day(2025, 6, 24), 10)
        expect(ticks.values).toEqual([day(2025, 6, 24)])
    })

    test('2-day ticks stay on the same days when an earlier note is added', () => {
        const later = buildDateTicks(day(2025, 6, 11), day(2025, 6, 24), 7)
        const earlier = buildDateTicks(day(2025, 6, 10), day(2025, 6, 24), 7)
        const shared = later.values.filter((v) => v >= day(2025, 6, 11))
        expect(earlier.values.filter((v) => v >= day(2025, 6, 11))).toEqual(shared)
        expect(later.values.length).toBeGreaterThan(1)
        const gap = (later.values[1]! - later.values[0]!) / 86_400_000
        expect(Math.round(gap)).toBe(2)
    })

    test('a few hours inside one day still get a tick', () => {
        const min = day(2025, 6, 24) + 8 * 3600_000
        const max = min + 3 * 3600_000
        expect(buildDateTicks(min, max, 10).values).toEqual([min])
    })
})
