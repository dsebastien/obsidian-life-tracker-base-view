import { describe, expect, test } from 'bun:test'
import {
    buildCartesianReferenceLines,
    REFERENCE_LINE_DASH,
    TARGET_LINE_DASH
} from './reference-lines.utils'
import type { BasesPropertyId } from 'obsidian'
import { TimeGranularity, type ChartConfig, type ChartDataset } from '../../../types'

const baseConfig = {
    granularity: TimeGranularity.Daily,
    showEmptyValues: false,
    embeddedHeight: 300,
    chartType: 'line',
    showLegend: false,
    showGrid: true,
    tension: 0.3
} as ChartConfig

function makeDataset(label: string, propertyId?: string): ChartDataset {
    return {
        label,
        data: [1, 2, 3],
        filePaths: [[], [], []],
        ...(propertyId ? { propertyId: propertyId as BasesPropertyId } : {})
    }
}

describe('buildCartesianReferenceLines (issue #156)', () => {
    test('no configuration yields no lines', () => {
        expect(buildCartesianReferenceLines(baseConfig, undefined, [])).toEqual([])
    })

    test('an explicit reference line renders alone', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, referenceLine: { enabled: true, value: 75 } },
            undefined,
            []
        )

        expect(lines).toHaveLength(1)
        expect(lines[0]!.value).toBe(75)
        expect(lines[0]!.label).toBe('Reference: 75')
        expect(lines[0]!.dash).toEqual(REFERENCE_LINE_DASH)
        expect(lines[0]!.labelPosition).toBe('end')
    })

    test('a target renders alone', () => {
        const lines = buildCartesianReferenceLines(
            {
                ...baseConfig,
                target: {
                    enabled: true,
                    value: 50,
                    metric: 'sum',
                    period: TimeGranularity.Daily,
                    direction: 'at-least',
                    unit: 'reps'
                }
            },
            undefined,
            []
        )

        expect(lines).toHaveLength(1)
        expect(lines[0]!.value).toBe(50)
        expect(lines[0]!.label).toBe('Target: 50 reps')
        expect(lines[0]!.dash).toEqual(TARGET_LINE_DASH)
        expect(lines[0]!.labelPosition).toBe('start')
    })

    test('a reference line and a target are BOTH drawn (issue #156)', () => {
        const lines = buildCartesianReferenceLines(
            {
                ...baseConfig,
                referenceLine: { enabled: true, value: 75, label: 'Ceiling' },
                target: {
                    enabled: true,
                    value: 50,
                    metric: 'sum',
                    period: TimeGranularity.Daily,
                    direction: 'at-least'
                }
            },
            undefined,
            []
        )

        expect(lines).toHaveLength(2)
        const [reference, target] = lines
        expect(reference!.label).toBe('Ceiling')
        expect(target!.label).toBe('Target: 50')
        // Distinct dash patterns and opposite label anchors keep them readable
        // even when both sit at the same value
        expect(reference!.dash).not.toEqual(target!.dash)
        expect(reference!.labelPosition).not.toBe(target!.labelPosition)
    })

    test('a disabled target stays hidden', () => {
        const lines = buildCartesianReferenceLines(
            {
                ...baseConfig,
                target: {
                    enabled: false,
                    value: 50,
                    metric: 'sum',
                    period: TimeGranularity.Daily,
                    direction: 'at-least'
                }
            },
            undefined,
            []
        )

        expect(lines).toEqual([])
    })

    test('overlay reference lines render one line per configured property', () => {
        const datasets = [makeDataset('Mood', 'note.mood'), makeDataset('Sleep', 'note.sleep')]
        const lines = buildCartesianReferenceLines(
            baseConfig,
            {
                ['note.mood' as BasesPropertyId]: { enabled: true, value: 7 },
                ['note.sleep' as BasesPropertyId]: { enabled: false, value: 8 }
            },
            datasets
        )

        expect(lines).toHaveLength(1)
        expect(lines[0]!.label).toBe('Mood: 7')
    })
})
