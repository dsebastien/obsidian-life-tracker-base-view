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
 */
export class MaximizeStateService {
    private maximizedPropertyId: BasesPropertyId | null = null
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null

    constructor(
        private containerEl: HTMLElement,
        private getGridEl: () => HTMLElement | null,
        private getVisualizations: () => Map<string, VisualizationEntry>,
        private getDataPoints: GetDataPointsCallback
    ) {}

    /**
     * Get the currently maximized property ID
     */
    getMaximizedPropertyId(): BasesPropertyId | null {
        return this.maximizedPropertyId
    }

    /**
     * Check if a property is currently maximized
     */
    isMaximized(propertyId: BasesPropertyId): boolean {
        return this.maximizedPropertyId === propertyId
    }

    /**
     * Toggle maximize state for a property
     */
    handleMaximizeToggle(propertyId: BasesPropertyId, maximize: boolean): void {
        const previousMaximized = this.maximizedPropertyId

        // Clean up any existing escape handler first
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }

        if (maximize) {
            this.maximizedPropertyId = propertyId

            // Add escape key handler - use arrow function that reads current state
            this.escapeHandler = (e: KeyboardEvent): void => {
                if (e.key === 'Escape' && this.maximizedPropertyId) {
                    e.preventDefault()
                    e.stopPropagation()
                    this.handleMaximizeToggle(this.maximizedPropertyId, false)
                }
            }
            document.addEventListener('keydown', this.escapeHandler)

            // Add maximized class to container
            this.containerEl.classList.add('lt-container--has-maximized')
        } else {
            this.maximizedPropertyId = null

            // Remove maximized class from container
            this.containerEl.classList.remove('lt-container--has-maximized')
        }

        // Update visualization states
        const visualizations = this.getVisualizations()
        for (const viz of visualizations.values()) {
            const isMaximized = viz.propertyId === this.maximizedPropertyId
            viz.visualization.setMaximized(isMaximized)
        }

        // Update card classes
        const gridEl = this.getGridEl()
        if (gridEl) {
            const cards = gridEl.querySelectorAll(CSS_SELECTOR.CARD)
            cards.forEach((card) => {
                const cardPropertyId = card.getAttribute(DATA_ATTR_FULL.PROPERTY_ID)

                // Skip unconfigured cards (those without data-property-id) - they never participate in maximize state
                if (!cardPropertyId) {
                    // Ensure unconfigured cards are hidden when another card is maximized
                    if (this.maximizedPropertyId) {
                        card.classList.add('lt-card--hidden')
                    } else {
                        card.classList.remove('lt-card--hidden')
                    }
                    return
                }

                // Only configured cards with matching propertyId should be maximized
                if (this.maximizedPropertyId && cardPropertyId === this.maximizedPropertyId) {
                    card.classList.add('lt-card--maximized')
                    card.classList.remove('lt-card--hidden')
                } else {
                    card.classList.remove('lt-card--maximized')
                    if (this.maximizedPropertyId) {
                        card.classList.add('lt-card--hidden')
                    } else {
                        card.classList.remove('lt-card--hidden')
                    }
                }
            })
        }

        // Re-render the maximized visualization(s) to fit new size
        if (maximize) {
            for (const viz of visualizations.values()) {
                if (viz.propertyId === propertyId) {
                    const dataPoints = this.getDataPoints(propertyId, viz.propertyDisplayName)
                    // Skip update for overlays (they return empty array from getDataPoints)
                    if (dataPoints.length > 0) {
                        viz.visualization.update(dataPoints)
                    }
                }
            }
        } else if (previousMaximized) {
            // Re-render the previously maximized visualization(s)
            for (const viz of visualizations.values()) {
                if (viz.propertyId === previousMaximized) {
                    const dataPoints = this.getDataPoints(
                        previousMaximized,
                        viz.propertyDisplayName
                    )
                    // Skip update for overlays (they return empty array from getDataPoints)
                    if (dataPoints.length > 0) {
                        viz.visualization.update(dataPoints)
                    }
                }
            }
        }
    }

    /**
     * Clean up maximize state and handlers
     */
    cleanup(): void {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }
        this.maximizedPropertyId = null
        this.containerEl.classList.remove('lt-container--has-maximized')
    }
}
