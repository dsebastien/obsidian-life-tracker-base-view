import { Modal, setIcon } from 'obsidian'
import type { BasesPropertyId } from 'obsidian'
import type { LifeTrackerPlugin } from '../../plugin'
import {
    VisualizationType,
    type OverlayVisualizationConfig,
    type ReferenceLineConfig
} from '../../types'

/**
 * Property info for selection
 */
export interface EditableProperty {
    id: BasesPropertyId
    displayName: string
}

/**
 * Result from the overlay edit modal
 */
export interface OverlayEditResult {
    displayName: string
    visualizationType: VisualizationType
    propertyIds: BasesPropertyId[]
    referenceLines?: Record<BasesPropertyId, ReferenceLineConfig>
    hideIndividualVisualizations: boolean
}

/**
 * Callbacks for the overlay edit modal
 */
export interface OverlayEditCallbacks {
    onSave: (result: OverlayEditResult) => void
    onDelete: () => void
}

/**
 * Chart type options for overlay
 */
const CHART_TYPE_OPTIONS = [
    { value: VisualizationType.LineChart, label: 'Line chart', icon: 'line-chart' },
    { value: VisualizationType.BarChart, label: 'Bar chart', icon: 'bar-chart-2' },
    { value: VisualizationType.AreaChart, label: 'Area chart', icon: 'activity' }
]

/**
 * Modal for editing an existing overlay visualization.
 * Allows renaming, changing chart type, and modifying selected properties.
 */
export class OverlayEditModal extends Modal {
    private overlayConfig: OverlayVisualizationConfig
    private availableProperties: EditableProperty[]
    private callbacks: OverlayEditCallbacks

    // Edit state
    private displayName: string
    private visualizationType: VisualizationType
    private selectedPropertyIds: Set<BasesPropertyId>
    private referenceLines: Map<BasesPropertyId, ReferenceLineConfig>
    private hideIndividualVisualizations: boolean

    // DOM elements
    private nameInputEl: HTMLInputElement | null = null
    private propertyListEl: HTMLElement | null = null
    private referenceLinesEl: HTMLElement | null = null
    private saveBtn: HTMLButtonElement | null = null
    private errorEl: HTMLElement | null = null

    constructor(
        plugin: LifeTrackerPlugin,
        overlayConfig: OverlayVisualizationConfig,
        availableProperties: EditableProperty[],
        callbacks: OverlayEditCallbacks
    ) {
        super(plugin.app)
        this.overlayConfig = overlayConfig
        this.availableProperties = availableProperties
        this.callbacks = callbacks

        // Initialize edit state from current config
        this.displayName = overlayConfig.displayName
        this.visualizationType = overlayConfig.visualizationType
        this.selectedPropertyIds = new Set(overlayConfig.propertyIds)
        this.hideIndividualVisualizations = overlayConfig.hideIndividualVisualizations ?? false

        // Initialize reference lines from config
        this.referenceLines = new Map()
        if (overlayConfig.referenceLines) {
            for (const [propId, refLine] of Object.entries(overlayConfig.referenceLines)) {
                this.referenceLines.set(propId as BasesPropertyId, refLine)
            }
        }
    }

    override onOpen(): void {
        const { contentEl } = this
        contentEl.empty()
        contentEl.addClass('lt-overlay-edit-modal')

        this.render()
    }

    override onClose(): void {
        this.contentEl.empty()
    }

    private render(): void {
        const { contentEl } = this

        // Header with title and close button
        const header = contentEl.createDiv({ cls: 'lt-overlay-edit-header' })
        header.createEl('h2', {
            cls: 'lt-overlay-edit-title',
            text: 'Edit overlay chart'
        })

        // Close button
        const closeBtn = header.createEl('button', {
            cls: 'lt-overlay-edit-close',
            attr: { 'aria-label': 'Close' }
        })
        setIcon(closeBtn, 'x')
        closeBtn.addEventListener('click', () => this.close())

        // Content area
        const content = contentEl.createDiv({ cls: 'lt-overlay-edit-content' })

        // Display name section
        this.renderNameSection(content)

        // Chart type section
        this.renderChartTypeSection(content)

        // Properties section
        this.renderPropertiesSection(content)

        // Hide individual visualizations section
        this.renderHideIndividualSection(content)

        // Reference lines section
        this.renderReferenceLinesSection(content)

        // Error message area
        this.errorEl = content.createDiv({ cls: 'lt-overlay-edit-error' })

        // Footer with actions
        this.renderFooter(contentEl)
    }

    private renderNameSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'lt-overlay-edit-section' })

        section.createEl('label', {
            cls: 'lt-overlay-edit-label',
            text: 'Display name'
        })

        this.nameInputEl = section.createEl('input', {
            cls: 'lt-overlay-edit-input',
            type: 'text',
            value: this.displayName,
            placeholder: 'e.g., Sleep vs Energy'
        })

        this.nameInputEl.addEventListener('input', () => {
            this.displayName = this.nameInputEl?.value ?? ''
            this.updateSaveButton()
        })
    }

    private renderChartTypeSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'lt-overlay-edit-section' })

        section.createEl('label', {
            cls: 'lt-overlay-edit-label',
            text: 'Chart type'
        })

        const typeGrid = section.createDiv({ cls: 'lt-overlay-edit-type-grid' })

        for (const option of CHART_TYPE_OPTIONS) {
            const isSelected = option.value === this.visualizationType

            const typeBtn = typeGrid.createEl('button', {
                cls: `lt-overlay-edit-type-btn ${isSelected ? 'lt-overlay-edit-type-btn--selected' : ''}`
            })

            const iconEl = typeBtn.createSpan({ cls: 'lt-overlay-edit-type-icon' })
            setIcon(iconEl, option.icon)

            typeBtn.createSpan({
                cls: 'lt-overlay-edit-type-label',
                text: option.label
            })

            if (isSelected) {
                const checkEl = typeBtn.createSpan({ cls: 'lt-overlay-edit-type-check' })
                setIcon(checkEl, 'check')
            }

            typeBtn.addEventListener('click', () => {
                this.visualizationType = option.value
                this.refreshChartTypeButtons(typeGrid)
            })
        }
    }

    private refreshChartTypeButtons(container: HTMLElement): void {
        container.empty()

        for (const option of CHART_TYPE_OPTIONS) {
            const isSelected = option.value === this.visualizationType

            const typeBtn = container.createEl('button', {
                cls: `lt-overlay-edit-type-btn ${isSelected ? 'lt-overlay-edit-type-btn--selected' : ''}`
            })

            const iconEl = typeBtn.createSpan({ cls: 'lt-overlay-edit-type-icon' })
            setIcon(iconEl, option.icon)

            typeBtn.createSpan({
                cls: 'lt-overlay-edit-type-label',
                text: option.label
            })

            if (isSelected) {
                const checkEl = typeBtn.createSpan({ cls: 'lt-overlay-edit-type-check' })
                setIcon(checkEl, 'check')
            }

            typeBtn.addEventListener('click', () => {
                this.visualizationType = option.value
                this.refreshChartTypeButtons(container)
            })
        }
    }

    private renderPropertiesSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'lt-overlay-edit-section' })

        const labelRow = section.createDiv({ cls: 'lt-overlay-edit-label-row' })
        labelRow.createEl('label', {
            cls: 'lt-overlay-edit-label',
            text: 'Properties'
        })
        labelRow.createSpan({
            cls: 'lt-overlay-edit-label-hint',
            text: `${this.selectedPropertyIds.size} selected (min. 2)`
        })

        this.propertyListEl = section.createDiv({ cls: 'lt-overlay-edit-property-list' })
        this.renderPropertyList()
    }

    private renderPropertyList(): void {
        if (!this.propertyListEl) return
        this.propertyListEl.empty()

        for (const prop of this.availableProperties) {
            const isSelected = this.selectedPropertyIds.has(prop.id)

            const row = this.propertyListEl.createDiv({
                cls: `lt-overlay-edit-property-item ${isSelected ? 'lt-overlay-edit-property-item--selected' : ''}`
            })

            // Checkbox
            const checkbox = row.createEl('input', {
                type: 'checkbox',
                cls: 'lt-overlay-edit-checkbox'
            })
            checkbox.checked = isSelected
            checkbox.id = `overlay-prop-${prop.id}`

            // Label
            row.createEl('label', {
                cls: 'lt-overlay-edit-property-label',
                text: prop.displayName,
                attr: { for: `overlay-prop-${prop.id}` }
            })

            // Click handler for the whole row
            row.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked
                }
                this.toggleProperty(prop.id, checkbox.checked)
            })

            checkbox.addEventListener('change', () => {
                this.toggleProperty(prop.id, checkbox.checked)
            })
        }
    }

    private toggleProperty(propertyId: BasesPropertyId, selected: boolean): void {
        if (selected) {
            this.selectedPropertyIds.add(propertyId)
        } else {
            this.selectedPropertyIds.delete(propertyId)
        }

        this.updatePropertyCount()
        this.updateSaveButton()
        this.refreshPropertyStyles()
        this.renderReferenceLinesList()
    }

    private updatePropertyCount(): void {
        const labelHint = this.contentEl.querySelector('.lt-overlay-edit-label-hint')
        if (labelHint) {
            labelHint.textContent = `${this.selectedPropertyIds.size} selected (min. 2)`
        }
    }

    private refreshPropertyStyles(): void {
        if (!this.propertyListEl) return

        const rows = this.propertyListEl.querySelectorAll('.lt-overlay-edit-property-item')
        rows.forEach((row, index) => {
            const prop = this.availableProperties[index]
            if (prop) {
                const isSelected = this.selectedPropertyIds.has(prop.id)
                row.toggleClass('lt-overlay-edit-property-item--selected', isSelected)
            }
        })
    }

    private renderHideIndividualSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'lt-overlay-edit-section' })

        const row = section.createDiv({ cls: 'lt-overlay-edit-toggle-row' })

        // Toggle
        const toggle = row.createEl('input', {
            type: 'checkbox',
            cls: 'lt-overlay-edit-toggle'
        })
        toggle.checked = this.hideIndividualVisualizations
        toggle.id = 'overlay-hide-individual'

        // Label and description
        const labelContainer = row.createDiv({ cls: 'lt-overlay-edit-toggle-label-container' })
        labelContainer.createEl('label', {
            cls: 'lt-overlay-edit-toggle-label',
            text: 'Hide individual visualizations',
            attr: { for: 'overlay-hide-individual' }
        })
        labelContainer.createDiv({
            cls: 'lt-overlay-edit-toggle-description',
            text: 'Hide the separate cards for each property in this overlay'
        })

        toggle.addEventListener('change', () => {
            this.hideIndividualVisualizations = toggle.checked
        })
    }

    private renderFooter(container: HTMLElement): void {
        const footer = container.createDiv({ cls: 'lt-overlay-edit-footer' })

        // Left side: Delete button
        const leftActions = footer.createDiv({ cls: 'lt-overlay-edit-footer-left' })

        const deleteBtn = leftActions.createEl('button', {
            cls: 'lt-overlay-edit-btn lt-overlay-edit-btn--danger'
        })
        setIcon(deleteBtn, 'trash-2')
        deleteBtn.createSpan({ text: 'Delete' })
        deleteBtn.addEventListener('click', () => this.handleDelete())

        // Right side: Cancel and Save buttons
        const rightActions = footer.createDiv({ cls: 'lt-overlay-edit-footer-right' })

        const cancelBtn = rightActions.createEl('button', {
            cls: 'lt-overlay-edit-btn lt-overlay-edit-btn--secondary',
            text: 'Cancel'
        })
        cancelBtn.addEventListener('click', () => this.close())

        this.saveBtn = rightActions.createEl('button', {
            cls: 'lt-overlay-edit-btn lt-overlay-edit-btn--primary',
            text: 'Save changes'
        })
        this.saveBtn.addEventListener('click', () => this.handleSave())

        this.updateSaveButton()
    }

    private updateSaveButton(): void {
        if (!this.saveBtn) return

        const isValid = this.selectedPropertyIds.size >= 2 && this.displayName.trim().length > 0
        this.saveBtn.disabled = !isValid

        if (this.errorEl) {
            if (this.selectedPropertyIds.size < 2) {
                this.errorEl.textContent = 'Select at least 2 properties'
                this.errorEl.classList.add('lt-overlay-edit-error--visible')
            } else if (this.displayName.trim().length === 0) {
                this.errorEl.textContent = 'Display name is required'
                this.errorEl.classList.add('lt-overlay-edit-error--visible')
            } else {
                this.errorEl.textContent = ''
                this.errorEl.classList.remove('lt-overlay-edit-error--visible')
            }
        }
    }

    private renderReferenceLinesSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'lt-overlay-edit-section' })

        section.createEl('label', {
            cls: 'lt-overlay-edit-label',
            text: 'Reference lines (optional)'
        })
        section.createSpan({
            cls: 'lt-overlay-edit-label-hint',
            text: 'Set target values for each property'
        })

        this.referenceLinesEl = section.createDiv({ cls: 'lt-overlay-edit-reflines-list' })
        this.renderReferenceLinesList()
    }

    private renderReferenceLinesList(): void {
        if (!this.referenceLinesEl) return
        this.referenceLinesEl.empty()

        if (this.selectedPropertyIds.size === 0) {
            this.referenceLinesEl.createDiv({
                cls: 'lt-overlay-edit-reflines-empty',
                text: 'Select properties above to configure reference lines'
            })
            return
        }

        for (const propId of this.selectedPropertyIds) {
            const prop = this.availableProperties.find((p) => p.id === propId)
            if (!prop) continue

            const refLine = this.referenceLines.get(propId)
            const row = this.referenceLinesEl.createDiv({ cls: 'lt-overlay-edit-refline-row' })

            // Property name
            row.createDiv({
                cls: 'lt-overlay-edit-refline-name',
                text: prop.displayName
            })

            // Toggle
            const toggle = row.createEl('input', {
                type: 'checkbox',
                cls: 'lt-overlay-edit-refline-toggle'
            })
            toggle.checked = refLine?.enabled ?? false

            // Value input
            const valueInput = row.createEl('input', {
                type: 'number',
                cls: 'lt-overlay-edit-refline-input',
                placeholder: 'Value',
                value: refLine?.value?.toString() ?? ''
            })
            valueInput.disabled = !toggle.checked

            // Update handler
            const updateRefLine = (): void => {
                if (toggle.checked) {
                    const value = parseFloat(valueInput.value)
                    if (!isNaN(value)) {
                        this.referenceLines.set(propId, {
                            enabled: true,
                            value,
                            label: refLine?.label
                        })
                    }
                } else {
                    this.referenceLines.delete(propId)
                }
            }

            toggle.addEventListener('change', () => {
                valueInput.disabled = !toggle.checked
                updateRefLine()
            })

            valueInput.addEventListener('input', updateRefLine)
        }
    }

    private handleSave(): void {
        if (this.selectedPropertyIds.size < 2) return
        if (this.displayName.trim().length === 0) return

        // Build reference lines record
        const referenceLines: Record<BasesPropertyId, ReferenceLineConfig> = {}
        for (const [propId, refLine] of this.referenceLines.entries()) {
            if (refLine.enabled && this.selectedPropertyIds.has(propId)) {
                referenceLines[propId] = refLine
            }
        }

        const result: OverlayEditResult = {
            displayName: this.displayName.trim(),
            visualizationType: this.visualizationType,
            propertyIds: Array.from(this.selectedPropertyIds),
            referenceLines: Object.keys(referenceLines).length > 0 ? referenceLines : undefined,
            hideIndividualVisualizations: this.hideIndividualVisualizations
        }

        this.callbacks.onSave(result)
        this.close()
    }

    private handleDelete(): void {
        // Show confirmation
        const confirmed = confirm(
            `Delete overlay "${this.overlayConfig.displayName}"?\n\nThis action cannot be undone.`
        )

        if (confirmed) {
            this.callbacks.onDelete()
            this.close()
        }
    }
}
