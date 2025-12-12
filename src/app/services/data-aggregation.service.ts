import type { BasesEntry, BasesPropertyId } from 'obsidian'
import { TimeGranularity } from '../domain/time-granularity.enum'
import type {
    BubbleChartData,
    ChartData,
    HeatmapCell,
    HeatmapData,
    PieChartData,
    ScatterChartData,
    TagCloudData,
    TimelineData,
    VisualizationDataPoint
} from '../types/visualization.types'
import type { ResolvedDateAnchor } from '../types/date-anchor.types'
import { compareAsc, min, max } from 'date-fns'
import { extractNumber } from '../../utils/value-extractors'
import { getTimeKey, normalizeDate, generateEmptyCells } from './date-grouping.utils'
import {
    aggregateForChart as chartAggregation,
    aggregateForPieChart as pieChartAggregation,
    aggregateForScatterChart as scatterChartAggregation,
    aggregateForBubbleChart as bubbleChartAggregation,
    aggregateForTagCloud as tagCloudAggregation,
    aggregateForTimeline as timelineAggregation
} from './chart-aggregation.utils'

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
            const key = getTimeKey(date, granularity)
            const normDate = normalizeDate(date, granularity)

            if (!cellMap.has(key)) {
                cellMap.set(key, { date: normDate, values: [], entries: [] })
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
            const emptyCells = generateEmptyCells(minDate, maxDate, granularity, cellMap)
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
        return chartAggregation(dataPoints, propertyId, displayName, granularity)
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
        return pieChartAggregation(dataPoints, propertyId, displayName)
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
        return scatterChartAggregation(dataPoints, propertyId, displayName)
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
        return bubbleChartAggregation(dataPoints, propertyId, displayName, granularity)
    }

    /**
     * Aggregate data for tag cloud visualization
     */
    aggregateForTagCloud(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): TagCloudData {
        return tagCloudAggregation(dataPoints, propertyId, displayName)
    }

    /**
     * Aggregate data for timeline visualization
     */
    aggregateForTimeline(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): TimelineData {
        return timelineAggregation(dataPoints, propertyId, displayName)
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
}
