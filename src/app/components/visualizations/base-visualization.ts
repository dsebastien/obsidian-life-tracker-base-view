import { setIcon, type App, type BasesPropertyId } from 'obsidian'
import {
    computeCompletionStats,
    describeCompletionStats,
    formatCompletionStats
} from '../../services/completion.utils'
import type {
    ExportTable,
    VisualizationConfig,
    VisualizationDataPoint,
    VisualizationDateRange
} from '../../types'

/**
 * Callback for maximize toggle.
 *
 * Carries no identity: several visualizations can share one property, so the
 * wiring code closes over the visualization ID instead (issue #151).
 */
export type MaximizeCallback = (maximize: boolean) => void

/**
 * Animation state
 */
export type AnimationState = 'idle' | 'playing' | 'paused'

/**
 * Abstract base class for all visualization components
 */
/**
 * Default animation duration in milliseconds
 */
export const DEFAULT_ANIMATION_DURATION = 3000

export abstract class BaseVisualization {
    protected containerEl: HTMLElement
    protected app: App
    protected propertyId: BasesPropertyId
    protected displayName: string
    protected config: VisualizationConfig
    protected onMaximizeToggle: MaximizeCallback | null = null
    protected isMaximized: boolean = false
    protected maximizeBtn: HTMLElement | null = null
    protected playBtn: HTMLElement | null = null
    protected animationState: AnimationState = 'idle'
    protected animationDuration: number = DEFAULT_ANIMATION_DURATION
    /** Pin toggle callback and state (issue #123) */
    protected onPinToggle: (() => void) | null = null
    protected isPinned: boolean = false
    protected pinBtn: HTMLElement | null = null

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
     * Set animation duration in milliseconds
     */
    setAnimationDuration(duration: number): void {
        this.animationDuration = duration
    }

    /**
     * Wire the pin toggle (issue #123). The button only appears once a callback
     * is set, so visualizations rendered outside the grid stay unchanged.
     */
    setPinCallback(callback: () => void): void {
        this.onPinToggle = callback
    }

    /**
     * Set pinned state and update the button icon
     */
    setPinned(pinned: boolean): void {
        this.isPinned = pinned
        this.updatePinButtonIcon()
    }

    /**
     * Update the pin button icon and label based on current state
     */
    protected updatePinButtonIcon(): void {
        if (!this.pinBtn) return

        // Always the same outline star: CSS fills it gold when pinned, so the
        // control never changes shape or position between states
        setIcon(this.pinBtn, 'star')
        const label = this.isPinned ? 'Unpin from top' : 'Pin to top'
        this.pinBtn.setAttribute('aria-label', label)
        this.pinBtn.setAttribute('aria-pressed', String(this.isPinned))
        this.pinBtn.classList.toggle('lt-pin-btn--pinned', this.isPinned)
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
     * Check if this visualization supports animation
     * Subclasses should override this to return true if they support animation
     */
    supportsAnimation(): boolean {
        return false
    }

    /**
     * Get current animation state
     */
    getAnimationState(): AnimationState {
        return this.animationState
    }

    /**
     * Play the animation
     * Subclasses should override this to implement animation
     */
    playAnimation(): void {
        // Default implementation does nothing
    }

    /**
     * Stop/reset the animation
     * Subclasses should override this to implement animation stop
     */
    stopAnimation(): void {
        this.animationState = 'idle'
        this.updatePlayButtonIcon()
    }

    /**
     * Stop animation if one is currently playing
     */
    stopAnimationIfPlaying(): void {
        if (this.animationState === 'playing') {
            this.stopAnimation()
        }
    }

    /**
     * Update the play button icon based on animation state
     */
    protected updatePlayButtonIcon(): void {
        if (this.playBtn) {
            const icon = this.animationState === 'playing' ? 'square' : 'play'
            const label = this.animationState === 'playing' ? 'Stop animation' : 'Play animation'
            setIcon(this.playBtn, icon)
            this.playBtn.setAttribute('aria-label', label)

            // Update visual state
            if (this.animationState === 'playing') {
                this.playBtn.classList.add('lt-play-btn--playing')
            } else {
                this.playBtn.classList.remove('lt-play-btn--playing')
            }
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
     * Tell the visualization which date span the view currently covers,
     * regardless of which dates actually carry a value for this property
     * (issue #153). Time-based visualizations use it so their axis spans the
     * whole selected period instead of starting at the first logged value.
     * Subclasses that don't care ignore it.
     */
    setViewDateRange(_range: VisualizationDateRange | null): void {
        // Default implementation does nothing
    }

    /**
     * Handle container resize - subclasses should override to handle resize
     */
    handleResize(): void {
        // Default implementation does nothing
        // Subclasses should override this to handle resize (e.g., redraw charts)
    }

    /**
     * Tabular representation of what the visualization currently displays,
     * used for CSV export (issue #102). Subclasses override; null means
     * nothing is rendered yet.
     */
    getExportData(): ExportTable | null {
        return null
    }

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
     * Create section header with play and maximize buttons
     */
    protected createSectionHeader(title: string): HTMLElement {
        const header = this.containerEl.createDiv({ cls: 'lt-section-header' })
        header.createDiv({ cls: 'lt-section-title', text: title })

        // Add action buttons
        const actionsEl = header.createDiv({ cls: 'lt-section-actions' })

        // Pin button (issue #123), first so the play/maximize buttons keep
        // their positions across cards
        if (this.onPinToggle) {
            this.pinBtn = actionsEl.createDiv({
                cls: 'lt-pin-btn',
                attr: {
                    role: 'button',
                    tabindex: '0'
                }
            })
            this.updatePinButtonIcon()

            this.pinBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.handlePinButtonClick()
            })

            this.pinBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    this.handlePinButtonClick()
                }
            })
        }

        // Add play button if animation is supported
        if (this.supportsAnimation()) {
            this.playBtn = actionsEl.createDiv({
                cls: 'lt-play-btn',
                attr: {
                    'role': 'button',
                    'tabindex': '0',
                    'aria-label': 'Play animation'
                }
            })

            setIcon(this.playBtn, 'play')

            // Click handler
            this.playBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.handlePlayButtonClick()
            })

            // Keyboard handler
            this.playBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    this.handlePlayButtonClick()
                }
            })
        }

        // Add maximize button
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
     * Toggle the pin. The star flips immediately so the click feels answered;
     * the grid re-render that follows sets the authoritative state.
     */
    protected handlePinButtonClick(): void {
        this.setPinned(!this.isPinned)
        this.onPinToggle?.()
    }

    /**
     * Handle play button click
     */
    protected handlePlayButtonClick(): void {
        if (this.animationState === 'playing') {
            this.stopAnimation()
        } else {
            this.playAnimation()
        }
    }

    /**
     * Trigger maximize toggle with current state
     */
    protected triggerMaximizeToggle(): void {
        // Stop any ongoing animation before maximize/minimize
        this.stopAnimationIfPlaying()

        if (this.onMaximizeToggle) {
            this.onMaximizeToggle(!this.isMaximized)
        }
    }

    /**
     * Open file by path in workspace
     */
    protected openFileByPath(filePath: string, newLeaf = false): void {
        void this.app.workspace.openLinkText(filePath, '', newLeaf)
    }

    /**
     * Open first file from a list of file paths
     */
    protected openFilePaths(filePaths: string[]): void {
        const first = filePaths[0]
        if (first) {
            this.openFileByPath(first)
        }
    }

    /**
     * Render the completion chip for a checkbox property (issue #161), in the
     * slot the personal record occupies for every other type: a record over
     * booleans is always `true` and says nothing, while "42/90 (47%)"
     * describes the habit.
     *
     * Carries no judgement, so unlike a record it needs no polarity — it counts
     * entries rather than calling any of them best.
     *
     * Takes the period values the visualization renders — heatmap cells, or a
     * chart dataset — so the denominator is the periods on screen rather than
     * the days the property happened to be written down.
     *
     * Renders nothing when there are no periods at all: "0/0 (0%)" is noise,
     * not information.
     */
    protected renderCompletionInfo(
        periodValues: readonly (number | null)[],
        unit: string,
        rowEl: HTMLElement,
        itemCls: string
    ): void {
        const stats = computeCompletionStats(periodValues)
        if (stats.tracked === 0) return

        rowEl.createSpan({
            cls: `${itemCls} lt-completion-item`,
            text: formatCompletionStats(stats, unit),
            attr: { 'aria-label': describeCompletionStats(stats, unit) }
        })
    }
}
