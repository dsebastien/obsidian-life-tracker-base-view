import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { TimeGranularity, type VisualizationDataPoint } from '../types'
import {
    aggregateForRangeChart,
    formatHoursAsTime,
    parseRangeValue
} from './range-aggregation.utils'
import type { OverlayPropertyData } from './chart-aggregation.utils'

function point(
    filePath: string,
    dateStr: string | null,
    rawValue: string | null,
    numericValue: number | null = null
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
        displayLabel: rawValue,
        listValues: rawValue ? [rawValue] : []
    }
}

function propertyData(
    propertyId: string,
    displayName: string,
    dataPoints: VisualizationDataPoint[]
): OverlayPropertyData {
    return { propertyId: propertyId as BasesPropertyId, displayName, dataPoints }
}

describe('parseRangeValue (issue #81)', () => {
    test('parses a bare time of day', () => {
        expect(parseRangeValue(point('a.md', null, '23:30'))).toEqual({
            hours: 23.5,
            isTime: true
        })
        expect(parseRangeValue(point('a.md', null, '7:15'))).toEqual({
            hours: 7.25,
            isTime: true
        })
    })

    test('parses the time part of an ISO datetime', () => {
        expect(parseRangeValue(point('a.md', null, '2026-01-01T06:45'))).toEqual({
            hours: 6.75,
            isTime: true
        })
    })

    test('rejects impossible clock times and falls through to numbers', () => {
        expect(parseRangeValue(point('a.md', null, '25:99', 5))).toEqual({
            hours: 5,
            isTime: false
        })
    })

    test('uses the numeric value when the string is not a time', () => {
        expect(parseRangeValue(point('a.md', null, '7.5', 7.5))).toEqual({
            hours: 7.5,
            isTime: false
        })
    })

    test('yields null when nothing is parseable', () => {
        expect(parseRangeValue(point('a.md', null, null))).toBeNull()
    })
})

describe('formatHoursAsTime (issue #81)', () => {
    test('formats within the day', () => {
        expect(formatHoursAsTime(23.5)).toBe('23:30')
        expect(formatHoursAsTime(7.25)).toBe('07:15')
        expect(formatHoursAsTime(0)).toBe('00:00')
    })

    test('wraps past midnight', () => {
        expect(formatHoursAsTime(31.25)).toBe('07:15')
        expect(formatHoursAsTime(24)).toBe('00:00')
    })

    test('carries rounded-up minutes', () => {
        expect(formatHoursAsTime(7.9999)).toBe('08:00')
    })
})

describe('aggregateForRangeChart (issue #81)', () => {
    test('builds one floating bar per period from start to end', () => {
        const start = propertyData('note.to_bed', 'To Bed', [
            point('2026-01-01.md', '2026-01-01', '22:00'),
            point('2026-01-02.md', '2026-01-02', '23:30')
        ])
        const end = propertyData('note.wake_up', 'Wake Up', [
            point('2026-01-01.md', '2026-01-01', '06:00'),
            point('2026-01-02.md', '2026-01-02', '07:15')
        ])

        const result = aggregateForRangeChart(start, end, 'Sleep', TimeGranularity.Daily)

        expect(result.timeMode).toBe(true)
        expect(result.startLabel).toBe('To Bed')
        expect(result.endLabel).toBe('Wake Up')
        expect(result.labels).toHaveLength(2)
        // Ends before their starts cross midnight: 06:00 → 30h
        expect(result.bars).toEqual([
            [22, 30],
            [23.5, 31.25]
        ])
        expect(result.filePaths[0]).toEqual(['2026-01-01.md'])
    })

    test('periods missing either side yield null, never a made-up bar', () => {
        const start = propertyData('note.start', 'Start', [
            point('2026-01-01.md', '2026-01-01', '09:00'),
            point('2026-01-02.md', '2026-01-02', '09:00')
        ])
        const end = propertyData('note.end', 'End', [point('2026-01-01.md', '2026-01-01', '17:00')])

        const result = aggregateForRangeChart(start, end, 'Work', TimeGranularity.Daily)

        expect(result.bars).toEqual([[9, 17], null])
    })

    test('starts straddling midnight cluster on one band', () => {
        const start = propertyData('note.to_bed', 'To Bed', [
            point('2026-01-01.md', '2026-01-01', '23:30'),
            point('2026-01-02.md', '2026-01-02', '00:30')
        ])
        const end = propertyData('note.wake_up', 'Wake Up', [
            point('2026-01-01.md', '2026-01-01', '07:00'),
            point('2026-01-02.md', '2026-01-02', '08:00')
        ])

        const result = aggregateForRangeChart(start, end, 'Sleep', TimeGranularity.Daily)

        // 00:30 → 24.5 so it sits above 23:30 instead of at the axis bottom
        expect(result.bars).toEqual([
            [23.5, 31],
            [24.5, 32]
        ])
    })

    test('day ranges that never cross midnight stay unshifted', () => {
        const start = propertyData('note.start', 'Start', [
            point('a.md', '2026-01-01', '09:00'),
            point('b.md', '2026-01-02', '10:00')
        ])
        const end = propertyData('note.end', 'End', [
            point('a.md', '2026-01-01', '17:00'),
            point('b.md', '2026-01-02', '18:30')
        ])

        const result = aggregateForRangeChart(start, end, 'Work', TimeGranularity.Daily)

        expect(result.bars).toEqual([
            [9, 17],
            [10, 18.5]
        ])
    })

    test('plain numeric properties produce a numeric (non-time) range', () => {
        const start = propertyData('note.min', 'Min', [point('a.md', '2026-01-01', '60', 60)])
        const end = propertyData('note.max', 'Max', [point('a.md', '2026-01-01', '80', 80)])

        const result = aggregateForRangeChart(start, end, 'Spread', TimeGranularity.Daily)

        expect(result.timeMode).toBe(false)
        expect(result.bars).toEqual([[60, 80]])
    })

    test('numeric mode never applies the midnight shift, even inverted', () => {
        const start = propertyData('note.a', 'A', [point('a.md', '2026-01-01', '80', 80)])
        const end = propertyData('note.b', 'B', [point('a.md', '2026-01-01', '60', 60)])

        const result = aggregateForRangeChart(start, end, 'Spread', TimeGranularity.Daily)

        // An inverted numeric bar is drawn as-is; Chart.js handles either order
        expect(result.bars).toEqual([[80, 60]])
    })
})
