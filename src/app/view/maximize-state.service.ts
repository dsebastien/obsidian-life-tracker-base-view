import type { BasesPropertyId } from 'obsidian'
import type { BaseVisualization } from '../components/visualizations/base-visualization'
import type { GetDataPointsCallback } from '../types'
import { CSS_SELECTOR, DATA_ATTR_FULL } from '../../utils'

/**
 * Visualization entry with property ID (keyed by visualization ID)
 */
export interface VisualizationEntry {
    propertyId: BasesPropertyId
    propertyDisplayName: string
    visualization: BaseVisualization
}

/**
 * Service for managing card maximize/minimize state.
 * Handles escape key listeners and DOM class updates.
 *
 * State is keyed by visualization ID, not property ID: one property can back
 * several visualizations, and maximizing one of them must not maximize its
 * siblings (issue #151).
 */
export class MaximizeStateService {
    private maximizedVisualizationId: string | null = null
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null

    constructor(
        private containerEl: HTMLElement,
        private getGridEl: () => HTMLElement | null,
        private getVisualizations: () => Map<string, VisualizationEntry>,
        private getDataPoints: GetDataPointsCallback
    ) {}

    /**
     * Get the currently maximized visualization ID
     */
    getMaximizedVisualizationId(): string | null {
        return this.maximizedVisualizationId
    }

    /**
     * Check if a visualization is currently maximized
     */
    isMaximized(visualizationId: string): boolean {
        return this.maximizedVisualizationId === visualizationId
    }

    /**
     * Toggle maximize state for a visualization
     */
    handleMaximizeToggle(visualizationId: string, maximize: boolean): void {
        const previousMaximized = this.maximizedVisualizationId

        // Clean up any existing escape handler first
        if (this.escapeHandler) {
            activeDocument.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }

        if (maximize) {
            this.maximizedVisualizationId = visualizationId

            // Add escape key handler - use arrow function that reads current state
            this.escapeHandler = (e: KeyboardEvent): void => {
                if (e.key === 'Escape' && this.maximizedVisualizationId) {
                    e.preventDefault()
                    e.stopPropagation()
                    this.handleMaximizeToggle(this.maximizedVisualizationId, false)
                }
            }
            activeDocument.addEventListener('keydown', this.escapeHandler)

            // Add maximized class to container
            this.containerEl.classList.add('lt-container--has-maximized')
        } else {
            this.maximizedVisualizationId = null

            // Remove maximized class from container
            this.containerEl.classList.remove('lt-container--has-maximized')
        }

        // Update visualization states
        const visualizations = this.getVisualizations()
        for (const [vizId, viz] of visualizations) {
            viz.visualization.setMaximized(vizId === this.maximizedVisualizationId)
        }

        // Update card classes
        const gridEl = this.getGridEl()
        if (gridEl) {
            const cards = gridEl.querySelectorAll(CSS_SELECTOR.CARD)
            cards.forEach((card) => {
                const cardVisualizationId = card.getAttribute(DATA_ATTR_FULL.VISUALIZATION_ID)

                // Skip unconfigured cards (those without data-visualization-id) - they never
                // participate in maximize state
                if (!cardVisualizationId) {
                    // Ensure unconfigured cards are hidden when another card is maximized
                    if (this.maximizedVisualizationId) {
                        card.classList.add('lt-card--hidden')
                    } else {
                        card.classList.remove('lt-card--hidden')
                    }
                    return
                }

                // Only the card carrying the maximized visualization should be maximized
                if (
                    this.maximizedVisualizationId &&
                    cardVisualizationId === this.maximizedVisualizationId
                ) {
                    card.classList.add('lt-card--maximized')
                    card.classList.remove('lt-card--hidden')
                } else {
                    card.classList.remove('lt-card--maximized')
                    if (this.maximizedVisualizationId) {
                        card.classList.add('lt-card--hidden')
                    } else {
                        card.classList.remove('lt-card--hidden')
                    }
                }
            })
        }

        // Re-render the affected visualization to fit its new size
        const affectedId = maximize ? visualizationId : previousMaximized
        if (affectedId) {
            const viz = visualizations.get(affectedId)
            if (viz) {
                const dataPoints = this.getDataPoints(viz.propertyId, viz.propertyDisplayName)
                // Skip update for overlays (they return empty array from getDataPoints)
                if (dataPoints.length > 0) {
                    viz.visualization.update(dataPoints)
                }
            }
        }
    }

    /**
     * Clean up maximize state and handlers
     */
    cleanup(): void {
        if (this.escapeHandler) {
            activeDocument.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }
        this.maximizedVisualizationId = null
        this.containerEl.classList.remove('lt-container--has-maximized')
    }
}
