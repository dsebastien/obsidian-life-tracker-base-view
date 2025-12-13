import { formatDateByGranularity } from '../../../utils'
import { TimeGranularity } from '../../types'

/**
 * Shared tooltip component for visualizations
 */
export class Tooltip {
    private el: HTMLElement
    private visible = false

    constructor(container: HTMLElement) {
        this.el = container.createDiv({ cls: 'lt-tooltip' })
    }

    /**
     * Show tooltip at position with content
     */
    show(x: number, y: number, title: string, value?: string, subtitle?: string): void {
        this.el.empty()

        if (title) {
            this.el.createDiv({ cls: 'lt-tooltip-title', text: title })
        }

        if (value) {
            this.el.createDiv({ cls: 'lt-tooltip-value', text: value })
        }

        if (subtitle) {
            this.el.createDiv({ cls: 'lt-tooltip-subtitle', text: subtitle })
        }

        // Position tooltip
        this.el.style.left = `${x}px`
        this.el.style.top = `${y}px`

        // Show
        this.el.classList.add('lt-tooltip--visible')
        this.visible = true

        // Adjust position if tooltip goes off screen
        requestAnimationFrame(() => {
            this.adjustPosition()
        })
    }

    /**
     * Hide tooltip
     */
    hide(): void {
        this.el.classList.remove('lt-tooltip--visible')
        this.visible = false
    }

    /**
     * Check if tooltip is visible
     */
    isVisible(): boolean {
        return this.visible
    }

    /**
     * Destroy tooltip element
     */
    destroy(): void {
        this.el.remove()
    }

    /**
     * Adjust tooltip position to stay within viewport
     */
    private adjustPosition(): void {
        const rect = this.el.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Check right edge
        if (rect.right > viewportWidth) {
            const newLeft = Math.max(0, viewportWidth - rect.width - 10)
            this.el.style.left = `${newLeft}px`
        }

        // Check bottom edge
        if (rect.bottom > viewportHeight) {
            const newTop = Math.max(0, viewportHeight - rect.height - 10)
            this.el.style.top = `${newTop}px`
        }
    }
}

/**
 * Create tooltip content for heatmap cell
 */
export function formatHeatmapTooltip(
    date: Date,
    value: number | null,
    count: number,
    displayName: string,
    granularity: TimeGranularity = TimeGranularity.Daily
): { title: string; value: string; subtitle: string } {
    const dateStr = formatDateByGranularity(date, granularity)

    const valueStr = value !== null ? value.toFixed(2) : 'No data'

    const subtitle = count > 0 ? `${count} ${count === 1 ? 'entry' : 'entries'}` : ''

    return {
        title: dateStr,
        value: `${displayName}: ${valueStr}`,
        subtitle
    }
}

/**
 * Create tooltip content for chart point
 */
export function formatChartTooltip(
    label: string,
    value: number,
    datasetLabel: string
): { title: string; value: string } {
    return {
        title: label,
        value: `${datasetLabel}: ${value.toFixed(2)}`
    }
}

/**
 * Create tooltip content for tag cloud item
 */
export function formatTagTooltip(tag: string, frequency: number): { title: string; value: string } {
    return {
        title: tag,
        value: `${frequency} ${frequency === 1 ? 'occurrence' : 'occurrences'}`
    }
}
