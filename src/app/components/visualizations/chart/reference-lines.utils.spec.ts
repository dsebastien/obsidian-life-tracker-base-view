import { describe, expect, test } from 'bun:test'
import {
    buildCartesianReferenceLines,
    REFERENCE_LINE_DASH,
    TARGET_LINE_DASH
} from './reference-lines.utils'
import type { BasesPropertyId } from 'obsidian'
import { TimeGranularity, type ChartConfig, type ChartDataset } from '../../../types'
import {
    buildReferenceLineAnnotations,
    referenceLineBounds,
    timeAxisRange
} from './chart-initializers'

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

describe('cumulative target under a running total (issue #158)', () => {
    const target = {
        enabled: true,
        value: 50,
        metric: 'sum',
        period: TimeGranularity.Daily,
        direction: 'at-least'
    } as const

    test('the target accumulates when its period matches the granularity', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, runningTotal: true, target: { ...target } },
            undefined,
            []
        )

        expect(lines).toHaveLength(1)
        expect(lines[0]!.cumulativePerPeriod).toBe(true)
        expect(lines[0]!.label).toBe('Target: 50 per day (cumulative)')
    })

    test('a period-mismatched target is dropped rather than drawn wrong', () => {
        const lines = buildCartesianReferenceLines(
            {
                ...baseConfig,
                runningTotal: true,
                target: { ...target, period: TimeGranularity.Weekly },
                referenceLine: { enabled: true, value: 200 }
            },
            undefined,
            []
        )

        // The static "per week" goal has no honest slope on a daily axis;
        // the explicit reference line is untouched
        expect(lines).toHaveLength(1)
        expect(lines[0]!.label).toBe('Reference: 200')
    })

    test('without a running total the target stays a horizontal line', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, target: { ...target } },
            undefined,
            []
        )

        expect(lines[0]!.cumulativePerPeriod).toBeUndefined()
    })

    test('a cumulative annotation slopes from value to value × periods', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, runningTotal: true, target: { ...target } },
            undefined,
            []
        )
        const annotations = buildReferenceLineAnnotations(lines, 5)
        const annotation = annotations['referenceLine0'] as unknown as Record<string, unknown>

        expect(annotation['xMin']).toBe(0)
        expect(annotation['xMax']).toBe(4)
        expect(annotation['yMin']).toBe(50)
        expect(annotation['yMax']).toBe(250)
    })

    test('a horizontal annotation keeps both y endpoints at the value', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, referenceLine: { enabled: true, value: 75 } },
            undefined,
            []
        )
        const annotations = buildReferenceLineAnnotations(lines, 5)
        const annotation = annotations['referenceLine0'] as unknown as Record<string, unknown>

        expect(annotation['xMin']).toBeUndefined()
        expect(annotation['yMin']).toBe(75)
        expect(annotation['yMax']).toBe(75)
    })

    test('a single period degenerates to a horizontal line at the value', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, runningTotal: true, target: { ...target } },
            undefined,
            []
        )
        const annotations = buildReferenceLineAnnotations(lines, 1)
        const annotation = annotations['referenceLine0'] as unknown as Record<string, unknown>

        expect(annotation['xMin']).toBeUndefined()
        expect(annotation['yMin']).toBe(50)
        expect(annotation['yMax']).toBe(50)
    })

    test('suggested bounds cover the cumulative end value', () => {
        const lines = buildCartesianReferenceLines(
            { ...baseConfig, runningTotal: true, target: { ...target } },
            undefined,
            []
        )
        const { suggestedMin, suggestedMax } = referenceLineBounds(lines, 10, baseConfig)

        expect(suggestedMin).toBe(50)
        expect(suggestedMax).toBe(500)
    })

    test('an explicit user scale still wins over suggested bounds', () => {
        const config = { ...baseConfig, scale: { min: 0, max: 100 } } as ChartConfig
        const lines = buildCartesianReferenceLines(
            { ...config, runningTotal: true, target: { ...target } },
            undefined,
            []
        )
        const { suggestedMin, suggestedMax } = referenceLineBounds(lines, 10, config)

        expect(suggestedMin).toBeUndefined()
        expect(suggestedMax).toBeUndefined()
    })
})

describe('buildCartesianReferenceLines - value format (3.4.0)', () => {
    test('default labels read in the card format, custom labels stay as typed', () => {
        const lines = buildCartesianReferenceLines(
            {
                ...baseConfig,
                valueFormat: 'duration-mm-ss',
                referenceLine: { enabled: true, value: 330 },
                target: {
                    enabled: true,
                    value: 360,
                    metric: 'average',
                    period: TimeGranularity.Daily,
                    direction: 'at-most'
                }
            },
            undefined,
            []
        )
        expect(lines.map((l) => l.label)).toEqual(['Reference: 5:30', 'Target: 6:00'])

        const custom = buildCartesianReferenceLines(
            {
                ...baseConfig,
                valueFormat: 'duration-mm-ss',
                referenceLine: { enabled: true, value: 330, label: 'Easy pace' }
            },
            undefined,
            []
        )
        expect(custom[0]!.label).toBe('Easy pace')
    })
})

describe('time axis reference lines (3.4.0)', () => {
    test('a sloped line spans the first and last timestamps', () => {
        const lines = [{ value: 10, label: 'Target', color: '#000', cumulativePerPeriod: true }]
        const annotations = buildReferenceLineAnnotations(lines, 3, { min: 1000, max: 5000 })
        const line = annotations['referenceLine0'] as { xMin?: number; xMax?: number }
        expect(line.xMin).toBe(1000)
        expect(line.xMax).toBe(5000)
    })

    test('timeAxisRange reads the x values, undefined on category axes', () => {
        const base = {
            propertyId: 'note.pace' as BasesPropertyId,
            displayName: 'Pace',
            labels: ['a', 'b', 'c'],
            datasets: []
        }
        expect(timeAxisRange(base)).toBeUndefined()
        expect(timeAxisRange({ ...base, xValues: [3000, 1000, 2000] })).toEqual({
            min: 1000,
            max: 3000
        })
    })
})
