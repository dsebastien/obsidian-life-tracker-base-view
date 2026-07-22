import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import type { VisualizationDataPoint } from '../types'
import { TimeGranularity } from '../types'
import {
    hasListData,
    aggregateListForChart,
    aggregateForPieChart,
    aggregateForChart,
    aggregateForScatterChart,
    aggregateForBubbleChart,
    aggregateForOverlayChart,
    computeMovingAverage,
    computeTrend,
    type OverlayPropertyData
} from './chart-aggregation.utils'

/**
 * Helper to create a test data point
 */
function createDataPoint(
    filePath: string,
    dateStr: string | null,
    options: {
        numericValue?: number | null
        booleanValue?: boolean | null
        listValues?: string[]
        displayLabel?: string | null
    } = {}
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
        numericValue: options.numericValue ?? null,
        booleanValue: options.booleanValue ?? null,
        listValues: options.listValues ?? [],
        displayLabel: options.displayLabel ?? null
    }
}

describe('hasListData', () => {
    test('returns false for empty array', () => {
        expect(hasListData([])).toBe(false)
    })

    test('returns false when no data points have list values', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { numericValue: 5 }),
            createDataPoint('file2.md', '2025-01-02', { numericValue: 10 })
        ]
        expect(hasListData(dataPoints)).toBe(false)
    })

    test('returns false when data points have numeric values even with listValues', () => {
        // This simulates what happens when extractList converts "7" to ["7"]
        // A numeric property should NOT be treated as list data
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { numericValue: 7, listValues: ['7'] }),
            createDataPoint('file2.md', '2025-01-02', { numericValue: 8, listValues: ['8'] })
        ]
        expect(hasListData(dataPoints)).toBe(false)
    })

    test('returns false when data points have boolean values even with listValues', () => {
        // A boolean property should NOT be treated as list data
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { booleanValue: true, listValues: ['true'] }),
            createDataPoint('file2.md', '2025-01-02', {
                booleanValue: false,
                listValues: ['false']
            })
        ]
        expect(hasListData(dataPoints)).toBe(false)
    })

    test('returns true when at least one data point has list values without numeric/boolean', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { numericValue: 5 }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['running'] }) // No numeric/boolean
        ]
        expect(hasListData(dataPoints)).toBe(true)
    })

    test('returns true when all data points have list values without numeric/boolean', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running', 'swimming'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['cycling'] })
        ]
        expect(hasListData(dataPoints)).toBe(true)
    })
})

describe('aggregateListForChart', () => {
    const propertyId = 'test-property' as BasesPropertyId
    const displayName = 'Activities'

    test('returns empty data when no valid data points', () => {
        const dataPoints = [
            createDataPoint('file1.md', null, { listValues: ['running'] }) // No date
        ]
        const result = aggregateListForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )
        expect(result.labels).toEqual([])
        expect(result.datasets).toEqual([])
    })

    test('creates one dataset per unique list value', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running', 'swimming'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['running'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['cycling'] })
        ]
        const result = aggregateListForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )

        // Should have 3 unique values: running, swimming, cycling
        expect(result.datasets.length).toBe(3)

        // Datasets should be sorted alphabetically by label
        const labels = result.datasets.map((d) => d.label)
        expect(labels).toEqual(['Cycling', 'Running', 'Swimming'])
    })

    test('marks 1 for presence, 0 for absence per time period', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['swimming'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['running', 'swimming'] })
        ]
        const result = aggregateListForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )

        // Find the running and swimming datasets
        const runningDataset = result.datasets.find((d) => d.label === 'Running')
        const swimmingDataset = result.datasets.find((d) => d.label === 'Swimming')

        // Running: present on day 1, absent day 2, present day 3
        expect(runningDataset?.data).toEqual([1, 0, 1])

        // Swimming: absent day 1, present day 2, present day 3
        expect(swimmingDataset?.data).toEqual([0, 1, 1])
    })

    test('handles case-insensitive grouping', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['Running'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['running'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['RUNNING'] })
        ]
        const result = aggregateListForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )

        // Should only have one dataset (case-insensitive grouping)
        expect(result.datasets.length).toBe(1)
        expect(result.datasets[0]?.label).toBe('Running') // Capitalized
        expect(result.datasets[0]?.data).toEqual([1, 1, 1]) // Present on all days
    })

    test('includes correct file paths per value per time period', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running'] }),
            createDataPoint('file2.md', '2025-01-01', { listValues: ['running', 'swimming'] }),
            createDataPoint('file3.md', '2025-01-02', { listValues: ['swimming'] })
        ]
        const result = aggregateListForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )

        const runningDataset = result.datasets.find((d) => d.label === 'Running')
        const swimmingDataset = result.datasets.find((d) => d.label === 'Swimming')

        // Running: file1 and file2 on day 1, none on day 2
        expect(runningDataset?.filePaths[0]).toEqual(['file1.md', 'file2.md'])
        expect(runningDataset?.filePaths[1]).toEqual([])

        // Swimming: file2 on day 1, file3 on day 2
        expect(swimmingDataset?.filePaths[0]).toEqual(['file2.md'])
        expect(swimmingDataset?.filePaths[1]).toEqual(['file3.md'])
    })
})

describe('aggregateForPieChart with list data', () => {
    const propertyId = 'test-property' as BasesPropertyId
    const displayName = 'Activities'

    test('counts individual list value occurrences', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running', 'swimming'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['running'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['cycling'] })
        ]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        // Running appears 2 times, swimming 1 time, cycling 1 time
        expect(result.labels).toContain('Running')
        expect(result.labels).toContain('Swimming')
        expect(result.labels).toContain('Cycling')

        const runningIndex = result.labels.indexOf('Running')
        const swimmingIndex = result.labels.indexOf('Swimming')
        const cyclingIndex = result.labels.indexOf('Cycling')

        expect(result.values[runningIndex]).toBe(2)
        expect(result.values[swimmingIndex]).toBe(1)
        expect(result.values[cyclingIndex]).toBe(1)
    })

    test('handles case-insensitive grouping', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['Running'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['running'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['RUNNING'] })
        ]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        // Should only have one label (case-insensitive grouping)
        expect(result.labels).toEqual(['Running'])
        expect(result.values).toEqual([3])
    })

    test('counts No data for entries without list values', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['running'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: [] }) // No list values
        ]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        expect(result.labels).toContain('No data')
        const noDataIndex = result.labels.indexOf('No data')
        expect(result.values[noDataIndex]).toBe(1)
    })

    test('file paths are unique per entry even if value appears multiple times', () => {
        // If someone puts the same tag twice in one entry, the file path should only appear once
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', {
                listValues: ['running', 'running', 'running']
            })
        ]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        // Count should be 3 (each occurrence counts)
        expect(result.values[0]).toBe(3)
        // But file path should only appear once
        expect(result.filePaths[0]).toEqual(['file1.md'])
    })

    test('sorts results by count descending', () => {
        const dataPoints = [
            createDataPoint('file1.md', '2025-01-01', { listValues: ['a'] }),
            createDataPoint('file2.md', '2025-01-02', { listValues: ['b', 'b'] }),
            createDataPoint('file3.md', '2025-01-03', { listValues: ['c', 'c', 'c'] })
        ]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        // Should be sorted by count descending: C (3), B (2), A (1)
        expect(result.labels[0]).toBe('C')
        expect(result.labels[1]).toBe('B')
        expect(result.labels[2]).toBe('A')
        expect(result.values).toEqual([3, 2, 1])
    })

    test('returns isBooleanData as false for list data', () => {
        const dataPoints = [createDataPoint('file1.md', '2025-01-01', { listValues: ['running'] })]
        const result = aggregateForPieChart(dataPoints, propertyId, displayName)

        expect(result.isBooleanData).toBe(false)
    })
})

describe('aggregateForChart aggregation method (issue #89)', () => {
    const propertyId = 'workout-calories' as BasesPropertyId
    const displayName = 'Workout calories'

    // Three workouts on day 1, one workout on day 2
    const dataPoints = [
        createDataPoint('workout1.md', '2025-01-01', { numericValue: 100 }),
        createDataPoint('workout2.md', '2025-01-01', { numericValue: 200 }),
        createDataPoint('workout3.md', '2025-01-01', { numericValue: 300 }),
        createDataPoint('workout4.md', '2025-01-02', { numericValue: 50 })
    ]

    test('defaults to average (preserves prior behavior)', () => {
        const result = aggregateForChart(dataPoints, propertyId, displayName, TimeGranularity.Daily)
        // Day 1 average = (100+200+300)/3 = 200, Day 2 = 50
        expect(result.datasets[0]?.data).toEqual([200, 50])
    })

    test('explicit average matches default', () => {
        const result = aggregateForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily,
            'average'
        )
        expect(result.datasets[0]?.data).toEqual([200, 50])
    })

    test('sum totals values within a time period', () => {
        const result = aggregateForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily,
            'sum'
        )
        // Day 1 sum = 600, Day 2 sum = 50
        expect(result.datasets[0]?.data).toEqual([600, 50])
    })

    test('sum still produces one entry per file path per period', () => {
        const result = aggregateForChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily,
            'sum'
        )
        expect(result.datasets[0]?.filePaths[0]).toEqual([
            'workout1.md',
            'workout2.md',
            'workout3.md'
        ])
    })
})

describe('aggregateForBubbleChart aggregation method (issue #89)', () => {
    const propertyId = 'workout-calories' as BasesPropertyId
    const displayName = 'Workout calories'

    const dataPoints = [
        createDataPoint('workout1.md', '2025-01-01', { numericValue: 100 }),
        createDataPoint('workout2.md', '2025-01-01', { numericValue: 200 }),
        createDataPoint('workout3.md', '2025-01-02', { numericValue: 50 })
    ]

    test('default uses average for y value', () => {
        const result = aggregateForBubbleChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily
        )
        // Day 1 average y = 150, day 2 = 50
        const ys = result.points.map((p) => p.y)
        expect(ys).toEqual([150, 50])
    })

    test('sum produces totalled y value', () => {
        const result = aggregateForBubbleChart(
            dataPoints,
            propertyId,
            displayName,
            TimeGranularity.Daily,
            'sum'
        )
        const ys = result.points.map((p) => p.y)
        expect(ys).toEqual([300, 50])
    })
})

describe('aggregateForOverlayChart aggregation method (issue #89)', () => {
    const propertyA = 'a' as BasesPropertyId
    const propertyB = 'b' as BasesPropertyId

    const propertiesData: OverlayPropertyData[] = [
        {
            propertyId: propertyA,
            displayName: 'A',
            dataPoints: [
                createDataPoint('a1.md', '2025-01-01', { numericValue: 10 }),
                createDataPoint('a2.md', '2025-01-01', { numericValue: 30 })
            ]
        },
        {
            propertyId: propertyB,
            displayName: 'B',
            dataPoints: [
                createDataPoint('b1.md', '2025-01-01', { numericValue: 5 }),
                createDataPoint('b2.md', '2025-01-01', { numericValue: 5 })
            ]
        }
    ]

    test('defaults to average', () => {
        const result = aggregateForOverlayChart(propertiesData, 'Overlay', TimeGranularity.Daily)
        expect(result.datasets[0]?.data).toEqual([20]) // average of A: 10,30
        expect(result.datasets[1]?.data).toEqual([5]) // average of B: 5,5
    })

    test('sum applies to all overlay datasets', () => {
        const result = aggregateForOverlayChart(
            propertiesData,
            'Overlay',
            TimeGranularity.Daily,
            'sum'
        )
        expect(result.datasets[0]?.data).toEqual([40]) // sum A
        expect(result.datasets[1]?.data).toEqual([10]) // sum B
    })
})

describe('missing values are gaps, not zeros (issue #92)', () => {
    test('aggregateForChart: empty entries do not drag the average down', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 10 }),
            createDataPoint('b.md', '2025-01-01', { numericValue: null }),
            createDataPoint('c.md', '2025-01-01', { numericValue: 20 })
        ]
        const result = aggregateForChart(
            dataPoints,
            'note.energy' as BasesPropertyId,
            'Energy',
            TimeGranularity.Daily
        )
        // Average of 10 and 20 — the null entry must not contribute a 0
        expect(result.datasets[0]?.data).toEqual([15])
    })

    test('aggregateForChart: a period with only empty entries yields null, not 0', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 10 }),
            createDataPoint('b.md', '2025-01-02', { numericValue: null }),
            createDataPoint('c.md', '2025-01-03', { numericValue: 30 })
        ]
        const result = aggregateForChart(
            dataPoints,
            'note.energy' as BasesPropertyId,
            'Energy',
            TimeGranularity.Daily
        )
        // The empty period keeps its label (showEmptyValues semantics)
        // but renders as a gap
        expect(result.labels).toHaveLength(3)
        expect(result.datasets[0]?.data).toEqual([10, null, 30])
    })

    test('aggregateForChart: sum ignores empty entries too', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 100 }),
            createDataPoint('b.md', '2025-01-01', { numericValue: null }),
            createDataPoint('c.md', '2025-01-01', { numericValue: 300 })
        ]
        const result = aggregateForChart(
            dataPoints,
            'note.calories' as BasesPropertyId,
            'Calories',
            TimeGranularity.Daily,
            'sum'
        )
        expect(result.datasets[0]?.data).toEqual([400])
    })

    test('aggregateForScatterChart: entries without a value are skipped, not plotted at 0', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 5 }),
            createDataPoint('b.md', '2025-01-02', { numericValue: null }),
            createDataPoint('c.md', '2025-01-03', { numericValue: 7 })
        ]
        const result = aggregateForScatterChart(dataPoints, 'note.mood' as BasesPropertyId, 'Mood')
        expect(result.points).toHaveLength(2)
        expect(result.points.map((p) => p.y)).toEqual([5, 7])
        expect(result.filePaths).toEqual(['a.md', 'c.md'])
    })

    test('aggregateForScatterChart: x is the real timestamp, not a 0-100% (issue #97)', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 5 }),
            createDataPoint('c.md', '2025-01-03', { numericValue: 7 })
        ]
        const result = aggregateForScatterChart(dataPoints, 'note.mood' as BasesPropertyId, 'Mood')
        expect(result.points.map((p) => p.x)).toEqual([
            new Date('2025-01-01').getTime(),
            new Date('2025-01-03').getTime()
        ])
    })

    test('aggregateForBubbleChart: entries without a value are skipped', () => {
        const dataPoints = [
            createDataPoint('a.md', '2025-01-01', { numericValue: 10 }),
            createDataPoint('b.md', '2025-01-01', { numericValue: null }),
            createDataPoint('c.md', '2025-01-02', { numericValue: null })
        ]
        const result = aggregateForBubbleChart(
            dataPoints,
            'note.steps' as BasesPropertyId,
            'Steps',
            TimeGranularity.Daily
        )
        // Only 2025-01-01 has a value; the null-only period produces no bubble
        expect(result.points).toHaveLength(1)
        expect(result.points[0]?.y).toBe(10)
        // The valueless entry does not inflate the bubble size
        expect(result.filePaths[0]).toEqual(['a.md'])
    })

    test('aggregateForOverlayChart: a period with only empty entries stays null', () => {
        const propertiesData: OverlayPropertyData[] = [
            {
                propertyId: 'note.sleep' as BasesPropertyId,
                displayName: 'Sleep',
                dataPoints: [
                    createDataPoint('a.md', '2025-01-01', { numericValue: 8 }),
                    createDataPoint('b.md', '2025-01-02', { numericValue: null })
                ]
            },
            {
                propertyId: 'note.mood' as BasesPropertyId,
                displayName: 'Mood',
                dataPoints: [
                    createDataPoint('a.md', '2025-01-01', { numericValue: 3 }),
                    createDataPoint('b.md', '2025-01-02', { numericValue: 4 })
                ]
            }
        ]
        const result = aggregateForOverlayChart(propertiesData, 'Overlay', TimeGranularity.Daily)
        expect(result.labels).toHaveLength(2)
        expect(result.datasets[0]?.data).toEqual([8, null])
        expect(result.datasets[1]?.data).toEqual([3, 4])
    })
})

describe('computeMovingAverage (issue #101)', () => {
    test('trailing window clamped at the start', () => {
        const result = computeMovingAverage([2, 4, 6, 8], 3)
        expect(result).toEqual([2, 3, 4, 6])
    })

    test('nulls are skipped within the window, not treated as 0', () => {
        const result = computeMovingAverage([10, null, 20], 3)
        expect(result).toEqual([10, 10, 15])
    })

    test('window with only nulls yields null', () => {
        const result = computeMovingAverage([null, null, 6], 2)
        expect(result).toEqual([null, null, 6])
    })
})

describe('computeTrend (issue #101)', () => {
    test('upward trend over two windows', () => {
        const trend = computeTrend([1, 1, 2, 2])
        expect(trend?.direction).toBe('up')
        expect(trend?.changePercent).toBe(100)
        expect(trend?.periodCount).toBe(2)
    })

    test('downward trend', () => {
        const trend = computeTrend([4, 4, 2, 2])
        expect(trend?.direction).toBe('down')
        expect(trend?.changePercent).toBe(-50)
    })

    test('small change is flat', () => {
        const trend = computeTrend([100, 100, 101, 101])
        expect(trend?.direction).toBe('flat')
    })

    test('window capped at 7 periods', () => {
        const values = new Array<number | null>(20).fill(5)
        const trend = computeTrend(values)
        expect(trend?.periodCount).toBe(7)
        expect(trend?.direction).toBe('flat')
    })

    test('returns null when there is not enough data', () => {
        expect(computeTrend([5])).toBeNull()
        expect(computeTrend([])).toBeNull()
    })

    test('returns null when the previous window mean is 0', () => {
        expect(computeTrend([0, 0, 5, 5])).toBeNull()
    })

    test('nulls inside windows are ignored', () => {
        const trend = computeTrend([2, null, 4, null])
        expect(trend?.direction).toBe('up')
        expect(trend?.changePercent).toBe(100)
    })
})
