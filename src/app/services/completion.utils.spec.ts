import { describe, expect, test } from 'bun:test'
import {
    computeCompletionStats,
    describeCompletionStats,
    formatCompletionStats,
    isBooleanSeries
} from './completion.utils'
import type { VisualizationDataPoint } from '../types'

function point(
    filePath: string,
    booleanValue: boolean | null,
    numericValue: number | null = booleanValue === null ? null : booleanValue ? 1 : 0
): VisualizationDataPoint {
    return {
        filePath,
        dateAnchor: null,
        numericValue,
        booleanValue,
        displayLabel: null,
        listValues: []
    }
}

describe('isBooleanSeries (issue #161)', () => {
    test('a series of booleans is boolean', () => {
        expect(isBooleanSeries([point('a.md', true), point('b.md', false)])).toBe(true)
    })

    test('a numeric series is not, even when its values are 0 and 1', () => {
        // The record must survive for a real number property that happens to
        // hold only 0/1 — the values are read, but `booleanValue` is what says
        // the property is a checkbox.
        expect(isBooleanSeries([point('a.md', null, 1), point('b.md', null, 0)])).toBe(false)
    })

    test('one real number disqualifies an otherwise boolean series', () => {
        expect(isBooleanSeries([point('a.md', true), point('b.md', null, 42)])).toBe(false)
    })

    test('absent entries neither qualify nor disqualify', () => {
        expect(isBooleanSeries([point('a.md', true), point('b.md', null)])).toBe(true)
        expect(isBooleanSeries([point('a.md', null)])).toBe(false)
        expect(isBooleanSeries([])).toBe(false)
    })
})

describe('computeCompletionStats (issue #161)', () => {
    test('counts ticked periods against every period on screen', () => {
        expect(computeCompletionStats([1, null, 1, 0])).toEqual({
            checked: 2,
            tracked: 4,
            rate: 0.5
        })
    })

    test('an empty period counts against the total — that is the whole point', () => {
        // The bug this guards: counting only recorded entries turns a habit
        // logged solely on the days it was done into a triumphant 42/42 (100%).
        expect(computeCompletionStats([1, null, null, null])).toEqual({
            checked: 1,
            tracked: 4,
            rate: 0.25
        })
    })

    test('zero reads as not done, matching heatmap rendering and streaks', () => {
        expect(computeCompletionStats([0, 0, 1])).toEqual({ checked: 1, tracked: 3, rate: 1 / 3 })
    })

    test('no periods yields a zero rate rather than NaN', () => {
        expect(computeCompletionStats([])).toEqual({ checked: 0, tracked: 0, rate: 0 })
    })
})

describe('formatCompletionStats (issue #161)', () => {
    test('reads as a fraction with a whole-number percentage', () => {
        expect(formatCompletionStats({ checked: 42, tracked: 90, rate: 42 / 90 }, 'day')).toBe(
            '✅ Checked: 42/90 days (47%)'
        )
    })

    test('carries the granularity unit', () => {
        expect(formatCompletionStats({ checked: 2, tracked: 4, rate: 0.5 }, 'week')).toBe(
            '✅ Checked: 2/4 weeks (50%)'
        )
        expect(formatCompletionStats({ checked: 1, tracked: 1, rate: 1 }, 'month')).toBe(
            '✅ Checked: 1/1 month (100%)'
        )
    })

    test('a perfect and an empty record both read cleanly', () => {
        expect(formatCompletionStats({ checked: 3, tracked: 3, rate: 1 }, 'day')).toBe(
            '✅ Checked: 3/3 days (100%)'
        )
        expect(formatCompletionStats({ checked: 0, tracked: 3, rate: 0 }, 'day')).toBe(
            '✅ Checked: 0/3 days (0%)'
        )
    })
})

describe('describeCompletionStats (issue #161)', () => {
    test('spells the chip out for the tooltip', () => {
        expect(describeCompletionStats({ checked: 42, tracked: 90, rate: 42 / 90 }, 'day')).toBe(
            'Checked on 42 of the 90 days shown (47%)'
        )
    })

    test('a single period stays singular', () => {
        expect(describeCompletionStats({ checked: 1, tracked: 1, rate: 1 }, 'week')).toBe(
            'Checked on 1 of the 1 week shown (100%)'
        )
    })
})
