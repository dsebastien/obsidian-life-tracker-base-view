import { setIcon, type App, type BasesEntry, type BasesPropertyId } from 'obsidian'
import type {
    VisualizationConfig,
    VisualizationDataPoint
} from '../../app/types/visualization.types'

/**
 * Callback for maximize toggle
 */
export type MaximizeCallback = (propertyId: BasesPropertyId, maximize: boolean) => void

/**
 * Abstract base class for all visualization components
 */
export abstract class BaseVisualization {
    protected containerEl: HTMLElement
    protected app: App
    protected propertyId: BasesPropertyId
    protected displayName: string
    protected config: VisualizationConfig
    protected onMaximizeToggle: MaximizeCallback | null = null
    protected isMaximized: boolean = false
    protected maximizeBtn: HTMLElement | null = null

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: VisualizationConfig
    ) {
        this.containerEl = containerEl
        this.app = app
        this.propertyId = propertyId
        this.displayName = displayName
        this.config = config
    }

    /**
     * Set the maximize toggle callback
     */
    setMaximizeCallback(callback: MaximizeCallback): void {
        this.onMaximizeToggle = callback
    }

    /**
     * Set maximized state and update the button icon
     */
    setMaximized(maximized: boolean): void {
        this.isMaximized = maximized
        this.updateMaximizeButtonIcon()
    }

    /**
     * Update the maximize button icon based on current state
     */
    protected updateMaximizeButtonIcon(): void {
        if (this.maximizeBtn) {
            setIcon(this.maximizeBtn, this.isMaximized ? 'minimize-2' : 'maximize-2')
            this.maximizeBtn.setAttribute('aria-label', this.isMaximized ? 'Minimize' : 'Maximize')
        }
    }

    /**
     * Render the visualization with data
     */
    abstract render(data: VisualizationDataPoint[]): void

    /**
     * Update the visualization with new data
     */
    abstract update(data: VisualizationDataPoint[]): void

    /**
     * Clean up resources
     */
    abstract destroy(): void

    /**
     * Show empty state when no data available
     */
    protected showEmptyState(message?: string): void {
        this.containerEl.empty()
        const emptyEl = this.containerEl.createDiv({ cls: 'lt-empty' })

        emptyEl.createDiv({ cls: 'lt-empty-icon', text: '📊' })
        emptyEl.createDiv({
            cls: 'lt-empty-text',
            text: message ?? `No data available for "${this.displayName}"`
        })
    }

    /**
     * Show loading state
     */
    protected showLoading(): void {
        this.containerEl.empty()
        const loadingEl = this.containerEl.createDiv({ cls: 'lt-loading' })
        loadingEl.createDiv({ cls: 'lt-loading-spinner' })
    }

    /**
     * Create section header with maximize button
     */
    protected createSectionHeader(title: string): HTMLElement {
        const header = this.containerEl.createDiv({ cls: 'lt-section-header' })
        header.createDiv({ cls: 'lt-section-title', text: title })

        // Add maximize button
        const actionsEl = header.createDiv({ cls: 'lt-section-actions' })
        this.maximizeBtn = actionsEl.createDiv({
            cls: 'lt-maximize-btn',
            attr: {
                'role': 'button',
                'tabindex': '0',
                'aria-label': this.isMaximized ? 'Minimize' : 'Maximize'
            }
        })

        // Set icon based on state
        setIcon(this.maximizeBtn, this.isMaximized ? 'minimize-2' : 'maximize-2')

        // Click handler - use arrow function to preserve this context
        this.maximizeBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.triggerMaximizeToggle()
        })

        // Keyboard handler
        this.maximizeBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                this.triggerMaximizeToggle()
            }
        })

        return header
    }

    /**
     * Trigger maximize toggle with current state
     */
    protected triggerMaximizeToggle(): void {
        if (this.onMaximizeToggle) {
            this.onMaximizeToggle(this.propertyId, !this.isMaximized)
        }
    }

    /**
     * Open file in workspace
     */
    protected openFile(entry: BasesEntry, newLeaf = false): void {
        void this.app.workspace.openLinkText(entry.file.path, '', newLeaf)
    }

    /**
     * Open multiple files (first one, or show selection)
     */
    protected openEntries(entries: BasesEntry[]): void {
        const first = entries[0]
        if (first) {
            this.openFile(first)
        }
    }
}
