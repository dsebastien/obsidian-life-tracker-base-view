import type { BasesPropertyId } from 'obsidian'
import { compareAsc } from 'date-fns'
import {
    TimeGranularity,
    type BubbleChartData,
    type BubblePoint,
    type ChartData,
    type ChartDataset,
    type PieChartData,
    type ScatterChartData,
    type ScatterPoint,
    type TagCloudData,
    type TagCloudItem,
    type TimelineData,
    type TimelinePoint,
    type VisualizationDataPoint
} from '../types'
import { formatDateByGranularity } from '../../utils'
import { getTimeKey, normalizeDate } from './date-grouping.utils'

/**
 * Capitalize a boolean string value.
 * "true" -> "True", "false" -> "False"
 */
function capitalizeBoolean(label: string): string {
    if (label === 'true') return 'True'
    if (label === 'false') return 'False'
    return label
}

/**
 * Aggregate data for chart visualization (line, bar, area).
 */
export function aggregateForChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    granularity: TimeGranularity
): ChartData {
    // Filter to points with valid dates (need date for x-axis)
    const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

    if (validPoints.length === 0) {
        return { propertyId, displayName, labels: [], datasets: [] }
    }

    // Group by time unit
    const grouped = new Map<string, { date: Date; values: number[]; filePaths: string[] }>()

    for (const point of validPoints) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, granularity)
        const normDate = normalizeDate(date, granularity)

        if (!grouped.has(key)) {
            grouped.set(key, { date: normDate, values: [], filePaths: [] })
        }

        const group = grouped.get(key)!
        // Treat null numeric values as 0 (for entries without values when showEmptyValues is true)
        group.values.push(point.numericValue ?? 0)
        group.filePaths.push(point.filePath)
    }

    // Sort by date and build result arrays
    const sortedGroups = [...grouped.values()].sort((a, b) => compareAsc(a.date, b.date))
    const resultGroups = sortedGroups.map((g) => ({
        date: g.date,
        value: g.values.reduce((a, b) => a + b, 0) / g.values.length,
        filePaths: g.filePaths
    }))

    const labels = resultGroups.map((g) => formatDateByGranularity(g.date, granularity))
    const data = resultGroups.map((g) => g.value)
    const filePaths = resultGroups.map((g) => g.filePaths)

    const dataset: ChartDataset = {
        label: displayName,
        data,
        filePaths
    }

    return {
        propertyId,
        displayName,
        labels,
        datasets: [dataset]
    }
}

/**
 * Label used for entries without a value.
 */
const NO_DATA_LABEL = 'No data'

/**
 * Aggregate data for pie/doughnut/polarArea chart visualization.
 * Groups values by their display labels and counts frequency.
 * Entries without values are counted as "No data".
 */
export function aggregateForPieChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): PieChartData {
    // Check if data is boolean by looking at booleanValue
    const isBooleanData = dataPoints.some((p) => p.booleanValue !== null)

    // Group by appropriate label
    const valueGroups = new Map<string, { count: number; filePaths: string[] }>()

    for (const point of dataPoints) {
        // For boolean data, use simple True/False labels for proper color matching
        // For other data, use the full displayLabel
        let label: string | null
        if (isBooleanData && point.booleanValue !== null) {
            // Use simple True/False label that getBooleanColor() can match
            label = point.booleanValue ? 'True' : 'False'
        } else {
            label = point.displayLabel
        }

        // Handle entries without a label - count as "No data"
        if (!label) {
            if (!valueGroups.has(NO_DATA_LABEL)) {
                valueGroups.set(NO_DATA_LABEL, { count: 0, filePaths: [] })
            }
            const group = valueGroups.get(NO_DATA_LABEL)!
            group.count++
            group.filePaths.push(point.filePath)
            continue
        }

        // Capitalize boolean-like strings in non-boolean data
        const groupLabel = isBooleanData ? label : capitalizeBoolean(label)

        if (!valueGroups.has(groupLabel)) {
            valueGroups.set(groupLabel, { count: 0, filePaths: [] })
        }

        const group = valueGroups.get(groupLabel)!
        group.count++
        group.filePaths.push(point.filePath)
    }

    // Convert to arrays sorted by count descending
    const sortedEntries = [...valueGroups.entries()].sort((a, b) => b[1].count - a[1].count)

    const labels = sortedEntries.map(([label]) => label)
    const values = sortedEntries.map(([, data]) => data.count)
    const filePaths = sortedEntries.map(([, data]) => data.filePaths)

    return {
        propertyId,
        displayName,
        labels,
        values,
        filePaths,
        isBooleanData
    }
}

/**
 * Aggregate data for scatter chart visualization.
 * Each point shows time (x) vs value (y).
 */
export function aggregateForScatterChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): ScatterChartData {
    // Filter to points with valid dates (need date for x-axis)
    const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

    if (validPoints.length === 0) {
        return { propertyId, displayName, points: [], filePaths: [] }
    }

    // Get date range for normalization
    const dates = validPoints.map((p) => p.dateAnchor!.date.getTime())
    const minTime = Math.min(...dates)
    const maxTime = Math.max(...dates)
    const timeRange = maxTime - minTime || 1

    // Create scatter points with normalized x (time) and raw y (value)
    const points: ScatterPoint[] = []
    const filePaths: string[] = []

    for (const point of validPoints) {
        const x = ((point.dateAnchor!.date.getTime() - minTime) / timeRange) * 100
        // Treat null numeric values as 0 (for entries without values when showEmptyValues is true)
        const y = point.numericValue ?? 0

        points.push({ x, y })
        filePaths.push(point.filePath)
    }

    return { propertyId, displayName, points, filePaths }
}

/**
 * Aggregate data for bubble chart visualization.
 * Groups by time period, showing value (y) and count (radius).
 */
export function aggregateForBubbleChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    granularity: TimeGranularity
): BubbleChartData {
    // Filter to points with valid dates (need date for x-axis)
    const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

    if (validPoints.length === 0) {
        return { propertyId, displayName, points: [], filePaths: [] }
    }

    // Group by time unit
    const grouped = new Map<string, { date: Date; values: number[]; filePaths: string[] }>()

    for (const point of validPoints) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, granularity)
        const normDate = normalizeDate(date, granularity)

        if (!grouped.has(key)) {
            grouped.set(key, { date: normDate, values: [], filePaths: [] })
        }

        const group = grouped.get(key)!
        // Treat null numeric values as 0 (for entries without values when showEmptyValues is true)
        group.values.push(point.numericValue ?? 0)
        group.filePaths.push(point.filePath)
    }

    // Get date range for x-axis normalization
    const allDates = [...grouped.values()].map((g) => g.date.getTime())
    const minTime = Math.min(...allDates)
    const maxTime = Math.max(...allDates)
    const timeRange = maxTime - minTime || 1

    // Find max count for radius normalization
    const maxCount = Math.max(...[...grouped.values()].map((g) => g.filePaths.length))

    // Create bubble points
    const points: BubblePoint[] = []
    const filePaths: string[][] = []

    // Sort by date
    const sortedGroups = [...grouped.values()].sort((a, b) => compareAsc(a.date, b.date))

    for (const group of sortedGroups) {
        const x = ((group.date.getTime() - minTime) / timeRange) * 100

        const y = group.values.reduce((a, b) => a + b, 0) / group.values.length
        // Radius proportional to count, min 5, max 30
        const r = 5 + (group.filePaths.length / maxCount) * 25

        points.push({ x, y, r })
        filePaths.push(group.filePaths)
    }

    return { propertyId, displayName, points, filePaths }
}

/**
 * Aggregate data for tag cloud visualization.
 * Uses pre-extracted list values from data points.
 */
export function aggregateForTagCloud(
    dataPoints: VisualizationDataPoint[],
    _propertyId: BasesPropertyId,
    displayName: string
): TagCloudData {
    const tagCounts = new Map<string, { frequency: number; filePaths: string[] }>()

    for (const point of dataPoints) {
        // Use pre-extracted list values
        for (const tag of point.listValues) {
            if (!tagCounts.has(tag)) {
                tagCounts.set(tag, { frequency: 0, filePaths: [] })
            }

            const tagData = tagCounts.get(tag)!
            tagData.frequency++
            tagData.filePaths.push(point.filePath)
        }
    }

    // Convert to array and find max frequency
    const tags: TagCloudItem[] = []
    let maxFrequency = 0

    for (const [tag, data] of tagCounts) {
        tags.push({
            tag,
            frequency: data.frequency,
            filePaths: data.filePaths
        })
        maxFrequency = Math.max(maxFrequency, data.frequency)
    }

    // Sort by frequency descending
    tags.sort((a, b) => b.frequency - a.frequency)

    return {
        propertyId: _propertyId,
        displayName,
        tags,
        maxFrequency
    }
}

/**
 * Aggregate data for timeline visualization.
 * Data points should be pre-filtered based on showEmptyValues.
 */
export function aggregateForTimeline(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): TimelineData {
    // Filter to points with valid dates
    const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

    if (validPoints.length === 0) {
        return {
            propertyId,
            displayName,
            points: [],
            minDate: new Date(),
            maxDate: new Date()
        }
    }

    // Create timeline points using pre-extracted values
    const points: TimelinePoint[] = validPoints.map((p) => ({
        date: p.dateAnchor!.date,
        label: p.displayLabel ?? '',
        value: p.numericValue,
        filePaths: [p.filePath]
    }))

    // Sort by date
    points.sort((a, b) => compareAsc(a.date, b.date))

    const minDate = points[0]?.date ?? new Date()
    const maxDate = points[points.length - 1]?.date ?? new Date()

    return {
        propertyId,
        displayName,
        points,
        minDate,
        maxDate
    }
}
