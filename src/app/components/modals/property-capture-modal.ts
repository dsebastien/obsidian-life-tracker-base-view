import { Modal, Notice, type TFile } from 'obsidian'
import confetti from 'canvas-confetti'
import type { LifeTrackerPlugin } from '../../plugin'
import type { CaptureContext } from '../../commands/capture-command'
import type { PropertyDefinition } from '../../types/property-definition.types'
import { FrontmatterService } from '../../services/frontmatter.service'
import { PropertyRecognitionService } from '../../services/property-recognition.service'
import { createPropertyEditor, type PropertyEditor } from '../editing/property-editor'
import { formatFileTitleWithWeekday } from '../../../utils/date-utils'

/** Debounce delay for auto-save in milliseconds */
const AUTO_SAVE_DEBOUNCE_MS = 500

/**
 * Modal for capturing/editing property values in a carousel-style interface.
 * Shows one property at a time with smooth navigation and progress tracking.
 * Values are auto-saved with debounce as they change.
 */
export class PropertyCaptureModal extends Modal {
    private plugin: LifeTrackerPlugin
    private context: CaptureContext
    private frontmatterService: FrontmatterService
    private recognitionService: PropertyRecognitionService

    // Property data
    private sortedDefinitions: PropertyDefinition[] = []
    private currentIndex: number = 0
    private savedValues: Record<string, unknown> = {}
    private currentValue: unknown = undefined
    private currentEditor: PropertyEditor | null = null

    // Track which properties have been filled
    private filledProperties: Set<string> = new Set()

    // Debounce timer for auto-save
    private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

    // DOM elements (named to avoid shadowing Modal's containerEl)
    private wrapperEl: HTMLElement | null = null
    private progressEl: HTMLElement | null = null
    private cardEl: HTMLElement | null = null

    constructor(plugin: LifeTrackerPlugin, context: CaptureContext) {
        super(plugin.app)
        this.plugin = plugin
        this.context = context
        this.frontmatterService = new FrontmatterService(plugin.app)
        this.recognitionService = new PropertyRecognitionService(plugin.app)
    }

    override async onOpen(): Promise<void> {
        const { contentEl } = this
        contentEl.empty()
        contentEl.addClass('lt-carousel-modal')

        await this.loadProperties()

        if (this.sortedDefinitions.length === 0) {
            this.renderEmptyState()
            return
        }

        this.render()
    }

    override onClose(): void {
        // Clear any pending save
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            // Perform immediate save of any pending changes
            this.saveCurrentPropertyImmediate()
        }
        this.destroyEditor()
        this.contentEl.empty()
    }

    /**
     * Load and sort property definitions.
     * Sort order: required (alphabetical), then optional (alphabetical)
     */
    private async loadProperties(): Promise<void> {
        const file = this.getCurrentFile()
        if (!file) return

        const allDefinitions = this.plugin.settings.propertyDefinitions

        // Filter to only applicable definitions for this file
        const applicableDefinitions = this.recognitionService.getApplicableProperties(
            file,
            allDefinitions
        )

        // Sort: required first (alphabetical), then optional (alphabetical)
        this.sortedDefinitions = [...applicableDefinitions].sort((a, b) => {
            // Required properties first
            if (a.required && !b.required) return -1
            if (!a.required && b.required) return 1
            // Then alphabetical by display name or name
            const nameA = (a.displayName || a.name).toLowerCase()
            const nameB = (b.displayName || b.name).toLowerCase()
            return nameA.localeCompare(nameB)
        })

        // Load existing values from frontmatter (synchronous - uses metadata cache)
        this.savedValues = this.frontmatterService.readDefinedProperties(
            file,
            this.sortedDefinitions
        )

        // Mark properties that already have values as filled
        for (const def of this.sortedDefinitions) {
            const value = this.savedValues[def.name]
            if (value !== undefined && value !== null && value !== '') {
                this.filledProperties.add(def.name)
            }
        }

        // Start at first property
        this.currentIndex = 0
        const firstDef = this.sortedDefinitions[0]
        this.currentValue = firstDef ? this.savedValues[firstDef.name] : undefined
    }

    private getCurrentFile(): TFile | undefined {
        if (this.context.mode === 'single-note') {
            return this.context.file
        }
        if (this.context.mode === 'batch' && this.context.files) {
            return this.context.files[this.context.currentIndex ?? 0]
        }
        return undefined
    }

    private getCurrentDefinition(): PropertyDefinition | undefined {
        return this.sortedDefinitions[this.currentIndex]
    }

    private isFirstProperty(): boolean {
        return this.currentIndex === 0
    }

    private isLastProperty(): boolean {
        return this.currentIndex === this.sortedDefinitions.length - 1
    }

    private render(): void {
        const { contentEl } = this
        contentEl.empty()

        // Main container
        this.wrapperEl = contentEl.createDiv({ cls: 'lt-carousel-container' })

        // File name header (with weekday for YYYY-MM-DD format)
        const file = this.getCurrentFile()
        const title = file ? formatFileTitleWithWeekday(file.basename) : 'Unknown'
        this.wrapperEl.createDiv({
            cls: 'lt-carousel-file-name',
            text: title
        })

        // Property card (main content area)
        this.cardEl = this.wrapperEl.createDiv({ cls: 'lt-carousel-card' })
        this.renderCard()

        // Progress bar at bottom
        this.progressEl = this.wrapperEl.createDiv({ cls: 'lt-carousel-progress' })
        this.renderProgress()
    }

    private renderCard(): void {
        if (!this.cardEl) return
        this.cardEl.empty()
        this.destroyEditor()

        const definition = this.getCurrentDefinition()
        if (!definition) return

        // Navigation arrows
        const navRow = this.cardEl.createDiv({ cls: 'lt-carousel-nav' })

        // Previous button
        const prevBtn = navRow.createEl('button', {
            cls: 'lt-carousel-nav-btn',
            attr: { 'aria-label': 'Previous property' }
        })
        prevBtn.innerHTML =
            '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>'
        prevBtn.disabled = this.isFirstProperty()
        prevBtn.addEventListener('click', () => this.navigatePrev())

        // Property counter
        navRow.createSpan({
            cls: 'lt-carousel-counter',
            text: `${this.currentIndex + 1} / ${this.sortedDefinitions.length}`
        })

        // Next button (or Done on last property)
        const nextBtn = navRow.createEl('button', {
            cls: this.isLastProperty()
                ? 'lt-carousel-nav-btn lt-carousel-nav-btn--done'
                : 'lt-carousel-nav-btn',
            attr: { 'aria-label': this.isLastProperty() ? 'Done' : 'Next property' }
        })

        if (this.isLastProperty()) {
            nextBtn.innerHTML =
                '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
            nextBtn.addEventListener('click', () => this.handleDone())
        } else {
            nextBtn.innerHTML =
                '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>'
            nextBtn.addEventListener('click', () => this.navigateNext())
        }

        // Property name with required indicator
        const labelRow = this.cardEl.createDiv({ cls: 'lt-carousel-label' })
        labelRow.createSpan({
            cls: 'lt-carousel-property-name',
            text: definition.displayName || definition.name
        })
        if (definition.required) {
            labelRow.createSpan({
                cls: 'lt-carousel-required-badge',
                text: 'Required'
            })
        } else {
            labelRow.createSpan({
                cls: 'lt-carousel-optional-badge',
                text: 'Optional'
            })
        }

        // Description
        if (definition.description) {
            this.cardEl.createDiv({
                cls: 'lt-carousel-description',
                text: definition.description
            })
        }

        // Editor container
        const editorContainer = this.cardEl.createDiv({ cls: 'lt-carousel-editor' })

        // Get current value (from saved or current editing)
        const value = this.currentValue ?? this.savedValues[definition.name]

        this.currentEditor = createPropertyEditor({
            definition,
            value,
            onChange: (newValue) => {
                this.currentValue = newValue
                // Debounced auto-save
                this.debouncedSave()
            },
            onCommit: () => {
                // Immediate save on commit (e.g., Enter key)
                this.saveCurrentPropertyImmediate()
            }
        })

        this.currentEditor.render(editorContainer)

        // Focus the editor
        setTimeout(() => {
            this.currentEditor?.focus()
        }, 50)
    }

    private renderProgress(): void {
        if (!this.progressEl) return
        this.progressEl.empty()

        const total = this.sortedDefinitions.length
        const filled = this.filledProperties.size
        const percentage = total > 0 ? Math.round((filled / total) * 100) : 0

        // Progress bar
        const barContainer = this.progressEl.createDiv({ cls: 'lt-carousel-progress-bar' })
        const barFill = barContainer.createDiv({ cls: 'lt-carousel-progress-fill' })
        barFill.style.width = `${percentage}%`

        // Get progress emoji based on percentage
        const emoji = this.getProgressEmoji(percentage)

        // Progress text: "x/y (n% done! emoji)"
        this.progressEl.createDiv({
            cls: 'lt-carousel-progress-text',
            text: `${filled}/${total} (${percentage}% done! ${emoji})`
        })
    }

    /**
     * Get an emoji representing the progress level
     */
    private getProgressEmoji(percentage: number): string {
        if (percentage === 0) return '😱'
        if (percentage <= 20) return '😨'
        if (percentage <= 40) return '😭'
        if (percentage <= 60) return '🥹'
        if (percentage <= 80) return '🥳'
        return '🎉'
    }

    private renderEmptyState(): void {
        const { contentEl } = this
        contentEl.empty()

        const file = this.getCurrentFile()
        const allDefinitions = this.plugin.settings.propertyDefinitions

        const emptyEl = contentEl.createDiv({ cls: 'lt-carousel-empty' })

        if (allDefinitions.length === 0) {
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-icon',
                text: '📝'
            })
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-title',
                text: 'No Property Definitions'
            })
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-text',
                text: 'Add property definitions in Settings → Life Tracker → Property Definitions.'
            })
        } else {
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-icon',
                text: '🔍'
            })
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-title',
                text: 'No Matching Properties'
            })
            emptyEl.createDiv({
                cls: 'lt-carousel-empty-text',
                text: `No property definitions apply to "${file?.basename ?? 'this note'}". Check your note filtering settings.`
            })
        }

        const closeBtn = emptyEl.createEl('button', {
            cls: 'lt-carousel-btn lt-carousel-btn--secondary',
            text: 'Close'
        })
        closeBtn.addEventListener('click', () => this.close())
    }

    /**
     * Debounced save - waits for user to stop typing before saving
     */
    private debouncedSave(): void {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
        }
        this.saveDebounceTimer = setTimeout(() => {
            this.saveCurrentPropertyImmediate()
        }, AUTO_SAVE_DEBOUNCE_MS)
    }

    /**
     * Immediately save the current property value
     */
    private saveCurrentPropertyImmediate(): void {
        const file = this.getCurrentFile()
        const definition = this.getCurrentDefinition()
        if (!file || !definition) return

        // Update saved values with current value
        this.savedValues[definition.name] = this.currentValue

        // Update filled status
        const isFilled =
            this.currentValue !== undefined &&
            this.currentValue !== null &&
            this.currentValue !== ''

        if (isFilled) {
            this.filledProperties.add(definition.name)
        } else {
            this.filledProperties.delete(definition.name)
        }

        // Write to frontmatter (fire and forget, but log errors)
        this.frontmatterService
            .write(file, { [definition.name]: this.currentValue })
            .then(() => {
                this.renderProgress()
            })
            .catch((error) => {
                console.error('Failed to save property:', error)
            })
    }

    private navigatePrev(): void {
        if (this.isFirstProperty()) return

        // Ensure any pending save completes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Store current value before navigating
        const currentDef = this.getCurrentDefinition()
        if (currentDef) {
            this.savedValues[currentDef.name] = this.currentValue
        }

        this.currentIndex--
        const newDef = this.getCurrentDefinition()
        this.currentValue = this.savedValues[newDef?.name ?? '']

        this.renderCard()
    }

    private navigateNext(): void {
        if (this.isLastProperty()) return

        // Ensure any pending save completes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Store current value before navigating
        const currentDef = this.getCurrentDefinition()
        if (currentDef) {
            this.savedValues[currentDef.name] = this.currentValue
        }

        this.currentIndex++
        const newDef = this.getCurrentDefinition()
        this.currentValue = this.savedValues[newDef?.name ?? '']

        this.renderCard()
    }

    /**
     * Handle done button click - show confetti and close
     */
    private handleDone(): void {
        // Ensure any pending save completes
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Show confetti if enabled
        if (this.plugin.settings.showConfettiOnCapture) {
            this.showConfetti()
        }

        new Notice('Properties saved!')

        // Small delay to let confetti show before closing
        setTimeout(() => {
            this.close()
        }, 600)
    }

    private showConfetti(): void {
        // Get modal position for confetti origin
        const modalRect = this.contentEl.getBoundingClientRect()
        const originX = (modalRect.left + modalRect.width / 2) / window.innerWidth
        const originY = (modalRect.top + modalRect.height / 2) / window.innerHeight

        // Fire confetti from modal center
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { x: originX, y: originY },
            colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1.2,
            shapes: ['circle', 'square'],
            zIndex: 10000
        })

        // Second burst slightly delayed
        setTimeout(() => {
            confetti({
                particleCount: 50,
                spread: 100,
                origin: { x: originX, y: originY },
                colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
                ticks: 150,
                gravity: 1,
                scalar: 0.8,
                zIndex: 10000
            })
        }, 150)
    }

    private destroyEditor(): void {
        if (this.currentEditor) {
            this.currentEditor.destroy()
            this.currentEditor = null
        }
    }
}
