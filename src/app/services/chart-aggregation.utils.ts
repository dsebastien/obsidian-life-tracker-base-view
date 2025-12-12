import type { BasesEntry, BasesPropertyId } from 'obsidian'
import { compareAsc } from 'date-fns'
import { TimeGranularity } from '../types/time-granularity.intf'
import type {
    BubbleChartData,
    BubblePoint,
    ChartData,
    ChartDataset,
    PieChartData,
    ScatterChartData,
    ScatterPoint,
    TagCloudData,
    TagCloudItem,
    TimelineData,
    TimelinePoint,
    VisualizationDataPoint
} from '../types/visualization.types'
import { formatDateByGranularity } from '../../utils/date-utils'
import { extractList } from '../../utils/value-extractors'
import { getTimeKey, normalizeDate } from './date-grouping.utils'

/**
 * Aggregate data for chart visualization (line, bar, area)
 */
export function aggregateForChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    granularity: TimeGranularity
): ChartData {
    // Filter points with valid date anchors and numeric values
    const validPoints = dataPoints.filter(
        (p) => p.dateAnchor !== null && p.normalizedValue !== null
    )

    if (validPoints.length === 0) {
        return { propertyId, displayName, labels: [], datasets: [] }
    }

    // Group by time unit
    const grouped = new Map<string, { date: Date; values: number[]; entries: BasesEntry[] }>()

    for (const point of validPoints) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, granularity)
        const normDate = normalizeDate(date, granularity)

        if (!grouped.has(key)) {
            grouped.set(key, { date: normDate, values: [], entries: [] })
        }

        const group = grouped.get(key)!
        group.values.push(point.normalizedValue!)
        group.entries.push(point.entry)
    }

    // Sort by date and create chart data
    const sortedGroups = [...grouped.values()].sort((a, b) => compareAsc(a.date, b.date))

    const labels = sortedGroups.map((g) => formatDateByGranularity(g.date, granularity))
    const data = sortedGroups.map((g) => g.values.reduce((a, b) => a + b, 0) / g.values.length)
    const entries = sortedGroups.map((g) => g.entries)

    const dataset: ChartDataset = {
        label: displayName,
        data,
        entries
    }

    return {
        propertyId,
        displayName,
        labels,
        datasets: [dataset]
    }
}

/**
 * Aggregate data for pie/doughnut chart visualization
 * Groups values and counts their frequency
 */
export function aggregateForPieChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): PieChartData {
    // Group by value
    const valueGroups = new Map<string, { count: number; entries: BasesEntry[] }>()

    for (const point of dataPoints) {
        if (point.value === null || point.value === undefined) continue

        const valueStr = String(point.value).trim()
        if (!valueStr) continue

        if (!valueGroups.has(valueStr)) {
            valueGroups.set(valueStr, { count: 0, entries: [] })
        }

        const group = valueGroups.get(valueStr)!
        group.count++
        group.entries.push(point.entry)
    }

    // Convert to arrays sorted by count descending
    const sortedEntries = [...valueGroups.entries()].sort((a, b) => b[1].count - a[1].count)

    const labels = sortedEntries.map(([label]) => label)
    const values = sortedEntries.map(([, data]) => data.count)
    const entries = sortedEntries.map(([, data]) => data.entries)

    return {
        propertyId,
        displayName,
        labels,
        values,
        entries
    }
}

/**
 * Aggregate data for scatter chart visualization
 * Each point shows time (x) vs value (y)
 */
export function aggregateForScatterChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): ScatterChartData {
    // Filter points with valid date anchors and numeric values
    const validPoints = dataPoints.filter(
        (p) => p.dateAnchor !== null && p.normalizedValue !== null
    )

    if (validPoints.length === 0) {
        return { propertyId, displayName, points: [], entries: [] }
    }

    // Get date range for normalization
    const dates = validPoints.map((p) => p.dateAnchor!.date.getTime())
    const minTime = Math.min(...dates)
    const maxTime = Math.max(...dates)
    const timeRange = maxTime - minTime || 1

    // Create scatter points with normalized x (time) and raw y (value)
    const points: ScatterPoint[] = []
    const entries: BasesEntry[] = []

    for (const point of validPoints) {
        const x = ((point.dateAnchor!.date.getTime() - minTime) / timeRange) * 100
        const y = point.normalizedValue!

        points.push({ x, y })
        entries.push(point.entry)
    }

    return { propertyId, displayName, points, entries }
}

/**
 * Aggregate data for bubble chart visualization
 * Groups by time period, showing value (y) and count (radius)
 */
export function aggregateForBubbleChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    granularity: TimeGranularity
): BubbleChartData {
    // Filter points with valid date anchors and numeric values
    const validPoints = dataPoints.filter(
        (p) => p.dateAnchor !== null && p.normalizedValue !== null
    )

    if (validPoints.length === 0) {
        return { propertyId, displayName, points: [], entries: [] }
    }

    // Group by time unit
    const grouped = new Map<string, { date: Date; values: number[]; entries: BasesEntry[] }>()

    for (const point of validPoints) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, granularity)
        const normDate = normalizeDate(date, granularity)

        if (!grouped.has(key)) {
            grouped.set(key, { date: normDate, values: [], entries: [] })
        }

        const group = grouped.get(key)!
        group.values.push(point.normalizedValue!)
        group.entries.push(point.entry)
    }

    // Get date range for x-axis normalization
    const allDates = [...grouped.values()].map((g) => g.date.getTime())
    const minTime = Math.min(...allDates)
    const maxTime = Math.max(...allDates)
    const timeRange = maxTime - minTime || 1

    // Find max count for radius normalization
    const maxCount = Math.max(...[...grouped.values()].map((g) => g.entries.length))

    // Create bubble points
    const points: BubblePoint[] = []
    const entries: BasesEntry[][] = []

    // Sort by date
    const sortedGroups = [...grouped.values()].sort((a, b) => compareAsc(a.date, b.date))

    for (const group of sortedGroups) {
        const x = ((group.date.getTime() - minTime) / timeRange) * 100
        const y = group.values.reduce((a, b) => a + b, 0) / group.values.length
        // Radius proportional to count, min 5, max 30
        const r = 5 + (group.entries.length / maxCount) * 25

        points.push({ x, y, r })
        entries.push(group.entries)
    }

    return { propertyId, displayName, points, entries }
}

/**
 * Aggregate data for tag cloud visualization
 */
export function aggregateForTagCloud(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): TagCloudData {
    const tagCounts = new Map<string, { frequency: number; entries: BasesEntry[] }>()

    for (const point of dataPoints) {
        if (!point.value) continue

        const value = point.entry.getValue(propertyId)
        const tags = extractList(value)

        for (const tag of tags) {
            if (!tag) continue

            if (!tagCounts.has(tag)) {
                tagCounts.set(tag, { frequency: 0, entries: [] })
            }

            const tagData = tagCounts.get(tag)!
            tagData.frequency++
            tagData.entries.push(point.entry)
        }
    }

    // Convert to array and find max frequency
    const tags: TagCloudItem[] = []
    let maxFrequency = 0

    for (const [tag, data] of tagCounts) {
        tags.push({
            tag,
            frequency: data.frequency,
            entries: data.entries
        })
        maxFrequency = Math.max(maxFrequency, data.frequency)
    }

    // Sort by frequency descending
    tags.sort((a, b) => b.frequency - a.frequency)

    return {
        propertyId,
        displayName,
        tags,
        maxFrequency
    }
}

/**
 * Aggregate data for timeline visualization
 */
export function aggregateForTimeline(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): TimelineData {
    // Filter points with valid date anchors
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

    // Create timeline points
    const points: TimelinePoint[] = validPoints.map((p) => ({
        date: p.dateAnchor!.date,
        label: p.value?.toString() ?? p.entry.file.basename,
        entries: [p.entry]
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
