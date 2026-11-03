import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    cartesianInteraction,
    extent,
    HALF_DAY_MS,
    TIME_AXIS_MAX_BAR_THICKNESS,
    TIME_AXIS_MIN_BAR_THICKNESS,
    timeAxisBarThickness,
    timeAxisBounds,
    timeAxisRange
} from './time-axis.utils'
import { timeXAxis } from './chart-initializers'
import { TimeGranularity, type ChartConfig } from '../../../types'

const chartConfig = {
    granularity: TimeGranularity.Daily,
    showEmptyValues: false,
    embeddedHeight: 300,
    chartType: 'line',
    showLegend: false,
    showGrid: true,
    tension: 0.3
} as ChartConfig

const DAY = 24 * 3600_000

describe('extent', () => {
    test('min and max without spreading the array', () => {
        expect(extent([3, 1, 2])).toEqual({ min: 1, max: 3 })
        expect(extent([])).toBeUndefined()
        const long = Array.from({ length: 200_000 }, (_, i) => i)
        expect(extent(long)).toEqual({ min: 0, max: 199_999 })
    })
})

describe('timeAxisRange', () => {
    const base = {
        propertyId: 'note.pace' as BasesPropertyId,
        displayName: 'Pace',
        labels: ['a', 'b', 'c'],
        datasets: []
    }

    test('reads the x values, undefined on category axes', () => {
        expect(timeAxisRange(base)).toBeUndefined()
        expect(timeAxisRange({ ...base, xValues: [3000, 1000, 2000] })).toEqual({
            min: 1000,
            max: 3000
        })
    })
})

describe('timeAxisBounds', () => {
    test('lines: first to last note, with a 2% margin at each end', () => {
        expect(timeAxisBounds([3000, 1000, 2000])).toEqual({ min: 960, max: 3040 })
    })

    test('bars: a fixed half day at each end, never an offset', () => {
        const start = Date.UTC(2025, 5, 1)
        expect(timeAxisBounds([start, start + 30 * DAY], true)).toEqual({
            min: start - HALF_DAY_MS,
            max: start + 30 * DAY + HALF_DAY_MS
        })
    })

    test('a single instant gets half a day on each side', () => {
        const day = Date.UTC(2025, 5, 24)
        expect(timeAxisBounds([day, day])).toEqual({
            min: day - HALF_DAY_MS,
            max: day + HALF_DAY_MS
        })
    })
})

describe('timeAxisBarThickness', () => {
    test('80% of the smallest pixel gap', () => {
        // 10 days over 1000 px: one day is 100 px, bars 80 px → capped
        const xs = [0, DAY, 2 * DAY]
        expect(timeAxisBarThickness(xs, 1000, 0, 10 * DAY)).toBe(TIME_AXIS_MAX_BAR_THICKNESS)
        // 100 days over 1000 px: one day is 10 px → 8 px bars
        expect(timeAxisBarThickness(xs, 1000, 0, 100 * DAY)).toBe(8)
    })

    test('a year of runs never draws hairlines', () => {
        const xs = Array.from({ length: 170 }, (_, i) => i * 2 * DAY)
        expect(timeAxisBarThickness(xs, 600, 0, 365 * DAY)).toBe(TIME_AXIS_MIN_BAR_THICKNESS)
    })

    test('same-instant duplicates do not collapse the gap to zero', () => {
        expect(timeAxisBarThickness([0, 0, 10 * DAY], 1000, 0, 100 * DAY)).toBe(
            TIME_AXIS_MAX_BAR_THICKNESS
        )
    })

    test('degenerate axes fall back to the minimum', () => {
        expect(timeAxisBarThickness([0], 0, 0, DAY)).toBe(TIME_AXIS_MIN_BAR_THICKNESS)
        expect(timeAxisBarThickness([0], 500, 0, 0)).toBe(TIME_AXIS_MIN_BAR_THICKNESS)
    })
})

describe('cartesianInteraction', () => {
    test('period axes list every series at the hovered index', () => {
        expect(cartesianInteraction(false)).toEqual({ mode: 'index', intersect: false })
    })

    test('the time axis reaches each note, even a few pixels apart', () => {
        expect(cartesianInteraction(true)).toEqual({
            mode: 'nearest',
            axis: 'xy',
            intersect: false
        })
    })
})

describe('timeXAxis (date-per-note x scale)', () => {
    const start = Date.UTC(2025, 5, 1)
    const xs = [start, start + DAY, start + 5 * DAY]

    test('bars: linear, no offset, half a day of room at each end', () => {
        const axis = timeXAxis(xs, { ...chartConfig, chartType: 'bar' })
        expect(axis.type).toBe('linear')
        expect(axis.offset).toBe(false)
        expect(axis.min).toBe(start - HALF_DAY_MS)
        expect(axis.max).toBe(start + 5 * DAY + HALF_DAY_MS)
    })

    test('lines: no offset either, labels stay horizontal', () => {
        const axis = timeXAxis(xs, chartConfig)
        expect(axis.offset).toBe(false)
        expect(axis.ticks?.maxRotation).toBe(0)
        expect(axis.ticks?.autoSkip).toBe(true)
    })
})
