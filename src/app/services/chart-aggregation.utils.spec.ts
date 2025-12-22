import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import type { VisualizationDataPoint } from '../types'
import { TimeGranularity } from '../types'
import { hasListData, aggregateListForChart, aggregateForPieChart } from './chart-aggregation.utils'

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
        dateAnchor: dateStr ? { date: new Date(dateStr), source: 'filename' } : null,
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
