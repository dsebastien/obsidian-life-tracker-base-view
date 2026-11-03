import { test, expect, describe } from 'bun:test'
import {
    areAllValuesIntegers,
    formatMetricValue,
    missingDateAriaLabel,
    missingDateText,
    stripNoteTypeSuffix,
    trendWindowLabel
} from './chart-format.utils'

describe('areAllValuesIntegers', () => {
    test('true for whole numbers and nulls', () => {
        expect(areAllValuesIntegers([1, 2, 3])).toBe(true)
        expect(areAllValuesIntegers([0, null, 5, undefined])).toBe(true)
        expect(areAllValuesIntegers([])).toBe(true)
    })

    test('false when any value has a fractional part', () => {
        expect(areAllValuesIntegers([1, 2.5, 3])).toBe(false)
        expect(areAllValuesIntegers([0.1])).toBe(false)
    })

    test('negative integers count as integers', () => {
        expect(areAllValuesIntegers([-1, -2, 0])).toBe(true)
    })
})

describe('formatMetricValue', () => {
    test('drops decimals for integer-only datasets', () => {
        expect(formatMetricValue(3, true)).toBe('3')
        expect(formatMetricValue(3.0, true)).toBe('3')
    })

    test('keeps up to two decimals otherwise', () => {
        expect(formatMetricValue(3.5, false)).toBe('3.5')
        expect(formatMetricValue(3, false)).toBe('3')
    })

    test('rounds to at most two fraction digits', () => {
        expect(formatMetricValue(3.14159, false)).toBe('3.14')
    })
})

describe('stripNoteTypeSuffix (3.4.0)', () => {
    test('drops one trailing type suffix', () => {
        expect(stripNoteTypeSuffix('2025-06-24 (Running Session)')).toBe('2025-06-24')
        expect(stripNoteTypeSuffix('Dune (Book)')).toBe('Dune')
        expect(stripNoteTypeSuffix('2025-06-24 2 (Strength Session)')).toBe('2025-06-24 2')
    })

    test('only the last suffix goes', () => {
        expect(stripNoteTypeSuffix('Dune (1965) (Book)')).toBe('Dune (1965)')
    })

    test('names without a trailing suffix are untouched', () => {
        expect(stripNoteTypeSuffix('Dune')).toBe('Dune')
        expect(stripNoteTypeSuffix('Notes (draft) final')).toBe('Notes (draft) final')
        expect(stripNoteTypeSuffix('2025-06-24')).toBe('2025-06-24')
    })

    test('a name that is only a suffix is kept', () => {
        expect(stripNoteTypeSuffix('(Inbox)')).toBe('(Inbox)')
    })
})

describe('trendWindowLabel (3.4.0)', () => {
    test('periods on the period axes, notes on the per-note axes', () => {
        expect(trendWindowLabel(7, false)).toBe('vs previous 7 periods')
        expect(trendWindowLabel(7, true)).toBe('vs previous 7 notes')
        expect(trendWindowLabel(1, true)).toBe('vs previous 1 note')
        expect(trendWindowLabel(1, false)).toBe('vs previous 1 period')
    })
})

describe('missing date chip (3.4.0)', () => {
    test('text and accessible label both carry the count', () => {
        expect(missingDateText(1)).toBe('1 note without a date')
        expect(missingDateText(3)).toBe('3 notes without a date')
        expect(missingDateAriaLabel(3)).toContain('3 notes without a date')
    })
})
