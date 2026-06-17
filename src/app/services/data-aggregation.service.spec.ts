import { describe, expect, test } from 'bun:test'
import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { PropertyDefinition, ResolvedDateAnchor, VisualizationDataPoint } from '../types'
import { TimeGranularity } from '../types'
import { DataAggregationService } from './data-aggregation.service'

const PROP_ID = 'note.energy' as BasesPropertyId

/**
 * Make a minimal BasesEntry with a given numeric property value.
 */
function makeEntry(path: string, value: unknown): BasesEntry {
    return {
        file: { path, basename: path },
        getValue: () => value
    } as unknown as BasesEntry
}

/**
 * Make a minimal PropertyDefinition with no value mapping.
 */
function makeDef(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
    return {
        id: 'def-1',
        name: 'energy',
        displayName: 'Energy',
        type: 'number',
        allowedValues: [],
        numberRange: null,
        defaultValue: null,
        required: false,
        description: '',
        order: 0,
        mappings: [],
        valueMapping: null,
        ...overrides
    }
}

/** Create a date anchor pointing to a specific ISO date string */
function anchor(dateStr: string): ResolvedDateAnchor {
    return {
        date: new Date(dateStr),
        source: { type: 'filename', pattern: 'auto' },
        confidence: 'high'
    }
}

/**
 * Build a VisualizationDataPoint directly (bypassing createDataPoints) for
 * aggregateForHeatmap tests.
 */
function makeDataPoint(
    filePath: string,
    dateStr: string | null,
    numericValue: number | null
): VisualizationDataPoint {
    return {
        filePath,
        dateAnchor: dateStr ? anchor(dateStr) : null,
        numericValue,
        booleanValue: null,
        displayLabel: null,
        listValues: []
    }
}

// ─── DataAggregationService ────────────────────────────────────────────────────

describe('DataAggregationService.createDataPoints', () => {
    const service = new DataAggregationService()

    test('extracts numeric value for each entry', () => {
        const entries = [makeEntry('a.md', 7), makeEntry('b.md', 3)]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, anchor('2024-01-10'))
        anchors.set(entries[1]!, anchor('2024-01-11'))

        const points = service.createDataPoints(entries, PROP_ID, 'Energy', makeDef(), anchors)
        expect(points).toHaveLength(2)
        expect(points[0]!.numericValue).toBe(7)
        expect(points[1]!.numericValue).toBe(3)
    })

    test('extracts boolean value (true → 1, false → 0)', () => {
        const entries = [makeEntry('a.md', true), makeEntry('b.md', false)]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, null)
        anchors.set(entries[1]!, null)

        const points = service.createDataPoints(
            entries,
            PROP_ID,
            'Done',
            makeDef({ type: 'checkbox' }),
            anchors
        )
        expect(points[0]!.numericValue).toBe(1)
        expect(points[1]!.numericValue).toBe(0)
    })

    test('applies valueMapping — mapped value replaces raw numeric extraction', () => {
        const entries = [makeEntry('a.md', '⭐⭐')]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, null)

        const def = makeDef({ valueMapping: { '⭐': 1, '⭐⭐': 2, '⭐⭐⭐': 3 } })
        const points = service.createDataPoints(entries, PROP_ID, 'Stars', def, anchors)
        expect(points[0]!.numericValue).toBe(2)
    })

    test('unmapped value is treated as 0 when valueMapping is configured', () => {
        const entries = [makeEntry('a.md', 'unknown')]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, null)

        const def = makeDef({ valueMapping: { low: 1, high: 5 } })
        const points = service.createDataPoints(entries, PROP_ID, 'Level', def, anchors)
        expect(points[0]!.numericValue).toBe(0)
    })

    test('showEmptyValues=true keeps entries with null values', () => {
        const entries = [makeEntry('a.md', null), makeEntry('b.md', 5)]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, null)
        anchors.set(entries[1]!, null)

        const points = service.createDataPoints(
            entries,
            PROP_ID,
            'Energy',
            makeDef(),
            anchors,
            true
        )
        expect(points).toHaveLength(2)
    })

    test('showEmptyValues=false removes entries with no meaningful data', () => {
        const entries = [makeEntry('a.md', null), makeEntry('b.md', 5)]
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entries[0]!, null)
        anchors.set(entries[1]!, null)

        const points = service.createDataPoints(
            entries,
            PROP_ID,
            'Energy',
            makeDef(),
            anchors,
            false
        )
        expect(points).toHaveLength(1)
        expect(points[0]!.filePath).toBe('b.md')
    })

    test('carries through dateAnchor from map', () => {
        const entry = makeEntry('2024-01-10.md', 8)
        const anch = anchor('2024-01-10')
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        anchors.set(entry, anch)

        const points = service.createDataPoints([entry], PROP_ID, 'Energy', makeDef(), anchors)
        expect(points[0]!.dateAnchor).toBe(anch)
    })

    test('empty entries array returns empty array', () => {
        const points = service.createDataPoints([], PROP_ID, 'Energy', makeDef(), new Map(), true)
        expect(points).toHaveLength(0)
    })
})

// ─── aggregateForHeatmap ────────────────────────────────────────────────────────

describe('DataAggregationService.aggregateForHeatmap', () => {
    const service = new DataAggregationService()

    test('empty input yields empty heatmap data with sensible defaults', () => {
        const result = service.aggregateForHeatmap([], PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.cells).toHaveLength(0)
        expect(result.minValue).toBe(0)
        expect(result.maxValue).toBe(1)
        expect(result.streaks.currentStreak).toBe(0)
    })

    test('points without dateAnchor are excluded from cells', () => {
        const points = [makeDataPoint('a.md', null, 5), makeDataPoint('b.md', '2024-03-01', 3)]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.cells).toHaveLength(1)
        expect(result.cells[0]!.value).toBe(3)
    })

    test('two points on the same day are averaged by default', () => {
        const points = [
            makeDataPoint('a.md', '2024-03-01', 4),
            makeDataPoint('b.md', '2024-03-01', 8)
        ]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.cells).toHaveLength(1)
        expect(result.cells[0]!.value).toBe(6) // (4+8)/2
        expect(result.cells[0]!.count).toBe(2)
        expect(result.cells[0]!.filePaths).toHaveLength(2)
    })

    test('two points on the same day are summed when aggregationMethod is "sum"', () => {
        const points = [
            makeDataPoint('a.md', '2024-03-01', 4),
            makeDataPoint('b.md', '2024-03-01', 8)
        ]
        const result = service.aggregateForHeatmap(
            points,
            PROP_ID,
            'Energy',
            TimeGranularity.Daily,
            'sum'
        )
        expect(result.cells).toHaveLength(1)
        expect(result.cells[0]!.value).toBe(12)
    })

    test('minValue and maxValue reflect the aggregated cell values', () => {
        const points = [
            makeDataPoint('a.md', '2024-03-01', 2),
            makeDataPoint('b.md', '2024-03-02', 10),
            makeDataPoint('c.md', '2024-03-03', 5)
        ]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.minValue).toBe(2)
        expect(result.maxValue).toBe(10)
    })

    test('minDate and maxDate span all valid data points', () => {
        const points = [
            makeDataPoint('a.md', '2024-01-01', 1),
            makeDataPoint('b.md', '2024-12-31', 5)
        ]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.minDate.getFullYear()).toBe(2024)
        expect(result.minDate.getMonth()).toBe(0) // January
        expect(result.maxDate.getMonth()).toBe(11) // December
    })

    test('cells are sorted by date ascending', () => {
        const points = [
            makeDataPoint('b.md', '2024-03-02', 5),
            makeDataPoint('a.md', '2024-03-01', 3),
            makeDataPoint('c.md', '2024-03-03', 7)
        ]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        const dates = result.cells.map((c) => c.date.getDate())
        expect(dates).toEqual([1, 2, 3])
    })

    test('a cell with no numeric values has null value', () => {
        const points = [makeDataPoint('a.md', '2024-03-01', null)]
        const result = service.aggregateForHeatmap(points, PROP_ID, 'Energy', TimeGranularity.Daily)
        expect(result.cells[0]!.value).toBeNull()
    })

    test('weekly granularity groups same-week dates into one cell', () => {
        // Monday and Wednesday of the same ISO week
        const points = [
            makeDataPoint('a.md', '2024-03-04', 3), // Monday W10
            makeDataPoint('b.md', '2024-03-06', 7) // Wednesday W10
        ]
        const result = service.aggregateForHeatmap(
            points,
            PROP_ID,
            'Energy',
            TimeGranularity.Weekly
        )
        expect(result.cells).toHaveLength(1)
        // average of 3 and 7
        expect(result.cells[0]!.value).toBe(5)
    })
})
