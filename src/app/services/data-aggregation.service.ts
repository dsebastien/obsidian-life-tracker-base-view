import type { BasesEntry, BasesPropertyId } from 'obsidian'
import {
    TimeGranularity,
    type BubbleChartData,
    type ChartData,
    type HeatmapCell,
    type HeatmapData,
    type PieChartData,
    type PropertyDefinition,
    type ScatterChartData,
    type TagCloudData,
    type TimelineData,
    type VisualizationDataPoint,
    type ResolvedDateAnchor
} from '../types'
import { compareAsc, min, max } from 'date-fns'
import {
    extractNumber,
    extractBoolean,
    extractDisplayLabel,
    extractList,
    extractNumberWithMapping
} from '../../utils'
import { getTimeKey, normalizeDate } from './date-grouping.utils'
import {
    aggregateForChart as chartAggregation,
    aggregateForPieChart as pieChartAggregation,
    aggregateForScatterChart as scatterChartAggregation,
    aggregateForBubbleChart as bubbleChartAggregation,
    aggregateForTagCloud as tagCloudAggregation,
    aggregateForTimeline as timelineAggregation,
    aggregateForOverlayChart as overlayChartAggregation,
    aggregateListForChart as listChartAggregation,
    hasListData as checkHasListData,
    type OverlayPropertyData
} from './chart-aggregation.utils'

/**
 * Check if a data point has any meaningful data
 */
function dataPointHasValue(point: VisualizationDataPoint): boolean {
    return point.numericValue !== null || point.booleanValue !== null || point.listValues.length > 0
}

/**
 * Service for aggregating data for visualizations
 */
export class DataAggregationService {
    /**
     * Create visualization data points from entries.
     * Extracts and cleans all values once - visualizations receive clean data with no raw Obsidian types.
     * When showEmptyValues is false, filters out entries that have no meaningful data.
     */
    createDataPoints(
        entries: BasesEntry[],
        propertyId: BasesPropertyId,
        propertyDisplayName: string,
        propertyDefinition: PropertyDefinition | null,
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>,
        showEmptyValues: boolean = true
    ): VisualizationDataPoint[] {
        const dataPoints = entries.map((entry) => {
            const dateAnchor = dateAnchors.get(entry) ?? null

            const rawValue = entry.getValue(propertyId)

            // Extract numeric value (excludes booleans)
            let numericValue = extractNumber(rawValue)

            // Apply custom value mapping if configured
            if (
                propertyDefinition?.valueMapping &&
                Object.keys(propertyDefinition.valueMapping).length > 0
            ) {
                const mappedValue = extractNumberWithMapping(
                    rawValue,
                    propertyDefinition.valueMapping
                )
                if (mappedValue !== null) {
                    numericValue = mappedValue
                } else {
                    // Unmapped value - treat as 0 per user requirement
                    numericValue = 0
                }
            } else {
                // No mapping - use standard extraction
                // Extract boolean value
                const booleanValue = extractBoolean(rawValue)
                if (booleanValue !== null) {
                    numericValue = booleanValue ? 1 : 0
                }
            }

            // Extract boolean value for display label (needed even with value mapping)
            const booleanValue = extractBoolean(rawValue)

            // Extract list values for tag cloud visualization
            const listValues = extractList(rawValue).filter(
                (v) => v && v !== 'null' && v !== 'undefined'
            )

            const displayLabel = extractDisplayLabel(
                propertyDisplayName,
                numericValue,
                booleanValue,
                listValues
            )

            // Extract file path for navigation
            const filePath = entry.file.path

            return {
                filePath,
                dateAnchor,
                numericValue,
                booleanValue,
                displayLabel,
                listValues
            }
        })

        // Filter out empty data points when showEmptyValues is false
        if (!showEmptyValues) {
            return dataPoints.filter(dataPointHasValue)
        }

        return dataPoints
    }

    /**
     * Aggregate data for heatmap visualization.
     * Data points should be pre-filtered based on showEmptyValues.
     */
    aggregateForHeatmap(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity
    ): HeatmapData {
        // Filter to points with dates
        const validPoints = dataPoints.filter((p) => p.dateAnchor !== null)

        if (validPoints.length === 0) {
            return this.createEmptyHeatmapData(propertyId, displayName, granularity)
        }

        // Get date range from valid points
        const dates = validPoints.map((p) => p.dateAnchor!.date)
        const minDate = min(dates)
        const maxDate = max(dates)

        // Group by time unit
        const cellMap = new Map<string, { date: Date; values: number[]; filePaths: string[] }>()

        for (const point of validPoints) {
            const date = point.dateAnchor!.date
            const key = getTimeKey(date, granularity)
            const normDate = normalizeDate(date, granularity)

            if (!cellMap.has(key)) {
                cellMap.set(key, { date: normDate, values: [], filePaths: [] })
            }

            const cell = cellMap.get(key)!
            if (point.numericValue !== null) {
                cell.values.push(point.numericValue)
            }
            cell.filePaths.push(point.filePath)
        }

        // Calculate cells
        const cells: HeatmapCell[] = []
        let minValue = Infinity
        let maxValue = -Infinity

        for (const { date, values, filePaths } of cellMap.values()) {
            const avgValue =
                values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null

            if (avgValue !== null) {
                minValue = Math.min(minValue, avgValue)
                maxValue = Math.max(maxValue, avgValue)
            }

            cells.push({
                date,
                value: avgValue,
                count: filePaths.length,
                filePaths
            })
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
     * Aggregate data for chart visualization (line, bar, area).
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
     * Aggregate list data for chart visualization (line, bar, area).
     * Creates one dataset per unique list value, showing 0/1 presence per time period.
     */
    aggregateListForChart(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity
    ): ChartData {
        return listChartAggregation(dataPoints, propertyId, displayName, granularity)
    }

    /**
     * Check if data points contain list data.
     */
    hasListData(dataPoints: VisualizationDataPoint[]): boolean {
        return checkHasListData(dataPoints)
    }

    /**
     * Aggregate data for pie/doughnut chart visualization.
     * Groups values and counts their frequency.
     * Entries without values are counted as "No data".
     */
    aggregateForPieChart(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): PieChartData {
        return pieChartAggregation(dataPoints, propertyId, displayName)
    }

    /**
     * Aggregate data for radar chart visualization.
     * Groups numeric values by time period.
     */
    aggregateForRadarChart(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string,
        granularity: TimeGranularity
    ): ChartData {
        return this.aggregateForChart(dataPoints, propertyId, displayName, granularity)
    }

    /**
     * Aggregate data for scatter chart visualization.
     * Each point shows time (x) vs value (y).
     */
    aggregateForScatterChart(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): ScatterChartData {
        return scatterChartAggregation(dataPoints, propertyId, displayName)
    }

    /**
     * Aggregate data for bubble chart visualization.
     * Groups by time period, showing value (y) and count (radius).
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
     * Aggregate data for tag cloud visualization.
     */
    aggregateForTagCloud(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): TagCloudData {
        return tagCloudAggregation(dataPoints, propertyId, displayName)
    }

    /**
     * Aggregate data for timeline visualization.
     * Data points should be pre-filtered based on showEmptyValues.
     */
    aggregateForTimeline(
        dataPoints: VisualizationDataPoint[],
        propertyId: BasesPropertyId,
        displayName: string
    ): TimelineData {
        return timelineAggregation(dataPoints, propertyId, displayName)
    }

    /**
     * Aggregate data for overlay chart visualization (multiple properties on one chart).
     * Aligns timestamps across all properties to create unified labels.
     * Each property becomes a separate dataset.
     */
    aggregateForOverlayChart(
        propertiesData: OverlayPropertyData[],
        overlayDisplayName: string,
        granularity: TimeGranularity
    ): ChartData {
        return overlayChartAggregation(propertiesData, overlayDisplayName, granularity)
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
