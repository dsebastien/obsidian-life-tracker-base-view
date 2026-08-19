import { describe, expect, test } from 'bun:test'
import {
    computeRecord,
    formatRecordValue,
    isRecordImprovement,
    shouldAnnounceRecord
} from './record.utils'
import type { VisualizationDataPoint } from '../types'

function point(
    filePath: string,
    numericValue: number | null,
    dateStr?: string
): VisualizationDataPoint {
    return {
        filePath,
        dateAnchor: dateStr
            ? {
                  date: new Date(dateStr),
                  source: { type: 'filename', pattern: 'YYYY-MM-DD' },
                  confidence: 'high'
              }
            : null,
        numericValue,
        booleanValue: null,
        displayLabel: numericValue === null ? null : String(numericValue),
        listValues: []
    }
}

describe('computeRecord (issue #56)', () => {
    const points = [
        point('a.md', 10, '2025-01-01'),
        point('b.md', 30, '2025-01-02'),
        point('c.md', null, '2025-01-03'),
        point('d.md', 5, '2025-01-04')
    ]

    test('neutral or missing polarity yields no record (no-judgement rule)', () => {
        expect(computeRecord(points, 'neutral')).toBeNull()
        expect(computeRecord(points, undefined)).toBeNull()
    })

    test('higher-is-better records the maximum', () => {
        const record = computeRecord(points, 'higher-is-better')
        expect(record?.value).toBe(30)
        expect(record?.filePath).toBe('b.md')
        expect(record?.date?.toISOString().slice(0, 10)).toBe('2025-01-02')
    })

    test('lower-is-better records the minimum', () => {
        const record = computeRecord(points, 'lower-is-better')
        expect(record?.value).toBe(5)
        expect(record?.filePath).toBe('d.md')
    })

    test('ties keep the earliest entry', () => {
        const tied = [point('first.md', 30, '2025-01-01'), point('later.md', 30, '2025-02-01')]
        expect(computeRecord(tied, 'higher-is-better')?.filePath).toBe('first.md')
    })

    test('no numeric values yields no record', () => {
        expect(computeRecord([point('a.md', null)], 'higher-is-better')).toBeNull()
        expect(computeRecord([], 'higher-is-better')).toBeNull()
    })

    test('an entry without a date anchor can still hold the record', () => {
        const record = computeRecord([point('undated.md', 50)], 'higher-is-better')
        expect(record?.value).toBe(50)
        expect(record?.date).toBeNull()
    })
})

describe('isRecordImprovement (issue #56)', () => {
    test('a strictly better value is an improvement', () => {
        expect(
            isRecordImprovement(20, { value: 30, date: null, filePath: 'a.md' }, 'higher-is-better')
        ).toBe(true)
        expect(
            isRecordImprovement(10, { value: 5, date: null, filePath: 'a.md' }, 'lower-is-better')
        ).toBe(true)
    })

    test('the same or a worse value is not', () => {
        expect(
            isRecordImprovement(30, { value: 30, date: null, filePath: 'a.md' }, 'higher-is-better')
        ).toBe(false)
        expect(
            isRecordImprovement(30, { value: 20, date: null, filePath: 'a.md' }, 'higher-is-better')
        ).toBe(false)
    })

    test('no previous value means nothing to improve on (first render stays silent)', () => {
        expect(
            isRecordImprovement(
                null,
                { value: 30, date: null, filePath: 'a.md' },
                'higher-is-better'
            )
        ).toBe(false)
    })

    test('neutral polarity never announces', () => {
        expect(
            isRecordImprovement(20, { value: 30, date: null, filePath: 'a.md' }, 'neutral')
        ).toBe(false)
    })
})

describe('formatRecordValue', () => {
    test('integers stay bare', () => {
        expect(formatRecordValue(30)).toBe('30')
    })

    test('fractions keep up to two decimals', () => {
        expect(formatRecordValue(7.256)).toBe('7.26')
        expect(formatRecordValue(7.5)).toBe('7.5')
    })
})

describe('shouldAnnounceRecord (issue #56)', () => {
    test('announces once per property + value within the window', () => {
        expect(shouldAnnounceRecord('note.test_prop_a', 42)).toBe(true)
        expect(shouldAnnounceRecord('note.test_prop_a', 42)).toBe(false)
        // A different value or property announces independently
        expect(shouldAnnounceRecord('note.test_prop_a', 43)).toBe(true)
        expect(shouldAnnounceRecord('note.test_prop_b', 42)).toBe(true)
    })
})
