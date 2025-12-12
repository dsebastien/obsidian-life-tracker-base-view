import type { BasesEntry, BasesPropertyId } from 'obsidian'
import { TimeGranularity } from '../domain/time-granularity.enum'
import type {
    BubbleChartData,
    BubblePoint,
    ChartData,
    ChartDataset,
    HeatmapCell,
    HeatmapData,
    PieChartData,
    ScatterChartData,
    ScatterPoint,
    TagCloudData,
    TagCloudItem,
    TimelineData,
    TimelinePoint,
    VisualizationDataPoint
} from '../types/visualization.types'
import type { ResolvedDateAnchor } from '../types/date-anchor.types'
import { format, compareAsc, min, max } from 'date-fns'
import {
    addDays,
    addMonths,
    addWeeks,
    formatDateByGranularity,
    formatDateISO,
    getQuarter,
    isSameDay,
    isSameMonth,
    isSameQuarter,
    isSameWeek,
    isSameYear,
    startOfDay,
    startOfMonth,
    startOfQuarter,
    startOfWeek,
    startOfYear
} from '../../utils/date-utils'
import { extractList, extractNumber } from '../../utils/value-extractors'

/**
 * Service for aggregating data for visualizations
 */
export class DataAggregationService {
    /**
     * Create visualization data points from entries
     */
    createDataPoints(
        entries: BasesEntry[],
        propertyId: BasesPropertyId,
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>
    ): VisualizationDataPoint[] {
        return entries.map((entry) => {
            const value = entry.getValue(propertyId)
            const dateAnchor = dateAnchors.get(entry) ?? null

            return {
                entry,
                dateAnchor,
                value: value?.toString() ?? null,
                normalizedValue: extractNumber(value)
            }
        })
    }

    /**
     * Aggregate data for heatmap visualization
     */
    aggregateForHeatmap(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity,
        showEmptyDates: boolean
    ): HeatmapData {
        // Filter points with valid date anchors
        const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

        if (validPoints.length === 0) {
            return this.createEmptyHeatmapData(propertyId, displayName, granularity)
        }

        // Get date range
        const dates = validPoints.map((p) => p.dateAnchor!.date)
        const minDate = min(dates)
        const maxDate = max(dates)

        // Group by time unit
        const cellMap = new Map<string, { date: Date; values: number[]; entries: BasesEntry[] }>()

        for (const point of validPoints) {
            const date = point.dateAnchor!.date
            const key = this.getTimeKey(date, granularity)
            const normalizedDate = this.normalizeDate(date, granularity)

            if (!cellMap.has(key)) {
                cellMap.set(key, { date: normalizedDate, values: [], entries: [] })
            }

            const cell = cellMap.get(key)!
            if (point.normalizedValue !== null) {
                cell.values.push(point.normalizedValue)
            }
            cell.entries.push(point.entry)
        }

        // Calculate cells
        const cells: HeatmapCell[] = []
        let minValue = Infinity
        let maxValue = -Infinity

        for (const { date, values, entries } of cellMap.values()) {
            const avgValue =
                values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null

            if (avgValue !== null) {
                minValue = Math.min(minValue, avgValue)
                maxValue = Math.max(maxValue, avgValue)
            }

            cells.push({
                date,
                value: avgValue,
                count: entries.length,
                entries
            })
        }

        // Add empty cells if requested
        if (showEmptyDates) {
            const emptyCells = this.generateEmptyCells(minDate, maxDate, granularity, cellMap)
            cells.push(...emptyCells)
        }

        // Sort cells by date
        cells.sort((a, b) => compareAsc(a.date, b.date))

        return {
            propertyId,
            displayName,
            granularity,
            cells,
            minDate,
            maxDate,
            minValue: minValue === Infinity ? 0 : minValue,
            maxValue: maxValue === -Infinity ? 1 : maxValue
        }
    }

    /**
     * Aggregate data for chart visualization
     */
    aggregateForChart(
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
            const key = this.getTimeKey(date, granularity)
            const normalizedDate = this.normalizeDate(date, granularity)

            if (!grouped.has(key)) {
                grouped.set(key, { date: normalizedDate, values: [], entries: [] })
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
    aggregateForPieChart(
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
     * Aggregate data for radar chart visualization
     * Groups numeric values by time period
     */
    aggregateForRadarChart(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity
    ): ChartData {
        // For radar charts, we use the same aggregation as regular charts
        // but the rendering will be different
        return this.aggregateForChart(dataPoints, propertyId, displayName, granularity)
    }

    /**
     * Aggregate data for scatter chart visualization
     * Each point shows time (x) vs value (y)
     */
    aggregateForScatterChart(
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
    aggregateForBubbleChart(
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
            const key = this.getTimeKey(date, granularity)
            const normalizedDate = this.normalizeDate(date, granularity)

            if (!grouped.has(key)) {
                grouped.set(key, { date: normalizedDate, values: [], entries: [] })
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
    aggregateForTagCloud(
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
    aggregateForTimeline(
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

    /**
     * Get time key for grouping
     */
    private getTimeKey(date: Date, granularity: TimeGranularity): string {
        switch (granularity) {
            case TimeGranularity.Daily:
                return formatDateISO(date)

            case TimeGranularity.Weekly:
                return formatDateISO(startOfWeek(date))

            case TimeGranularity.Monthly:
                return format(date, 'yyyy-MM')

            case TimeGranularity.Quarterly:
                return `${format(date, 'yyyy')}-Q${getQuarter(date)}`

            case TimeGranularity.Yearly:
                return format(date, 'yyyy')

            default:
                return formatDateISO(date)
        }
    }

    /**
     * Normalize date to start of time unit
     */
    private normalizeDate(date: Date, granularity: TimeGranularity): Date {
        switch (granularity) {
            case TimeGranularity.Daily:
                return startOfDay(date)

            case TimeGranularity.Weekly:
                return startOfWeek(date)

            case TimeGranularity.Monthly:
                return startOfMonth(date)

            case TimeGranularity.Quarterly:
                return startOfQuarter(date)

            case TimeGranularity.Yearly:
                return startOfYear(date)

            default:
                return startOfDay(date)
        }
    }

    /**
     * Generate empty cells for date range
     */
    private generateEmptyCells(
        minDate: Date,
        maxDate: Date,
        granularity: TimeGranularity,
        existingCells: Map<string, unknown>
    ): HeatmapCell[] {
        const cells: HeatmapCell[] = []
        let current = this.normalizeDate(minDate, granularity)
        const end = this.normalizeDate(maxDate, granularity)

        while (current <= end) {
            const key = this.getTimeKey(current, granularity)

            if (!existingCells.has(key)) {
                cells.push({
                    date: new Date(current),
                    value: null,
                    count: 0,
                    entries: []
                })
            }

            current = this.incrementDate(current, granularity)
        }

        return cells
    }

    /**
     * Increment date by granularity
     */
    private incrementDate(date: Date, granularity: TimeGranularity): Date {
        switch (granularity) {
            case TimeGranularity.Daily:
                return addDays(date, 1)

            case TimeGranularity.Weekly:
                return addWeeks(date, 1)

            case TimeGranularity.Monthly:
                return addMonths(date, 1)

            case TimeGranularity.Quarterly:
                return addMonths(date, 3)

            case TimeGranularity.Yearly:
                return addMonths(date, 12)

            default:
                return addDays(date, 1)
        }
    }

    /**
     * Create empty heatmap data
     */
    private createEmptyHeatmapData(
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity
    ): HeatmapData {
        return {
            propertyId,
            displayName,
            granularity,
            cells: [],
            minDate: new Date(),
            maxDate: new Date(),
            minValue: 0,
            maxValue: 1
        }
    }

    /**
     * Check if two dates match based on granularity
     */
    matchesByGranularity(date1: Date, date2: Date, granularity: TimeGranularity): boolean {
        switch (granularity) {
            case TimeGranularity.Daily:
                return isSameDay(date1, date2)

            case TimeGranularity.Weekly:
                return isSameWeek(date1, date2)

            case TimeGranularity.Monthly:
                return isSameMonth(date1, date2)

            case TimeGranularity.Quarterly:
                return isSameQuarter(date1, date2)

            case TimeGranularity.Yearly:
                return isSameYear(date1, date2)

            default:
                return isSameDay(date1, date2)
        }
    }
}
