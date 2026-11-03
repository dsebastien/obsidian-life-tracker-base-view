import { describe, expect, test } from 'bun:test'
import {
    GAP_MIN_MS,
    computeSegmentedMovingAverage,
    findGapBreaks,
    gapBreaksFor,
    gapThreshold,
    isGapSegment
} from './series-gaps.utils'
import { computeMovingAverage } from './chart-aggregation.utils'
import { TimeGranularity, type ChartConfig, type ChartData } from '../types'

const DAY = 24 * 3600_000

/** Epoch ms of day `n` after an arbitrary origin */
const day = (n: number): number => Date.UTC(2025, 0, 1) + n * DAY

describe('gapThreshold (issue #185)', () => {
    test('is 3 × the median gap when that exceeds two weeks', () => {
        // Monthly points: median gap 30 days → 90 days
        const times = [0, 30, 60, 90, 120].map(day)
        expect(gapThreshold(times, [1, 2, 3, 4, 5])).toBe(90 * DAY)
    })

    test('never drops below 14 days', () => {
        const times = [0, 1, 2, 3].map(day)
        expect(gapThreshold(times, [1, 2, 3, 4])).toBe(GAP_MIN_MS)
    })

    test('ignores slots without a value or a time', () => {
        const times = [day(0), day(1), undefined, day(30), day(60)]
        // Points at 0, 30, 60 (day 1 has no value): median gap 30 days
        expect(gapThreshold(times, [1, null, 3, 4, 5])).toBe(90 * DAY)
    })

    test('undefined with fewer than two points', () => {
        expect(gapThreshold([day(0)], [1])).toBeUndefined()
        expect(gapThreshold([], [])).toBeUndefined()
    })
})

describe('findGapBreaks (issue #185)', () => {
    test('breaks before a point far from the previous one', () => {
        // Runs every few days in November, then nothing until March
        const times = [0, 3, 6, 9, 12, 100, 103, 106].map(day)
        const values = [380, 385, 390, 377, 395, 388, 383, 379]
        expect(findGapBreaks(times, values)).toEqual([
            false,
            false,
            false,
            false,
            false,
            true,
            false,
            false
        ])
    })

    test('a gap of exactly the threshold does not break', () => {
        const times = [0, 1, 2, 3, 17].map(day)
        expect(findGapBreaks(times, [1, 1, 1, 1, 1])).toEqual([false, false, false, false, false])
    })

    test('a gap just over the threshold breaks', () => {
        const times = [0, 1, 2, 3, 3 + 15].map(day)
        expect(findGapBreaks(times, [1, 1, 1, 1, 1])[4]).toBe(true)
    })

    test('measures from the previous point with a value, across empty slots', () => {
        // Empty periods at days 5 and 10 draw nothing: the gap runs 0 → 40
        const times = [0, 1, 2, 5, 10, 40].map(day)
        expect(findGapBreaks(times, [1, 1, 1, null, null, 1])).toEqual([
            false,
            false,
            false,
            false,
            false,
            true
        ])
    })

    test('regular data never breaks', () => {
        const times = [0, 7, 14, 21, 28].map(day)
        expect(findGapBreaks(times, [1, 2, 3, 4, 5]).some(Boolean)).toBe(false)
    })

    test('nothing to break with one point', () => {
        expect(findGapBreaks([day(0)], [1])).toEqual([false])
    })
})

describe('computeSegmentedMovingAverage (issue #185)', () => {
    test('without breaks it is the plain moving average', () => {
        const values = [1, 2, 3, 4, 5]
        expect(computeSegmentedMovingAverage(values, 3, undefined)).toEqual(
            computeMovingAverage(values, 3)
        )
    })

    test('a window never reaches across a gap', () => {
        const values = [10, 10, 10, 50, 50]
        const breaks = [false, false, false, true, false]
        // Plain average at index 3 would be (10 + 10 + 50) / 3; per segment it restarts
        expect(computeSegmentedMovingAverage(values, 3, breaks)).toEqual([10, 10, 10, 50, 50])
    })

    test('keeps nulls as gaps inside a segment', () => {
        const values = [null, 4, null, 8]
        const breaks = [false, false, false, true]
        expect(computeSegmentedMovingAverage(values, 2, breaks)).toEqual([null, 4, 4, 8])
    })

    test('keeps the length of the input', () => {
        const breaks = [false, true, true, false]
        expect(computeSegmentedMovingAverage([1, 2, 3, 4], 7, breaks)).toHaveLength(4)
    })
})

describe('isGapSegment (issue #185)', () => {
    test('true only for the segment ending at a break', () => {
        const breaks = [false, false, true]
        expect(isGapSegment(breaks, 2)).toBe(true)
        expect(isGapSegment(breaks, 1)).toBe(false)
        expect(isGapSegment(undefined, 2)).toBe(false)
        expect(isGapSegment(breaks, 9)).toBe(false)
    })
})

describe('gapBreaksFor (issue #185)', () => {
    const lineConfig: ChartConfig = {
        granularity: TimeGranularity.Daily,
        showEmptyValues: false,
        embeddedHeight: 400,
        chartType: 'line',
        showLegend: false,
        showGrid: true,
        tension: 0.3
    }

    /** Ten daily values, then one 60 days later */
    const times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 69].map(day)
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

    function chartData(extra: Partial<ChartData>): ChartData {
        return {
            propertyId: 'note.pace',
            displayName: 'Pace',
            labels: values.map(String),
            datasets: [{ label: 'Pace', data: values, filePaths: values.map(() => []) }],
            ...extra
        }
    }

    test('on by default on the period axis', () => {
        expect(gapBreaksFor(chartData({ periodTimes: times }), lineConfig)?.[10]).toBe(true)
    })

    test('on by default on the date-per-note axis', () => {
        const config = { ...lineConfig, xAxisSource: 'date-per-note' as const }
        expect(gapBreaksFor(chartData({ xValues: times }), config)?.[10]).toBe(true)
    })

    test('off when the card turns it off', () => {
        const config = { ...lineConfig, breakLineAcrossGaps: false }
        expect(gapBreaksFor(chartData({ periodTimes: times }), config)).toBeUndefined()
    })

    test('never on the note-name axis, bar charts, or several datasets', () => {
        const noteName = { ...lineConfig, xAxisSource: 'note-name' as const }
        expect(gapBreaksFor(chartData({ periodTimes: times }), noteName)).toBeUndefined()

        const bar = { ...lineConfig, chartType: 'bar' as const }
        expect(gapBreaksFor(chartData({ periodTimes: times }), bar)).toBeUndefined()

        const twoSeries = chartData({ periodTimes: times })
        twoSeries.datasets.push({ label: 'B', data: values, filePaths: [] })
        expect(gapBreaksFor(twoSeries, lineConfig)).toBeUndefined()
    })

    test('undefined when nothing breaks', () => {
        expect(
            gapBreaksFor(chartData({ periodTimes: values.map((_, i) => day(i)) }), lineConfig)
        ).toBeUndefined()
    })
})
