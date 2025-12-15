import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type { TimelineData, VisualizationConfig, VisualizationDataPoint } from '../../../types'
import { DataAggregationService } from '../../../services/data-aggregation.service'
import { Tooltip } from '../../ui/tooltip'
import { differenceInMilliseconds, parseISO } from 'date-fns'
import { formatDateByGranularity, log } from '../../../../utils'

/**
 * Shared aggregation service instance for all timeline visualizations
 */
const sharedAggregationService = new DataAggregationService()

/**
 * Timeline visualization for date-based data
 */
export class TimelineVisualization extends BaseVisualization {
    private tooltip: Tooltip | null = null
    private timelineEl: HTMLElement | null = null
    private timelineData: TimelineData | null = null

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: VisualizationConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
    }

    /**
     * Render the timeline with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering timeline for ${this.displayName}`, 'debug')

        // Aggregate data (use shared service)
        // Data is already pre-filtered based on showEmptyValues
        this.timelineData = sharedAggregationService.aggregateForTimeline(
            data,
            this.propertyId,
            this.displayName
        )

        if (this.timelineData.points.length === 0) {
            this.showEmptyState(`No date data found for "${this.displayName}"`)
            return
        }

        // Clear container
        this.containerEl.empty()

        // Create section header
        this.createSectionHeader(this.displayName)

        // Create timeline container (auto-height, no scrolling)
        this.timelineEl = this.containerEl.createDiv({ cls: 'lt-timeline' })

        // Create tooltip
        this.tooltip = new Tooltip(this.timelineEl)

        // Create timeline line
        this.timelineEl.createDiv({ cls: 'lt-timeline-line' })

        // Calculate positions and render points
        this.renderTimelinePoints()

        // Create axis labels
        this.renderAxisLabels()
    }

    /**
     * Render timeline points
     */
    private renderTimelinePoints(): void {
        if (!this.timelineEl || !this.timelineData) return

        const { points, minDate, maxDate } = this.timelineData
        const timeRange = differenceInMilliseconds(maxDate, minDate)

        if (timeRange === 0) {
            // Single point - center it
            const point = points[0]
            if (point) {
                this.renderPoint(point.date, point.value, point.label, point.filePaths.length, 50)
            }
            return
        }

        for (const point of points) {
            const elapsed = differenceInMilliseconds(point.date, minDate)
            const position = (elapsed / timeRange) * 100
            this.renderPoint(point.date, point.value, point.label, point.filePaths.length, position)
        }
    }

    /**
     * Render a single timeline point
     */
    private renderPoint(
        date: Date,
        value: number | null,
        label: string,
        entryCount: number,
        positionPercent: number
    ): void {
        if (!this.timelineEl || !this.timelineData) return

        const pointEl = this.timelineEl.createDiv({ cls: 'lt-timeline-point' })
        // Position within the line area (line has 1rem offset on each side)
        // At 0%: left = 1rem, at 100%: left = calc(100% - 1rem)
        const paddingOffset = positionPercent * 0.02
        pointEl.style.left = `calc(${positionPercent}% + 1rem - ${paddingOffset}rem)`

        // Scale point size by entry count
        const baseSize = 12
        const maxSize = 24
        const size = Math.min(baseSize + entryCount * 2, maxSize)
        pointEl.style.width = `${size}px`
        pointEl.style.height = `${size}px`

        // Store data
        pointEl.dataset['date'] = date.toISOString()
        if (value !== null) {
            pointEl.dataset['value'] = String(value)
        }
        pointEl.dataset['label'] = label
        pointEl.dataset['count'] = String(entryCount)

        // Add event listeners
        pointEl.addEventListener('mouseenter', (e) => this.handlePointHover(e, pointEl))
        pointEl.addEventListener('mouseleave', () => this.handlePointLeave())
        pointEl.addEventListener('click', () => this.handlePointClick(date))
    }

    /**
     * Render axis labels (start and end dates)
     */
    private renderAxisLabels(): void {
        if (!this.timelineEl || !this.timelineData) return

        const { minDate, maxDate } = this.timelineData

        // Start label
        const startLabel = this.timelineEl.createDiv({
            cls: 'lt-timeline-label lt-timeline-label--start'
        })
        startLabel.textContent = formatDateByGranularity(minDate, this.config.granularity)

        // End label
        const endLabel = this.timelineEl.createDiv({
            cls: 'lt-timeline-label lt-timeline-label--end'
        })
        endLabel.textContent = formatDateByGranularity(maxDate, this.config.granularity)
    }

    /**
     * Update the timeline with new data
     */
    override update(data: VisualizationDataPoint[]): void {
        // Re-render for simplicity
        this.render(data)
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.tooltip?.destroy()
        this.tooltip = null
        this.timelineEl = null
        this.timelineData = null
    }

    /**
     * Handle point hover - show tooltip
     */
    private handlePointHover(_event: MouseEvent, pointEl: HTMLElement): void {
        if (!this.tooltip) return

        const dateStr = pointEl.dataset['date']
        const valueStr = pointEl.dataset['value']
        const labelStr = pointEl.dataset['label']
        const countStr = pointEl.dataset['count']
        const count = countStr ? parseInt(countStr, 10) : 0

        if (!dateStr) return

        const date = parseISO(dateStr)
        const title = formatDateByGranularity(date, this.config.granularity)
        // Format value like other charts: "PropertyName: value"
        // Use numeric value if available, otherwise fall back to text label
        const numValue = valueStr ? parseFloat(valueStr) : null
        let valueDisplay: string
        if (numValue !== null) {
            valueDisplay = `${this.displayName}: ${numValue.toFixed(2)}`
        } else if (labelStr) {
            valueDisplay = `${this.displayName}: ${labelStr}`
        } else {
            valueDisplay = `${this.displayName}: No data`
        }
        const subtitle = count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : ''

        const rect = pointEl.getBoundingClientRect()
        this.tooltip.show(rect.left + rect.width / 2, rect.top - 10, title, valueDisplay, subtitle)
    }

    /**
     * Handle point leave - hide tooltip
     */
    private handlePointLeave(): void {
        this.tooltip?.hide()
    }

    /**
     * Handle point click - open related files
     */
    private handlePointClick(date: Date): void {
        if (!this.timelineData) return

        const point = this.timelineData.points.find(
            (p) => p.date.toDateString() === date.toDateString()
        )

        if (point && point.filePaths.length > 0) {
            this.openFilePaths(point.filePaths)
        }
    }
}
