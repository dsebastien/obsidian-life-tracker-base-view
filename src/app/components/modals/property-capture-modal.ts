import { Modal, Notice, type TFile } from 'obsidian'
import confetti from 'canvas-confetti'
import type { LifeTrackerPlugin } from '../../plugin'
import type { CaptureContext } from '../../commands/capture-command'
import {
    BATCH_FILTER_MODE_OPTIONS,
    DEFAULT_BATCH_FILTER_MODE,
    type PropertyDefinition,
    type PropertyEditor,
    type BatchFilterMode
} from '../../types'
import { FrontmatterService } from '../../services/frontmatter.service'
import { PropertyRecognitionService } from '../../services/property-recognition.service'
import { createPropertyEditor } from '../editing/property-editor'
import { formatFileTitleWithWeekday } from '../../../utils'

/** Debounce delay for auto-save in milliseconds */
const AUTO_SAVE_DEBOUNCE_MS = 500

/**
 * Modal for capturing/editing property values in a carousel-style interface.
 * Shows one property at a time with smooth navigation and progress tracking.
 * Values are auto-saved with debounce as they change.
 * Supports batch mode for processing multiple files.
 */
export class PropertyCaptureModal extends Modal {
    private plugin: LifeTrackerPlugin
    private context: CaptureContext
    private frontmatterService: FrontmatterService
    private recognitionService: PropertyRecognitionService

    // Property data
    private sortedDefinitions: PropertyDefinition[] = []
    private currentPropertyIndex: number = 0
    private savedValues: Record<string, unknown> = {}
    private currentValue: unknown = undefined
    private currentEditor: PropertyEditor | null = null

    // Batch mode: current file index
    private currentFileIndex: number = 0

    // Local filter mode (initialized from context, can be changed in modal)
    private filterMode: BatchFilterMode = DEFAULT_BATCH_FILTER_MODE

    // Track which properties have been filled
    private filledProperties: Set<string> = new Set()

    // Debounce timer for auto-save
    private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

    // DOM elements (named to avoid shadowing Modal's containerEl)
    private wrapperEl: HTMLElement | null = null
    private fileNavEl: HTMLElement | null = null
    private progressEl: HTMLElement | null = null
    private cardEl: HTMLElement | null = null

    constructor(plugin: LifeTrackerPlugin, context: CaptureContext) {
        super(plugin.app)
        this.plugin = plugin
        this.context = context
        this.currentFileIndex = context.currentIndex ?? 0
        this.filterMode = context.filterMode ?? DEFAULT_BATCH_FILTER_MODE
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
     * Load and sort property definitions for the current file.
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

        // Reset filled properties tracking for new file
        this.filledProperties.clear()

        // Mark properties that already have values as filled
        for (const def of this.sortedDefinitions) {
            const value = this.savedValues[def.name]
            if (value !== undefined && value !== null && value !== '') {
                this.filledProperties.add(def.name)
            }
        }

        // Start at first property
        this.currentPropertyIndex = 0
        const firstDef = this.sortedDefinitions[0]
        this.currentValue = firstDef ? this.savedValues[firstDef.name] : undefined
    }

    private getCurrentFile(): TFile | undefined {
        if (this.context.mode === 'single-note') {
            return this.context.file
        }
        if (this.context.mode === 'batch' && this.context.files) {
            return this.context.files[this.currentFileIndex]
        }
        return undefined
    }

    private getTotalFiles(): number {
        if (this.context.mode === 'batch' && this.context.files) {
            return this.context.files.length
        }
        return 1
    }

    private isFirstFile(): boolean {
        return this.currentFileIndex === 0
    }

    private isLastFile(): boolean {
        if (this.context.mode === 'batch' && this.context.files) {
            return this.currentFileIndex >= this.context.files.length - 1
        }
        return true
    }

    /**
     * Check if a file at a given index is complete based on the filter mode.
     * Returns true if the file should be skipped (all relevant properties are filled).
     */
    private isFileComplete(fileIndex: number): boolean {
        if (this.context.mode !== 'batch' || !this.context.files) return false

        if (this.filterMode === 'never') return false

        const file = this.context.files[fileIndex]
        if (!file) return false

        const allDefinitions = this.plugin.settings.propertyDefinitions
        const applicableDefinitions = this.recognitionService.getApplicableProperties(
            file,
            allDefinitions
        )

        if (applicableDefinitions.length === 0) return false

        const frontmatter = this.frontmatterService.read(file)

        if (this.filterMode === 'required') {
            // Check if all required properties are filled
            const requiredDefs = applicableDefinitions.filter((d) => d.required)
            if (requiredDefs.length === 0) return false

            return requiredDefs.every((def) => {
                const value = frontmatter[def.name]
                return value !== undefined && value !== null && value !== ''
            })
        } else if (this.filterMode === 'all') {
            // Check if all properties are filled
            return applicableDefinitions.every((def) => {
                const value = frontmatter[def.name]
                return value !== undefined && value !== null && value !== ''
            })
        }

        return false
    }

    /**
     * Find the next incomplete file index (wrapping around).
     * Returns -1 if all files are complete.
     */
    private findNextIncompleteFile(startIndex: number, direction: 1 | -1): number {
        const totalFiles = this.getTotalFiles()
        let index = startIndex
        let checked = 0

        while (checked < totalFiles) {
            if (!this.isFileComplete(index)) {
                return index
            }
            // Move to next/prev with wrap
            index =
                direction === 1 ? (index + 1) % totalFiles : (index - 1 + totalFiles) % totalFiles
            checked++
        }

        // All files are complete
        return -1
    }

    private getCurrentDefinition(): PropertyDefinition | undefined {
        return this.sortedDefinitions[this.currentPropertyIndex]
    }

    private isFirstProperty(): boolean {
        return this.currentPropertyIndex === 0
    }

    private isLastProperty(): boolean {
        return this.currentPropertyIndex === this.sortedDefinitions.length - 1
    }

    private render(): void {
        const { contentEl } = this
        contentEl.empty()

        // Main container
        this.wrapperEl = contentEl.createDiv({ cls: 'lt-carousel-container' })

        // File navigation (batch mode only)
        if (this.context.mode === 'batch') {
            this.fileNavEl = this.wrapperEl.createDiv({ cls: 'lt-carousel-file-nav' })
            this.renderFileNav()
        }

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

    private renderFileNav(): void {
        if (!this.fileNavEl) return
        this.fileNavEl.empty()

        // Top row: navigation
        const navRow = this.fileNavEl.createDiv({ cls: 'lt-carousel-file-nav-row' })

        // Previous file button (wraps around)
        const prevBtn = navRow.createEl('button', {
            cls: 'lt-carousel-file-nav-btn',
            attr: { 'aria-label': 'Previous file' }
        })
        prevBtn.innerHTML =
            '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>'
        prevBtn.addEventListener('click', () => this.navigatePrevFile())

        // File counter container
        const counterContainer = navRow.createDiv({ cls: 'lt-carousel-file-counter' })

        // When filter is active, show position among incomplete files
        // When filter is 'never', show position among all files
        if (this.filterMode !== 'never') {
            const incompleteCount = this.countIncompleteFiles()
            const positionAmongIncomplete = this.getPositionAmongIncomplete()

            counterContainer.createSpan({
                cls: 'lt-carousel-file-position',
                text: `(${positionAmongIncomplete}/${incompleteCount})`
            })

            counterContainer.createSpan({
                cls: 'lt-carousel-file-remaining',
                text: `${incompleteCount} remaining`
            })
        } else {
            counterContainer.createSpan({
                cls: 'lt-carousel-file-position',
                text: `(${this.currentFileIndex + 1}/${this.getTotalFiles()})`
            })
        }

        // Next file button (wraps around)
        const nextBtn = navRow.createEl('button', {
            cls: 'lt-carousel-file-nav-btn',
            attr: { 'aria-label': 'Next file' }
        })
        nextBtn.innerHTML =
            '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>'
        nextBtn.addEventListener('click', () => this.navigateNextFile())

        // Bottom row: filter dropdown
        const filterRow = this.fileNavEl.createDiv({ cls: 'lt-carousel-filter-row' })

        filterRow.createSpan({
            cls: 'lt-carousel-filter-label',
            text: 'Skip notes when:'
        })

        const selectEl = filterRow.createEl('select', {
            cls: 'lt-carousel-filter-select dropdown'
        })

        // Add options
        for (const [value, label] of Object.entries(BATCH_FILTER_MODE_OPTIONS)) {
            const option = selectEl.createEl('option', {
                value,
                text: label
            })
            if (value === this.filterMode) {
                option.selected = true
            }
        }

        // Handle filter mode change
        selectEl.addEventListener('change', () => {
            this.filterMode = selectEl.value as BatchFilterMode
            this.handleFilterModeChange()
        })
    }

    /**
     * Count the number of incomplete files
     */
    private countIncompleteFiles(): number {
        const totalFiles = this.getTotalFiles()
        let count = 0
        for (let i = 0; i < totalFiles; i++) {
            if (!this.isFileComplete(i)) count++
        }
        return count
    }

    /**
     * Get the 1-based position of the current file among incomplete files.
     * For example, if files 0, 2, 5 are incomplete and current is 2, returns 2.
     */
    private getPositionAmongIncomplete(): number {
        let position = 0
        for (let i = 0; i <= this.currentFileIndex; i++) {
            if (!this.isFileComplete(i)) position++
        }
        return position
    }

    /**
     * Handle filter mode change from dropdown.
     * Always navigates to the first incomplete file in the newly filtered list.
     */
    private async handleFilterModeChange(): Promise<void> {
        // Check if all files are now complete
        const incompleteCount = this.countIncompleteFiles()

        if (incompleteCount === 0) {
            // All files are complete - show message and close
            this.handleAllFilesComplete()
            return
        }

        // Always navigate to the first incomplete file when filter changes
        const firstIncompleteIndex = this.findNextIncompleteFile(0, 1)
        if (firstIncompleteIndex !== -1) {
            this.currentFileIndex = firstIncompleteIndex
            await this.loadProperties()

            if (this.sortedDefinitions.length === 0) {
                this.renderEmptyState()
                return
            }

            this.render()
        }
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
            text: `${this.currentPropertyIndex + 1} / ${this.sortedDefinitions.length}`
        })

        // Next button (or Done/Next File on last property)
        const isLast = this.isLastProperty()
        const isBatchMode = this.context.mode === 'batch'
        const nextBtn = navRow.createEl('button', {
            cls: isLast ? 'lt-carousel-nav-btn lt-carousel-nav-btn--done' : 'lt-carousel-nav-btn',
            attr: {
                'aria-label': isLast ? (isBatchMode ? 'Next file' : 'Done') : 'Next property'
            }
        })

        if (isLast) {
            if (isBatchMode) {
                // In batch mode, always show "Next File" arrow (wraps around)
                nextBtn.innerHTML =
                    '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5.59 7.41L10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z"/></svg>'
                nextBtn.addEventListener('click', () => this.handleNextFile())
            } else {
                // Single note mode: show checkmark for done
                nextBtn.innerHTML =
                    '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
                nextBtn.addEventListener('click', () => this.handleDone())
            }
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
                // Immediate save on blur
                this.saveCurrentPropertyImmediate()
            },
            onEnterKey: () => {
                // Validate and navigate to next field (like pressing Next button)
                this.validateAndNavigateNext()
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

        // In batch mode, show navigation to skip to next file (wraps around)
        if (this.context.mode === 'batch') {
            const nextBtn = emptyEl.createEl('button', {
                cls: 'lt-carousel-btn lt-carousel-btn--primary',
                text: 'Next File'
            })
            nextBtn.addEventListener('click', () => this.handleNextFile())
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

        this.currentPropertyIndex--
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

        this.currentPropertyIndex++
        const newDef = this.getCurrentDefinition()
        this.currentValue = this.savedValues[newDef?.name ?? '']

        this.renderCard()
    }

    /**
     * Validate the current field and navigate to next if valid.
     * Called when user presses Enter in an editor.
     */
    private validateAndNavigateNext(): void {
        if (!this.currentEditor) return

        // Validate the current value
        const validation = this.currentEditor.validate()

        if (!validation.valid) {
            // Show validation error
            new Notice(validation.error ?? 'Invalid value')
            return
        }

        // Save immediately before navigating
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
        }
        this.saveCurrentPropertyImmediate()

        // Navigate based on position
        if (this.isLastProperty()) {
            // On last property - behave like the Next/Done button
            if (this.context.mode === 'batch') {
                this.handleNextFile()
            } else {
                this.handleDone()
            }
        } else {
            // Not on last property - go to next field
            const currentDef = this.getCurrentDefinition()
            if (currentDef) {
                this.savedValues[currentDef.name] = this.currentValue
            }

            this.currentPropertyIndex++
            const newDef = this.getCurrentDefinition()
            this.currentValue = this.savedValues[newDef?.name ?? '']

            this.renderCard()
        }
    }

    /**
     * Navigate to previous file (batch mode, wraps around, skips complete files)
     */
    private async navigatePrevFile(): Promise<void> {
        // Save current property
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Start from previous file (wrap around)
        const startIndex = this.isFirstFile() ? this.getTotalFiles() - 1 : this.currentFileIndex - 1

        // Find next incomplete file going backwards
        const nextIndex = this.findNextIncompleteFile(startIndex, -1)

        if (nextIndex === -1) {
            // All files are complete
            this.handleAllFilesComplete()
            return
        }

        this.currentFileIndex = nextIndex
        await this.loadProperties()

        // Check if new file has no applicable properties
        if (this.sortedDefinitions.length === 0) {
            this.renderEmptyState()
            return
        }

        this.render()
    }

    /**
     * Navigate to next file (batch mode, wraps around, skips complete files)
     */
    private async navigateNextFile(): Promise<void> {
        // Save current property
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Start from next file (wrap around)
        const startIndex = this.isLastFile() ? 0 : this.currentFileIndex + 1

        // Find next incomplete file going forwards
        const nextIndex = this.findNextIncompleteFile(startIndex, 1)

        if (nextIndex === -1) {
            // All files are complete
            this.handleAllFilesComplete()
            return
        }

        this.currentFileIndex = nextIndex
        await this.loadProperties()

        // Check if new file has no applicable properties
        if (this.sortedDefinitions.length === 0) {
            this.renderEmptyState()
            return
        }

        this.render()
    }

    /**
     * Handle "Next File" button on last property (batch mode, wraps around, skips complete files)
     */
    private async handleNextFile(): Promise<void> {
        // Save current property
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer)
            this.saveCurrentPropertyImmediate()
        }

        // Show mini confetti for file completion
        if (this.plugin.settings.showConfettiOnCapture) {
            this.showMiniConfetti()
        }

        // Start from next file (wrap around)
        const startIndex = this.isLastFile() ? 0 : this.currentFileIndex + 1

        // Find next incomplete file going forwards
        const nextIndex = this.findNextIncompleteFile(startIndex, 1)

        if (nextIndex === -1) {
            // All files are complete - we're done!
            this.handleAllFilesComplete()
            return
        }

        this.currentFileIndex = nextIndex
        await this.loadProperties()

        // Check if new file has no applicable properties
        if (this.sortedDefinitions.length === 0) {
            this.renderEmptyState()
            return
        }

        this.render()
    }

    /**
     * Handle when all files in the batch are complete
     */
    private handleAllFilesComplete(): void {
        // Show confetti if enabled
        if (this.plugin.settings.showConfettiOnCapture) {
            this.showConfetti()
        }

        new Notice(`All ${this.getTotalFiles()} files are complete!`)

        // Close after a short delay
        setTimeout(() => {
            this.close()
        }, 600)
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

        const message =
            this.context.mode === 'batch'
                ? `All ${this.getTotalFiles()} files processed!`
                : 'Properties saved!'

        new Notice(message)

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

    /**
     * Smaller confetti burst for file completion (batch mode)
     */
    private showMiniConfetti(): void {
        const modalRect = this.contentEl.getBoundingClientRect()
        const originX = (modalRect.left + modalRect.width / 2) / window.innerWidth
        const originY = (modalRect.top + modalRect.height / 2) / window.innerHeight

        confetti({
            particleCount: 30,
            spread: 50,
            origin: { x: originX, y: originY },
            colors: ['#4ecdc4', '#45b7d1', '#96ceb4'],
            ticks: 100,
            gravity: 1.5,
            scalar: 0.8,
            zIndex: 10000
        })
    }

    private destroyEditor(): void {
        if (this.currentEditor) {
            this.currentEditor.destroy()
            this.currentEditor = null
        }
    }
}
