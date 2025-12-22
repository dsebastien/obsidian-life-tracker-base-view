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
 * Check if data points contain list data (for list property visualization).
 * Returns true if data points have list values that are NOT just numeric/boolean values.
 * A proper list property will have list values but NO numeric or boolean values.
 */
export function hasListData(dataPoints: VisualizationDataPoint[]): boolean {
    // A data point is considered "list data" only if:
    // 1. It has list values, AND
    // 2. It does NOT have a numeric value, AND
    // 3. It does NOT have a boolean value
    // This prevents numeric properties (like sleep_hours: 7) from being treated as lists
    return dataPoints.some(
        (p) => p.listValues.length > 0 && p.numericValue === null && p.booleanValue === null
    )
}

/**
 * Normalize a string for case-insensitive comparison.
 * Trims whitespace and converts to lowercase.
 */
function normalizeForComparison(value: string): string {
    return value.trim().toLowerCase()
}

/**
 * Capitalize first letter of a string.
 */
function capitalizeFirst(value: string): string {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
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
 * Aggregate list data for cartesian chart visualization (line, bar, area).
 * Creates one dataset per unique list value, showing 0/1 presence per time period.
 * Case-insensitive grouping of list values.
 */
export function aggregateListForChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    granularity: TimeGranularity
): ChartData {
    // Filter to points with valid dates
    const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

    if (validPoints.length === 0) {
        return { propertyId, displayName, labels: [], datasets: [] }
    }

    // Step 1: Collect all unique list values (case-insensitive) and their display labels
    const uniqueValues = new Map<string, string>() // normalized key -> display label
    for (const point of validPoints) {
        for (const value of point.listValues) {
            const normalizedKey = normalizeForComparison(value)
            if (!uniqueValues.has(normalizedKey)) {
                uniqueValues.set(normalizedKey, capitalizeFirst(value.trim()))
            }
        }
    }

    // If no list values found, return empty
    if (uniqueValues.size === 0) {
        return { propertyId, displayName, labels: [], datasets: [] }
    }

    // Step 2: Group data points by time unit
    const grouped = new Map<
        string,
        {
            date: Date
            // Set of normalized list values present in this time period
            valuesPresent: Set<string>
            filePaths: string[]
            // Map normalized value -> file paths containing that value
            valueFilePaths: Map<string, string[]>
        }
    >()

    for (const point of validPoints) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, granularity)
        const normDate = normalizeDate(date, granularity)

        if (!grouped.has(key)) {
            grouped.set(key, {
                date: normDate,
                valuesPresent: new Set(),
                filePaths: [],
                valueFilePaths: new Map()
            })
        }

        const group = grouped.get(key)!
        group.filePaths.push(point.filePath)

        // Track which values are present in this time period
        for (const value of point.listValues) {
            const normalizedKey = normalizeForComparison(value)
            group.valuesPresent.add(normalizedKey)

            // Track file paths per value
            if (!group.valueFilePaths.has(normalizedKey)) {
                group.valueFilePaths.set(normalizedKey, [])
            }
            const valuePaths = group.valueFilePaths.get(normalizedKey)!
            if (!valuePaths.includes(point.filePath)) {
                valuePaths.push(point.filePath)
            }
        }
    }

    // Step 3: Sort by date and build labels
    const sortedGroups = [...grouped.entries()].sort((a, b) => compareAsc(a[1].date, b[1].date))
    const labels = sortedGroups.map(([, g]) => formatDateByGranularity(g.date, granularity))

    // Step 4: Create one dataset per unique list value
    const datasets: ChartDataset[] = []

    for (const [normalizedKey, displayLabel] of uniqueValues) {
        const data: (number | null)[] = []
        const filePaths: string[][] = []

        for (const [, group] of sortedGroups) {
            // 1 if this value is present in this time period, 0 otherwise
            const isPresent = group.valuesPresent.has(normalizedKey)
            data.push(isPresent ? 1 : 0)

            // File paths for entries containing this value in this time period
            const paths = group.valueFilePaths.get(normalizedKey) ?? []
            filePaths.push(paths)
        }

        datasets.push({
            label: displayLabel,
            data,
            filePaths,
            propertyId
        })
    }

    // Sort datasets alphabetically by label for consistent ordering
    datasets.sort((a, b) => a.label.localeCompare(b.label))

    return {
        propertyId,
        displayName,
        labels,
        datasets
    }
}

/**
 * Aggregate data for pie/doughnut/polarArea chart visualization.
 * Groups values by their display labels and counts frequency.
 * For list properties, counts individual list value occurrences (case-insensitive).
 * Entries without values are counted as "No data".
 */
export function aggregateForPieChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): PieChartData {
    // Check if data contains list values
    const isListData = hasListData(dataPoints)

    // If list data, aggregate by individual list values
    if (isListData) {
        return aggregateListForPieChart(dataPoints, propertyId, displayName)
    }

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
 * Aggregate list data for pie/doughnut/polarArea chart.
 * Counts individual list value occurrences (case-insensitive).
 */
function aggregateListForPieChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): PieChartData {
    // Map normalized key -> { displayLabel, count, filePaths }
    // We keep track of the first-seen display label for each normalized key
    const valueGroups = new Map<
        string,
        { displayLabel: string; count: number; filePaths: string[] }
    >()

    for (const point of dataPoints) {
        if (point.listValues.length === 0) {
            // Entry has no list values - count as "No data"
            const key = normalizeForComparison(NO_DATA_LABEL)
            if (!valueGroups.has(key)) {
                valueGroups.set(key, { displayLabel: NO_DATA_LABEL, count: 0, filePaths: [] })
            }
            const group = valueGroups.get(key)!
            group.count++
            group.filePaths.push(point.filePath)
            continue
        }

        // Count each list value individually
        for (const value of point.listValues) {
            const normalizedKey = normalizeForComparison(value)

            if (!valueGroups.has(normalizedKey)) {
                // Use capitalized version for display
                valueGroups.set(normalizedKey, {
                    displayLabel: capitalizeFirst(value.trim()),
                    count: 0,
                    filePaths: []
                })
            }

            const group = valueGroups.get(normalizedKey)!
            group.count++
            // Only add file path once per entry (even if value appears multiple times in same entry)
            if (!group.filePaths.includes(point.filePath)) {
                group.filePaths.push(point.filePath)
            }
        }
    }

    // Convert to arrays sorted by count descending
    const sortedEntries = [...valueGroups.values()].sort((a, b) => b.count - a.count)

    const labels = sortedEntries.map((entry) => entry.displayLabel)
    const values = sortedEntries.map((entry) => entry.count)
    const filePaths = sortedEntries.map((entry) => entry.filePaths)

    return {
        propertyId,
        displayName,
        labels,
        values,
        filePaths,
        isBooleanData: false
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

/**
 * Property data for overlay chart aggregation
 */
export interface OverlayPropertyData {
    propertyId: BasesPropertyId
    displayName: string
    dataPoints: VisualizationDataPoint[]
}

/**
 * Aggregate data for overlay chart visualization (multiple properties on one chart).
 * Aligns timestamps across all properties to create unified labels.
 * Each property becomes a separate dataset.
 */
export function aggregateForOverlayChart(
    propertiesData: OverlayPropertyData[],
    overlayDisplayName: string,
    granularity: TimeGranularity
): ChartData {
    if (propertiesData.length === 0) {
        return {
            propertyId: '' as BasesPropertyId,
            displayName: overlayDisplayName,
            labels: [],
            datasets: []
        }
    }

    // Step 1: Collect all unique time keys across all properties
    const allTimeKeys = new Map<string, Date>()

    for (const propData of propertiesData) {
        for (const point of propData.dataPoints) {
            if (point.dateAnchor) {
                const key = getTimeKey(point.dateAnchor.date, granularity)
                if (!allTimeKeys.has(key)) {
                    allTimeKeys.set(key, normalizeDate(point.dateAnchor.date, granularity))
                }
            }
        }
    }

    // Step 2: Sort time keys by date
    const sortedTimeEntries = [...allTimeKeys.entries()].sort((a, b) => compareAsc(a[1], b[1]))

    // Create unified labels array
    const labels = sortedTimeEntries.map(([, date]) => formatDateByGranularity(date, granularity))

    // Create a map from time key to label index for fast lookup
    const timeKeyToIndex = new Map<string, number>()
    sortedTimeEntries.forEach(([key], index) => {
        timeKeyToIndex.set(key, index)
    })

    // Step 3: For each property, create a dataset aligned to unified labels
    const datasets: ChartDataset[] = []

    for (const propData of propertiesData) {
        // Group this property's data by time unit
        const grouped = new Map<string, { values: number[]; filePaths: string[] }>()

        for (const point of propData.dataPoints) {
            if (!point.dateAnchor) continue

            const key = getTimeKey(point.dateAnchor.date, granularity)

            if (!grouped.has(key)) {
                grouped.set(key, { values: [], filePaths: [] })
            }

            const group = grouped.get(key)!
            group.values.push(point.numericValue ?? 0)
            group.filePaths.push(point.filePath)
        }

        // Create data array aligned to unified labels (null for missing time periods)
        const data: (number | null)[] = new Array(labels.length).fill(null)
        const filePaths: string[][] = new Array(labels.length).fill(null).map(() => [])

        for (const [key, group] of grouped) {
            const index = timeKeyToIndex.get(key)
            if (index !== undefined) {
                // Calculate average for this time period
                data[index] = group.values.reduce((a, b) => a + b, 0) / group.values.length
                filePaths[index] = group.filePaths
            }
        }

        datasets.push({
            label: propData.displayName,
            data,
            filePaths,
            propertyId: propData.propertyId
        })
    }

    // Use first property ID as representative (for compatibility)
    const firstPropertyId = propertiesData[0]?.propertyId ?? ('' as BasesPropertyId)

    return {
        propertyId: firstPropertyId,
        displayName: overlayDisplayName,
        labels,
        datasets
    }
}
