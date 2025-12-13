import {
    BasesView,
    type BasesEntry,
    type QueryController,
    type TFile,
    type Value,
    BooleanValue,
    NumberValue,
    ListValue,
    NullValue
} from 'obsidian'
import type { LifeTrackerPlugin, FileProvider } from '../../plugin'
import type { BatchFilterMode } from '../../types/batch-filter-mode.intf'
import type { PropertyDefinition } from '../../types/property-definition.types'
import { FrontmatterService } from '../../services/frontmatter.service'
import { PropertyRecognitionService } from '../../services/property-recognition.service'
import { createPropertyEditor, type PropertyEditor } from '../../components/editing/property-editor'
import { log } from '../../../utils/log'
import { formatFileTitleWithWeekday } from '../../../utils/date-utils'

/**
 * View type identifier for Grid View
 */
export const GRID_VIEW_TYPE = 'life-tracker-grid'

/**
 * Grid View - Dense table-based editing for property values
 * Uses virtual scrolling for performance with large datasets
 */
export class GridView extends BasesView implements FileProvider {
    type = GRID_VIEW_TYPE

    private plugin: LifeTrackerPlugin
    private containerEl: HTMLElement
    private scrollEl: HTMLElement

    // Virtual scrolling elements
    private tableWrapperEl: HTMLElement | null = null
    private tableEl: HTMLTableElement | null = null
    private theadEl: HTMLTableSectionElement | null = null
    private tbodyEl: HTMLElement | null = null
    private spacerTopEl: HTMLElement | null = null
    private spacerBottomEl: HTMLElement | null = null

    // Fixed header elements for sticky behavior
    private fixedHeaderWrapperEl: HTMLElement | null = null
    private fixedHeaderTableEl: HTMLTableElement | null = null
    private isFixedHeaderVisible: boolean = false

    // Services (only used for writing, not reading)
    private frontmatterService: FrontmatterService
    private recognitionService: PropertyRecognitionService

    // Editor tracking: map of "filePath:propertyName" -> PropertyEditor
    private editors: Map<string, PropertyEditor> = new Map()

    // Current values per file
    private originalValues: Map<string, Record<string, unknown>> = new Map()
    private currentValues: Map<string, Record<string, unknown>> = new Map()

    // Currently active property definitions (filtered and sorted)
    private activeDefinitions: PropertyDefinition[] = []

    // Base-selected properties (not matching any property definition)
    private baseSelectedProperties: string[] = []

    // Debounce timers per file:property for auto-save
    private saveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

    // Cleanup function for settings listener
    private unsubscribeSettings: (() => void) | null = null

    // Virtual scrolling state
    private filteredEntries: BasesEntry[] = []
    private visibleStartIndex: number = 0
    private visibleEndIndex: number = 0
    private renderedRowIndices: Set<number> = new Set()
    private rowElements: Map<number, HTMLElement> = new Map()
    private scrollHandler: (() => void) | null = null
    private resizeObserver: ResizeObserver | null = null

    /** Debounce delay for auto-save in milliseconds */
    private static readonly AUTO_SAVE_DEBOUNCE_MS = 500

    /** Row height in pixels (must match CSS) */
    private static readonly ROW_HEIGHT = 32

    /** Number of rows to render above/below viewport as buffer */
    private static readonly BUFFER_ROWS = 5

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: LifeTrackerPlugin) {
        super(controller)

        this.plugin = plugin
        this.scrollEl = scrollEl
        this.containerEl = scrollEl.createDiv({ cls: 'lt-grid-view-container' })

        // Initialize services
        this.frontmatterService = new FrontmatterService(plugin.app)
        this.recognitionService = new PropertyRecognitionService(plugin.app)

        // Subscribe to global settings changes
        this.unsubscribeSettings = this.plugin.onSettingsChange(() => {
            log('Settings changed, refreshing grid view', 'debug')
            this.onDataUpdated()
        })

        // Register as active file provider for batch capture
        this.plugin.setActiveFileProvider(this)

        log('GridView created', 'debug')
    }

    /**
     * Get all files currently displayed in the grid (for batch capture)
     */
    getFiles(): TFile[] {
        // Return filtered entries' files (what's currently displayed)
        return this.filteredEntries.map((entry) => entry.file)
    }

    /**
     * Get the current filter mode for batch capture
     */
    getFilterMode(): BatchFilterMode {
        return (this.config.get('hideNotesWhen') as BatchFilterMode) ?? 'required'
    }

    /**
     * Extract primitive value from Bases Value type
     */
    private extractValue(value: Value | null): unknown {
        if (!value || value instanceof NullValue) return undefined

        if (value instanceof BooleanValue) {
            return value.isTruthy()
        }
        if (value instanceof NumberValue) {
            return parseFloat(value.toString())
        }
        if (value instanceof ListValue) {
            const items: string[] = []
            for (let i = 0; i < value.length(); i++) {
                const item = value.get(i)
                if (item) items.push(item.toString())
            }
            return items
        }

        // StringValue, DateValue, or other types
        return value.toString()
    }

    /**
     * Get values for an entry using Bases API (fast - data already loaded)
     */
    private getEntryValues(
        entry: BasesEntry,
        definitions: PropertyDefinition[]
    ): Record<string, unknown> {
        const values: Record<string, unknown> = {}
        for (const def of definitions) {
            // Bases uses "note.propertyName" format for frontmatter properties
            const propId = `note.${def.name}` as const
            const value = entry.getValue(propId)
            values[def.name] = this.extractValue(value)
        }
        return values
    }

    /**
     * Get base-selected property names that don't match any property definition
     */
    private getBaseSelectedProperties(definitionNames: Set<string>): string[] {
        const order = this.config.getOrder()
        const baseProps: string[] = []

        for (const propId of order) {
            // Extract property name from "note.propertyName" format
            if (propId.startsWith('note.')) {
                const propName = propId.slice(5) // Remove "note." prefix
                // Only include if not matching any property definition (case-insensitive)
                const isDefinition = [...definitionNames].some(
                    (defName) => defName.toLowerCase() === propName.toLowerCase()
                )
                if (!isDefinition) {
                    baseProps.push(propName)
                }
            }
        }

        return baseProps
    }

    /**
     * Get base-selected property values for an entry
     */
    private getBasePropertyValues(
        entry: BasesEntry,
        propertyNames: string[]
    ): Record<string, unknown> {
        const values: Record<string, unknown> = {}
        for (const propName of propertyNames) {
            const propId = `note.${propName}` as const
            const value = entry.getValue(propId)
            values[propName] = this.extractValue(value)
        }
        return values
    }

    /**
     * Sort definitions: required first (alphabetically), then optional (alphabetically)
     */
    private sortDefinitions(definitions: PropertyDefinition[]): PropertyDefinition[] {
        return [...definitions].sort((a, b) => {
            // Required properties first
            if (a.required && !b.required) return -1
            if (!a.required && b.required) return 1
            // Then alphabetical by display name or name
            const nameA = (a.displayName || a.name).toLowerCase()
            const nameB = (b.displayName || b.name).toLowerCase()
            return nameA.localeCompare(nameB)
        })
    }

    /**
     * Called when data changes - main render logic
     */
    override onDataUpdated(): void {
        log('GridView onDataUpdated', 'debug')

        // Clean up existing editors and timers
        this.destroyEditors()
        this.clearAllTimers()
        this.cleanupVirtualScrolling()
        this.containerEl.empty()
        this.originalValues.clear()
        this.currentValues.clear()
        this.filteredEntries = []
        this.rowElements.clear()
        this.renderedRowIndices.clear()
        // Reset visible range to force re-render
        this.visibleStartIndex = -1
        this.visibleEndIndex = -1

        const entries = this.data.data
        const allDefinitions = this.plugin.settings.propertyDefinitions

        if (allDefinitions.length === 0) {
            this.renderEmptyState(
                'No property definitions configured. Add them in plugin settings.'
            )
            return
        }

        if (entries.length === 0) {
            this.renderEmptyState('No notes found in this Base.')
            return
        }

        // Sort definitions: required first (a-z), then optional (a-z)
        this.activeDefinitions = this.sortDefinitions(allDefinitions)

        // Get base-selected properties that don't match any property definition
        const definitionNames = new Set(allDefinitions.map((d) => d.name))
        this.baseSelectedProperties = this.getBaseSelectedProperties(definitionNames)

        // Get filtering option: 'required' (default), 'all', or 'never'
        const hideNotesWhen = (this.config.get('hideNotesWhen') as string) ?? 'required'

        // Pre-compute definitions for filtering based on option
        const requiredDefinitions = this.activeDefinitions.filter((def) => def.required)

        // Extract values from Bases API and filter in a single pass
        for (const entry of entries) {
            const file = entry.file
            // Use Bases API - data is already loaded, very fast
            const values = this.getEntryValues(entry, this.activeDefinitions)
            this.originalValues.set(file.path, { ...values })
            this.currentValues.set(file.path, { ...values })

            // Check if we should include this entry based on filter option
            let shouldInclude = true

            if (hideNotesWhen === 'required' && requiredDefinitions.length > 0) {
                // Hide notes where all required properties are filled
                const allRequiredFilled = requiredDefinitions.every((def) => {
                    const value = values[def.name]
                    return value !== undefined && value !== null && value !== ''
                })
                shouldInclude = !allRequiredFilled
            } else if (hideNotesWhen === 'all') {
                // Hide notes where all properties are filled
                const allFilled = this.activeDefinitions.every((def) => {
                    const value = values[def.name]
                    return value !== undefined && value !== null && value !== ''
                })
                shouldInclude = !allFilled
            }
            // 'never' - always include

            if (shouldInclude) {
                this.filteredEntries.push(entry)
            }
        }

        if (this.filteredEntries.length === 0) {
            const message =
                hideNotesWhen === 'all'
                    ? 'All notes have all properties filled.'
                    : 'All notes have their required properties filled.'
            this.renderEmptyState(message)
            return
        }

        this.render()
    }

    /**
     * Render the table with virtual scrolling
     */
    private render(): void {
        // Create fixed header wrapper (hidden initially)
        this.fixedHeaderWrapperEl = this.containerEl.createDiv({
            cls: 'lt-grid-view-fixed-header-wrapper'
        })
        this.fixedHeaderWrapperEl.style.display = 'none'

        // Create table wrapper for horizontal scroll
        this.tableWrapperEl = this.containerEl.createDiv({ cls: 'lt-grid-view-table-wrapper' })

        // Create table
        this.tableEl = this.tableWrapperEl.createEl('table', { cls: 'lt-grid-view-table' })

        // Render header row
        this.renderHeader()

        // Create tbody with virtual scrolling structure
        this.tbodyEl = this.tableEl.createEl('tbody', { cls: 'lt-grid-view-tbody' })

        // Top spacer for virtual scrolling
        this.spacerTopEl = this.tbodyEl.createEl('tr', { cls: 'lt-grid-view-spacer' })
        const topSpacerTd = this.spacerTopEl.createEl('td')
        topSpacerTd.colSpan = 1 + this.baseSelectedProperties.length + this.activeDefinitions.length

        // Bottom spacer for virtual scrolling
        this.spacerBottomEl = this.tbodyEl.createEl('tr', { cls: 'lt-grid-view-spacer' })
        const bottomSpacerTd = this.spacerBottomEl.createEl('td')
        bottomSpacerTd.colSpan =
            1 + this.baseSelectedProperties.length + this.activeDefinitions.length

        // Set up scroll handler
        this.setupVirtualScrolling()

        // Initial render
        this.updateVisibleRows()
    }

    /**
     * Setup virtual scrolling listeners
     */
    private setupVirtualScrolling(): void {
        // Use the scroll element passed to the view
        const scrollContainer = this.scrollEl

        // Scroll handler with throttling
        let ticking = false
        this.scrollHandler = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.updateVisibleRows()
                    this.updateFixedHeader()
                    ticking = false
                })
                ticking = true
            }
        }

        scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true })

        // Also listen for horizontal scroll on the table wrapper
        if (this.tableWrapperEl) {
            this.tableWrapperEl.addEventListener(
                'scroll',
                () => {
                    this.syncFixedHeaderScroll()
                },
                { passive: true }
            )
        }

        // Resize observer to handle viewport changes
        this.resizeObserver = new ResizeObserver(() => {
            this.updateVisibleRows()
            this.updateFixedHeader()
        })
        this.resizeObserver.observe(scrollContainer)

        // Create the fixed header table after render
        this.createFixedHeader()
    }

    /**
     * Create a cloned fixed header table
     */
    private createFixedHeader(): void {
        if (!this.fixedHeaderWrapperEl || !this.theadEl) return

        // Create a table with cloned header
        this.fixedHeaderTableEl = this.fixedHeaderWrapperEl.createEl('table', {
            cls: 'lt-grid-view-table lt-grid-view-table--fixed'
        })

        // Clone the thead
        const clonedThead = this.theadEl.cloneNode(true) as HTMLTableSectionElement
        this.fixedHeaderTableEl.appendChild(clonedThead)
    }

    /**
     * Update fixed header visibility and position
     */
    private updateFixedHeader(): void {
        if (!this.fixedHeaderWrapperEl || !this.theadEl || !this.tableWrapperEl) return

        const scrollContainer = this.scrollEl
        const containerRect = this.containerEl.getBoundingClientRect()
        const theadRect = this.theadEl.getBoundingClientRect()
        const scrollContainerRect = scrollContainer.getBoundingClientRect()

        // Check if the original header is above the viewport
        const shouldShowFixed = theadRect.bottom < scrollContainerRect.top

        if (shouldShowFixed !== this.isFixedHeaderVisible) {
            this.isFixedHeaderVisible = shouldShowFixed
            this.fixedHeaderWrapperEl.style.display = shouldShowFixed ? 'block' : 'none'
        }

        if (shouldShowFixed) {
            // Position the fixed header at the top of the scroll container
            const topOffset = scrollContainerRect.top - containerRect.top
            this.fixedHeaderWrapperEl.style.top = `${topOffset}px`

            // Sync horizontal scroll and width
            this.syncFixedHeaderScroll()
        }
    }

    /**
     * Sync fixed header horizontal scroll with table wrapper
     */
    private syncFixedHeaderScroll(): void {
        if (!this.fixedHeaderWrapperEl || !this.tableWrapperEl) return

        // Match the horizontal scroll position
        this.fixedHeaderWrapperEl.scrollLeft = this.tableWrapperEl.scrollLeft

        // Match the width
        this.fixedHeaderWrapperEl.style.width = `${this.tableWrapperEl.clientWidth}px`
    }

    /**
     * Clean up virtual scrolling listeners
     */
    private cleanupVirtualScrolling(): void {
        if (this.scrollHandler) {
            this.scrollEl.removeEventListener('scroll', this.scrollHandler)
            this.scrollHandler = null
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
            this.resizeObserver = null
        }

        // Clean up fixed header
        this.fixedHeaderWrapperEl = null
        this.fixedHeaderTableEl = null
        this.theadEl = null
        this.isFixedHeaderVisible = false
    }

    /**
     * Update which rows are visible and render them
     */
    private updateVisibleRows(): void {
        if (!this.tbodyEl || !this.spacerTopEl || !this.spacerBottomEl) return

        const totalRows = this.filteredEntries.length
        if (totalRows === 0) return

        const rowHeight = GridView.ROW_HEIGHT
        const bufferRows = GridView.BUFFER_ROWS

        // Get scroll position relative to the table
        const scrollContainer = this.scrollEl
        const scrollTop = scrollContainer.scrollTop
        const viewportHeight = scrollContainer.clientHeight

        // Account for header height (approximately 32px)
        const headerHeight = 32
        const tableTop = this.containerEl.offsetTop

        // Calculate visible range
        const adjustedScrollTop = Math.max(0, scrollTop - tableTop - headerHeight)
        const startIndex = Math.max(0, Math.floor(adjustedScrollTop / rowHeight) - bufferRows)
        const visibleRows = Math.ceil(viewportHeight / rowHeight) + bufferRows * 2
        const endIndex = Math.min(totalRows - 1, startIndex + visibleRows)

        // Skip if range hasn't changed
        if (startIndex === this.visibleStartIndex && endIndex === this.visibleEndIndex) {
            return
        }

        this.visibleStartIndex = startIndex
        this.visibleEndIndex = endIndex

        // Update spacers
        const topSpacerHeight = startIndex * rowHeight
        const bottomSpacerHeight = Math.max(0, (totalRows - endIndex - 1) * rowHeight)

        const topTd = this.spacerTopEl.querySelector('td')
        const bottomTd = this.spacerBottomEl.querySelector('td')
        if (topTd) topTd.style.height = `${topSpacerHeight}px`
        if (bottomTd) bottomTd.style.height = `${bottomSpacerHeight}px`

        // Determine which rows need to be added/removed
        const newVisibleIndices = new Set<number>()
        for (let i = startIndex; i <= endIndex; i++) {
            newVisibleIndices.add(i)
        }

        // Remove rows that are no longer visible
        for (const index of this.renderedRowIndices) {
            if (!newVisibleIndices.has(index)) {
                const rowEl = this.rowElements.get(index)
                if (rowEl) {
                    // Destroy editors for this row
                    this.destroyRowEditors(index)
                    rowEl.remove()
                    this.rowElements.delete(index)
                }
            }
        }

        // Add new visible rows
        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.renderedRowIndices.has(i)) {
                const entry = this.filteredEntries[i]
                if (entry) {
                    this.renderRowAtIndex(i, entry)
                }
            }
        }

        // Update rendered indices
        this.renderedRowIndices = newVisibleIndices

        // Ensure rows are in correct order
        this.reorderRows()
    }

    /**
     * Reorder row elements in the DOM to match their indices
     */
    private reorderRows(): void {
        if (!this.tbodyEl || !this.spacerBottomEl) return

        // Get sorted indices
        const sortedIndices = [...this.renderedRowIndices].sort((a, b) => a - b)

        // Move rows to correct positions (before bottom spacer)
        for (const index of sortedIndices) {
            const rowEl = this.rowElements.get(index)
            if (rowEl) {
                this.tbodyEl.insertBefore(rowEl, this.spacerBottomEl)
            }
        }
    }

    /**
     * Render a single row at a specific index
     */
    private renderRowAtIndex(index: number, entry: BasesEntry): void {
        if (!this.tbodyEl || !this.spacerBottomEl) return

        const file = entry.file

        // Filter to only applicable properties for this file
        const applicableDefinitions = this.recognitionService.getApplicableProperties(
            file,
            this.activeDefinitions
        )
        const applicableNames = new Set(applicableDefinitions.map((d) => d.name))

        // Check for issues (only among applicable properties)
        const values = this.originalValues.get(file.path) ?? {}
        const hasIssues = this.frontmatterService.hasIssues(values, applicableDefinitions)

        const tr = createEl('tr', {
            cls: hasIssues ? 'lt-grid-view-tr lt-grid-view-tr--has-issues' : 'lt-grid-view-tr',
            attr: { 'data-file-path': file.path, 'data-row-index': String(index) }
        })

        // Note name cell
        const noteCell = tr.createEl('td', { cls: 'lt-grid-view-td lt-grid-view-td--note' })
        const fileLink = noteCell.createEl('a', {
            cls: 'lt-grid-view-note-link',
            text: formatFileTitleWithWeekday(file.basename),
            href: '#'
        })
        fileLink.addEventListener('click', (e) => {
            e.preventDefault()
            this.plugin.app.workspace.getLeaf().openFile(file)
        })

        // Base-selected property cells (read-only, sticky)
        const baseValues = this.getBasePropertyValues(entry, this.baseSelectedProperties)
        let leftOffset = GridView.NOTE_COLUMN_WIDTH
        for (const propName of this.baseSelectedProperties) {
            const td = tr.createEl('td', { cls: 'lt-grid-view-td lt-grid-view-td--base' })
            td.style.left = `${leftOffset}px`
            const value = baseValues[propName]
            this.renderReadOnlyCell(td, value)
            leftOffset += GridView.BASE_COLUMN_WIDTH
        }

        // Property definition cells (editable)
        for (const def of this.activeDefinitions) {
            const td = tr.createEl('td', { cls: 'lt-grid-view-td' })

            // Check if this property applies to this file
            if (!applicableNames.has(def.name)) {
                td.addClass('lt-grid-view-td--na')
                td.createSpan({ cls: 'lt-grid-view-na', text: '—' })
                continue
            }

            this.renderCell(td, file, def)
        }

        // Insert before bottom spacer
        this.tbodyEl.insertBefore(tr, this.spacerBottomEl)
        this.rowElements.set(index, tr)
    }

    /**
     * Destroy editors for a specific row
     */
    private destroyRowEditors(index: number): void {
        const entry = this.filteredEntries[index]
        if (!entry) return

        const filePath = entry.file.path
        for (const def of this.activeDefinitions) {
            const editorKey = `${filePath}:${def.name}`
            const editor = this.editors.get(editorKey)
            if (editor) {
                editor.destroy()
                this.editors.delete(editorKey)
            }
        }
    }

    /** Width of the note column in pixels */
    private static readonly NOTE_COLUMN_WIDTH = 180

    /** Width of each base property column in pixels */
    private static readonly BASE_COLUMN_WIDTH = 120

    /**
     * Render table header
     */
    private renderHeader(): void {
        if (!this.tableEl) return

        this.theadEl = this.tableEl.createEl('thead')
        const tr = this.theadEl.createEl('tr')

        // Note name column (sticky)
        const noteHeader = tr.createEl('th', { cls: 'lt-grid-view-th lt-grid-view-th--note' })
        noteHeader.createSpan({ text: 'Note' })

        // Base-selected property columns (read-only, sticky after note column)
        let leftOffset = GridView.NOTE_COLUMN_WIDTH
        for (const propName of this.baseSelectedProperties) {
            const th = tr.createEl('th', { cls: 'lt-grid-view-th lt-grid-view-th--base' })
            th.style.left = `${leftOffset}px`
            const headerContent = th.createDiv({ cls: 'lt-grid-view-th-content' })
            headerContent.createSpan({
                text: propName,
                cls: 'lt-grid-view-th-name'
            })
            leftOffset += GridView.BASE_COLUMN_WIDTH
        }

        // Property definition columns (editable, not sticky)
        for (const def of this.activeDefinitions) {
            const th = tr.createEl('th', { cls: 'lt-grid-view-th' })
            const headerContent = th.createDiv({ cls: 'lt-grid-view-th-content' })
            headerContent.createSpan({
                text: def.displayName || def.name,
                cls: 'lt-grid-view-th-name'
            })
            if (def.required) {
                headerContent.createSpan({ cls: 'lt-grid-view-th-required', text: '*' })
            }
        }
    }

    /**
     * Render a read-only cell for base-selected properties
     */
    private renderReadOnlyCell(td: HTMLElement, value: unknown): void {
        if (value === undefined || value === null || value === '') {
            td.addClass('lt-grid-view-td--empty')
            td.createSpan({ cls: 'lt-grid-view-empty-value', text: '—' })
            return
        }

        // Format value for display
        let displayValue: string
        if (Array.isArray(value)) {
            displayValue = value.join(', ')
        } else if (typeof value === 'boolean') {
            displayValue = value ? '✓' : '✗'
        } else {
            displayValue = String(value)
        }

        td.createSpan({ cls: 'lt-grid-view-readonly-value', text: displayValue })
    }

    /**
     * Render a cell with property editor
     */
    private renderCell(td: HTMLElement, file: TFile, definition: PropertyDefinition): void {
        const editorKey = `${file.path}:${definition.name}`
        const currentValues = this.currentValues.get(file.path) ?? {}
        const value = currentValues[definition.name]

        // Check if value has issues
        const validation = this.frontmatterService.validate(value, definition)
        if (!validation.valid) {
            td.addClass('lt-grid-view-td--invalid')
            td.setAttribute('title', validation.error ?? 'Invalid value')
        }

        const editor = createPropertyEditor({
            definition,
            value,
            compact: true, // Use compact editors for table cells
            onChange: (newValue) => {
                const values = this.currentValues.get(file.path) ?? {}
                values[definition.name] = newValue
                this.currentValues.set(file.path, values)
                // Auto-save with debounce (only if value is valid)
                this.debouncedSave(file, definition, newValue)
            },
            onCommit: () => {
                // Immediate save on commit (e.g., Enter key)
                const values = this.currentValues.get(file.path) ?? {}
                this.savePropertyImmediate(file, definition, values[definition.name])
            }
        })

        editor.render(td)
        this.editors.set(editorKey, editor)
    }

    /**
     * Debounced save for a specific property (validates before saving)
     */
    private debouncedSave(file: TFile, definition: PropertyDefinition, value: unknown): void {
        const timerKey = `${file.path}:${definition.name}`

        // Clear existing timer
        const existingTimer = this.saveTimers.get(timerKey)
        if (existingTimer) {
            clearTimeout(existingTimer)
        }

        // Set new timer
        const timer = setTimeout(() => {
            this.savePropertyImmediate(file, definition, value)
            this.saveTimers.delete(timerKey)
        }, GridView.AUTO_SAVE_DEBOUNCE_MS)

        this.saveTimers.set(timerKey, timer)
    }

    /**
     * Immediately save a single property value (validates before saving)
     */
    private savePropertyImmediate(
        file: TFile,
        definition: PropertyDefinition,
        value: unknown
    ): void {
        // Validate value before saving
        const validation = this.frontmatterService.validate(value, definition)
        if (!validation.valid) {
            log(`Skipping save for ${definition.name}: ${validation.error}`, 'debug')
            return
        }

        this.frontmatterService
            .write(file, { [definition.name]: value })
            .then(() => {
                log(`Saved ${definition.name} for ${file.basename}`, 'debug')
                // Update original value to reflect saved state
                const original = this.originalValues.get(file.path) ?? {}
                original[definition.name] = value
                this.originalValues.set(file.path, original)
            })
            .catch((error) => {
                log('Failed to save frontmatter', 'error', error)
            })
    }

    /**
     * Clear all pending save timers
     */
    private clearAllTimers(): void {
        for (const timer of this.saveTimers.values()) {
            clearTimeout(timer)
        }
        this.saveTimers.clear()
    }

    /**
     * Render empty state message
     */
    private renderEmptyState(message: string): void {
        const emptyEl = this.containerEl.createDiv({ cls: 'lt-grid-view-empty' })
        emptyEl.createSpan({ text: message })
    }

    /**
     * Clean up all editors
     */
    private destroyEditors(): void {
        for (const editor of this.editors.values()) {
            editor.destroy()
        }
        this.editors.clear()
    }

    /**
     * Called when view is unloaded
     */
    override onunload(): void {
        log('GridView unloading', 'debug')

        // Unregister as file provider
        this.plugin.setActiveFileProvider(null)

        if (this.unsubscribeSettings) {
            this.unsubscribeSettings()
            this.unsubscribeSettings = null
        }

        this.cleanupVirtualScrolling()
        this.clearAllTimers()
        this.destroyEditors()
    }
}
