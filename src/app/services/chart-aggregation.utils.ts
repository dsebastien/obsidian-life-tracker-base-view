import type { BasesEntry, BasesPropertyId } from 'obsidian'
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
import { formatDateByGranularity, extractList } from '../../utils'
import { getTimeKey, normalizeDate } from './date-grouping.utils'

/**
 * Format a value for display as a timeline label.
 * Handles objects, arrays, and primitives properly.
 * Returns empty string for null/undefined/empty values (never "null" string).
 */
function formatTimelineLabel(value: unknown): string {
    if (value === null || value === undefined) {
        return ''
    }

    // Handle arrays
    if (Array.isArray(value)) {
        const filtered = value.filter((v) => v !== null && v !== undefined && v !== 'null')
        return filtered.join(', ')
    }

    // Handle objects (avoid [object Object])
    if (typeof value === 'object') {
        return JSON.stringify(value)
    }

    // Primitives - check for "null" string
    const strValue = String(value)
    if (strValue === 'null' || strValue === 'undefined') {
        return ''
    }

    return strValue
}

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

/** Max recursion depth for valueToLabel to prevent infinite loops */
const MAX_VALUE_DEPTH = 10

/**
 * Convert a value to a display string for pie chart labels.
 * Returns null if the value should be skipped (internal objects, empty, etc.)
 */
function valueToLabel(value: unknown, depth: number = 0): string | null {
    // Prevent infinite recursion
    if (depth > MAX_VALUE_DEPTH) {
        return null
    }

    if (value === null || value === undefined) {
        return null
    }

    // Handle arrays - join items, skip if empty
    if (Array.isArray(value)) {
        const filtered = value
            .filter((v) => v !== null && v !== undefined && v !== 'null')
            .map((v) => valueToLabel(v, depth + 1))
            .filter((v): v is string => v !== null && v.length > 0)
        if (filtered.length === 0) {
            return null
        }
        return filtered.join(', ')
    }

    // Handle objects (including Obsidian's Value type)
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>

        // First, try calling toString() - Obsidian's Value type has a meaningful toString()
        // that returns the actual value (e.g., "true", "false", "1", "some text")
        if (typeof obj['toString'] === 'function') {
            const strValue = String(value).trim()
            // If toString() returns something meaningful (not [object Object]), use it
            if (strValue && strValue !== '[object Object]' && !strValue.startsWith('[object ')) {
                // Capitalize boolean values
                if (strValue === 'true') return 'True'
                if (strValue === 'false') return 'False'
                // Skip null/undefined strings
                if (strValue === 'null' || strValue === 'undefined') return null
                return strValue
            }
        }

        // For plain objects, try to extract meaningful display value
        // This handles Obsidian links which have 'display' property
        // Priority: display > value > name > label > text
        const displayValue =
            obj['display'] ?? obj['value'] ?? obj['name'] ?? obj['label'] ?? obj['text']
        if (displayValue !== undefined && displayValue !== null) {
            return valueToLabel(displayValue, depth + 1)
        }

        // If this is an internal Obsidian object with only metadata (icon, subpath, etc.)
        // and no displayable value, try path as fallback
        if ('icon' in obj || 'subpath' in obj) {
            if ('path' in obj && typeof obj['path'] === 'string') {
                // Extract filename from path
                const path = obj['path'] as string
                const filename = path.split('/').pop() ?? path
                // Remove .md extension if present
                return filename.replace(/\.md$/, '')
            }
            // For icon-only objects (broken links, unresolved references), return "Unknown"
            // so they are still counted in pie charts rather than being skipped entirely
            return 'Unknown'
        }

        // For other objects, stringify them
        return JSON.stringify(value)
    }

    // Primitives - convert to string
    const str = String(value).trim()

    if (!str || str === 'null' || str === 'undefined') {
        return null
    }

    // Check if this is a stringified internal Obsidian object (like links with icons)
    if (str.startsWith('{') && str.endsWith('}')) {
        if (
            str.includes('"icon"') ||
            str.includes('"subpath"') ||
            (str.includes('"type"') && str.includes('"path"'))
        ) {
            try {
                const parsed = JSON.parse(str)
                if (typeof parsed === 'object' && parsed !== null) {
                    // Recursively process the parsed object
                    return valueToLabel(parsed, depth + 1)
                }
            } catch {
                // Not valid JSON, return as-is
            }
        }
    }

    return str
}

/**
 * Aggregate data for pie/doughnut chart visualization
 * Groups values and counts their frequency
 * Always filters out null/empty values - they are never shown as a category
 */
export function aggregateForPieChart(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): PieChartData {
    // Group by value
    const valueGroups = new Map<string, { count: number; entries: BasesEntry[] }>()

    for (const point of dataPoints) {
        // Use point.value which now contains the RAW value (not entry.getValue again)
        const rawValue = point.value

        // Convert raw value to display label, skip if not displayable
        const valueStr = valueToLabel(rawValue)
        if (!valueStr) {
            continue
        }

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
 * Always filters out null/empty tags
 */
export function aggregateForTagCloud(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string
): TagCloudData {
    const tagCounts = new Map<string, { frequency: number; entries: BasesEntry[] }>()

    for (const point of dataPoints) {
        if (!point.value) continue

        // Get raw value from entry for extractList (needs Obsidian's Value type)
        const value = point.entry.getValue(propertyId)
        const tags = extractList(value)

        for (const tag of tags) {
            // Skip empty, null, or undefined tags
            if (!tag || tag === 'null' || tag === 'undefined') continue

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
    const points: TimelinePoint[] = validPoints.map((p) => {
        const label = formatTimelineLabel(p.value)
        return {
            date: p.dateAnchor!.date,
            label: label || p.entry.file.basename,
            entries: [p.entry]
        }
    })

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
