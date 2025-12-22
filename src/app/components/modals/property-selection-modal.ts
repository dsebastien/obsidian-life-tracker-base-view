import { Modal } from 'obsidian'
import type { BasesPropertyId } from 'obsidian'
import type { LifeTrackerPlugin } from '../../plugin'
import { VisualizationType } from '../../types'

/**
 * Property info for selection
 */
export interface SelectableProperty {
    id: BasesPropertyId
    displayName: string
}

/**
 * Result from the property selection modal
 */
export interface PropertySelectionResult {
    propertyIds: BasesPropertyId[]
    visualizationType: VisualizationType
    displayName: string
}

/**
 * Modal for selecting properties to include in an overlay visualization.
 * Shows checkboxes for all available properties and allows selecting 2+.
 */
export class PropertySelectionModal extends Modal {
    private availableProperties: SelectableProperty[]
    private onConfirm: (result: PropertySelectionResult) => void

    // Selection state
    private selectedPropertyIds: Set<BasesPropertyId> = new Set()
    private visualizationType: VisualizationType = VisualizationType.LineChart
    private displayName: string = ''

    // DOM elements
    private propertyListEl: HTMLElement | null = null
    private confirmBtn: HTMLButtonElement | null = null
    private nameInputEl: HTMLInputElement | null = null

    constructor(
        plugin: LifeTrackerPlugin,
        availableProperties: SelectableProperty[],
        preSelectedPropertyIds: BasesPropertyId[],
        onConfirm: (result: PropertySelectionResult) => void
    ) {
        super(plugin.app)
        this.availableProperties = availableProperties
        this.onConfirm = onConfirm

        // Initialize with pre-selected properties
        for (const id of preSelectedPropertyIds) {
            this.selectedPropertyIds.add(id)
        }
    }

    override onOpen(): void {
        const { contentEl } = this
        contentEl.empty()
        contentEl.addClass('lt-property-selection-modal')

        this.render()
    }

    override onClose(): void {
        this.contentEl.empty()
    }

    private render(): void {
        const { contentEl } = this

        // Header
        contentEl.createEl('h2', {
            cls: 'lt-property-selection-title',
            text: 'Create overlay chart'
        })

        contentEl.createEl('p', {
            cls: 'lt-property-selection-description',
            text: 'Select 2 or more properties to display on the same chart.'
        })

        // Chart type selection
        this.renderChartTypeSelector()

        // Display name input
        this.renderNameInput()

        // Property list with checkboxes
        this.propertyListEl = contentEl.createDiv({ cls: 'lt-property-selection-list' })
        this.renderPropertyList()

        // Button row
        const buttonRow = contentEl.createDiv({ cls: 'lt-property-selection-buttons' })

        // Cancel button
        const cancelBtn = buttonRow.createEl('button', {
            cls: 'lt-property-selection-btn lt-property-selection-btn--cancel',
            text: 'Cancel'
        })
        cancelBtn.addEventListener('click', () => this.close())

        // Confirm button
        this.confirmBtn = buttonRow.createEl('button', {
            cls: 'lt-property-selection-btn lt-property-selection-btn--confirm',
            text: 'Create overlay'
        })
        this.confirmBtn.disabled = this.selectedPropertyIds.size < 2
        this.confirmBtn.addEventListener('click', () => this.handleConfirm())

        this.updateConfirmButton()
    }

    private renderChartTypeSelector(): void {
        const { contentEl } = this

        const typeRow = contentEl.createDiv({ cls: 'lt-property-selection-type-row' })
        typeRow.createEl('label', {
            cls: 'lt-property-selection-label',
            text: 'Chart type'
        })

        const select = typeRow.createEl('select', {
            cls: 'lt-property-selection-select dropdown'
        })

        const options = [
            { value: VisualizationType.LineChart, label: 'Line chart' },
            { value: VisualizationType.BarChart, label: 'Bar chart' },
            { value: VisualizationType.AreaChart, label: 'Area chart' }
        ]

        for (const opt of options) {
            const option = select.createEl('option', {
                value: opt.value,
                text: opt.label
            })
            if (opt.value === this.visualizationType) {
                option.selected = true
            }
        }

        select.addEventListener('change', () => {
            this.visualizationType = select.value as VisualizationType
        })
    }

    private renderNameInput(): void {
        const { contentEl } = this

        const nameRow = contentEl.createDiv({ cls: 'lt-property-selection-name-row' })
        nameRow.createEl('label', {
            cls: 'lt-property-selection-label',
            text: 'Display name'
        })

        this.nameInputEl = nameRow.createEl('input', {
            cls: 'lt-property-selection-input',
            type: 'text',
            placeholder: 'e.g., Sleep vs Energy'
        })

        // Generate default name based on selected properties
        this.updateDefaultName()

        this.nameInputEl.addEventListener('input', () => {
            this.displayName = this.nameInputEl?.value ?? ''
        })
    }

    private updateDefaultName(): void {
        if (!this.nameInputEl) return

        // Only update if user hasn't typed anything
        if (this.displayName && this.displayName !== this.getGeneratedName()) {
            return
        }

        const newName = this.getGeneratedName()
        this.nameInputEl.value = newName
        this.displayName = newName
    }

    private getGeneratedName(): string {
        const selectedNames: string[] = []
        for (const prop of this.availableProperties) {
            if (this.selectedPropertyIds.has(prop.id)) {
                selectedNames.push(prop.displayName)
            }
        }
        return selectedNames.join(' vs ')
    }

    private renderPropertyList(): void {
        if (!this.propertyListEl) return
        this.propertyListEl.empty()

        for (const prop of this.availableProperties) {
            const isSelected = this.selectedPropertyIds.has(prop.id)

            const row = this.propertyListEl.createDiv({
                cls: `lt-property-selection-item ${isSelected ? 'lt-property-selection-item--selected' : ''}`
            })

            // Checkbox
            const checkbox = row.createEl('input', {
                type: 'checkbox',
                cls: 'lt-property-selection-checkbox'
            })
            checkbox.checked = isSelected
            checkbox.id = `prop-${prop.id}`

            // Label
            row.createEl('label', {
                cls: 'lt-property-selection-item-label',
                text: prop.displayName,
                attr: { for: `prop-${prop.id}` }
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

        this.updateConfirmButton()
        this.updateDefaultName()

        // Update row styling
        if (this.propertyListEl) {
            const rows = this.propertyListEl.querySelectorAll('.lt-property-selection-item')
            rows.forEach((row, index) => {
                const prop = this.availableProperties[index]
                if (prop) {
                    const isSelected = this.selectedPropertyIds.has(prop.id)
                    row.toggleClass('lt-property-selection-item--selected', isSelected)
                }
            })
        }
    }

    private updateConfirmButton(): void {
        if (!this.confirmBtn) return

        const count = this.selectedPropertyIds.size
        this.confirmBtn.disabled = count < 2
        this.confirmBtn.textContent =
            count < 2 ? `Select at least 2 properties` : `Create overlay (${count} properties)`
    }

    private handleConfirm(): void {
        if (this.selectedPropertyIds.size < 2) return

        const result: PropertySelectionResult = {
            propertyIds: Array.from(this.selectedPropertyIds),
            visualizationType: this.visualizationType,
            displayName: this.displayName || this.getGeneratedName()
        }

        this.onConfirm(result)
        this.close()
    }
}
