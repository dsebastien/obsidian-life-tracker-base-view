import { App, Notice, Setting, type TextComponent } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { FolderSuggest } from '../components/ui/folder-suggest'
import { CSS_CLASS, CSS_SELECTOR } from '../../utils'
import {
    PROPERTY_TYPES,
    PROPERTY_TYPE_LABELS,
    MAPPING_TYPE_LABELS,
    createDefaultPropertyDefinition,
    createDefaultMapping,
    type PropertyDefinition,
    type ObsidianPropertyType,
    type MappingType
} from '../types'
import { computeNumberRange } from './number-range.utils'

/**
 * Renders and manages the "Property definitions" section of the settings tab
 * (definition list, per-definition editors, drag reordering, add/copy/delete).
 * Extracted from the settings tab to keep each module focused (issue #112).
 */
export class PropertyDefinitionSection {
    // Drag and drop state
    private draggedDefinitionId: string | null = null

    constructor(
        private readonly plugin: LifeTrackerPlugin,
        private readonly app: App,
        private readonly requestRerender: () => void,
        // Shared with the tab so expansion survives re-renders (by definition id)
        private readonly expandedDefinitions: Set<string>
    ) {}

    render(containerEl: HTMLElement): void {
        // Property definitions header
        new Setting(containerEl).setName('Property definitions').setHeading()

        // List existing definitions
        const definitionsContainer = containerEl.createDiv({
            cls: 'lt-property-definitions-container'
        })
        this.renderPropertyDefinitionsList(definitionsContainer)

        // Add new definition button
        new Setting(containerEl).addButton((button) => {
            button
                .setButtonText('Add property definition')
                .setIcon('plus')
                .onClick(async () => {
                    await this.addNewPropertyDefinition()
                    this.requestRerender()
                })
        })
    }

    private renderPropertyDefinitionsList(container: HTMLElement): void {
        container.empty()

        const definitions = this.plugin.settings.propertyDefinitions

        if (definitions.length === 0) {
            container.createDiv({
                cls: 'lt-property-definitions-empty',
                text: 'No property definitions configured. Add a definition to enable property capture and editing.'
            })
            return
        }

        // Sort by order
        const sortedDefinitions = [...definitions].sort((a, b) => a.order - b.order)

        for (const definition of sortedDefinitions) {
            this.renderPropertyDefinitionItem(container, definition)
        }
    }

    private renderPropertyDefinitionItem(
        container: HTMLElement,
        definition: PropertyDefinition,
        isNew: boolean = false
    ): void {
        const itemContainer = container.createDiv({
            cls: 'lt-property-definition-item',
            attr: {
                'draggable': 'true',
                'data-definition-id': definition.id
            }
        })

        // Drag and drop event handlers
        itemContainer.addEventListener('dragstart', (e) => {
            this.draggedDefinitionId = definition.id
            itemContainer.addClass('lt-property-definition-item--dragging')
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', definition.id)
            }
        })

        itemContainer.addEventListener('dragend', () => {
            this.draggedDefinitionId = null
            itemContainer.removeClass('lt-property-definition-item--dragging')
            // Remove drag-over class from all items
            container
                .querySelectorAll('.lt-property-definition-item--drag-over')
                .forEach((el) => el.removeClass('lt-property-definition-item--drag-over'))
        })

        itemContainer.addEventListener('dragover', (e) => {
            e.preventDefault()
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move'
            }
            // Only show drag-over state if dragging a different item
            if (this.draggedDefinitionId && this.draggedDefinitionId !== definition.id) {
                itemContainer.addClass('lt-property-definition-item--drag-over')
            }
        })

        itemContainer.addEventListener('dragleave', () => {
            itemContainer.removeClass('lt-property-definition-item--drag-over')
        })

        itemContainer.addEventListener('drop', (e) => {
            e.preventDefault()
            itemContainer.removeClass('lt-property-definition-item--drag-over')

            if (!this.draggedDefinitionId || this.draggedDefinitionId === definition.id) {
                return
            }

            // Perform the reorder
            void this.reorderDefinitions(this.draggedDefinitionId, definition.id)
        })

        // Check if expanded (new items start expanded, others start collapsed)
        const isExpanded = isNew || this.expandedDefinitions.has(definition.id)

        // Main row with drag handle, chevron, name, type, and delete button
        const mainSetting = new Setting(itemContainer)
        mainSetting.settingEl.classList.add('lt-property-header')

        // Drag handle (grip icon)
        mainSetting.addButton((button) => {
            button
                .setIcon('grip-vertical')
                .setTooltip('Drag to reorder')
                .setClass('lt-property-drag-handle')
        })

        // Chevron toggle button
        mainSetting.addButton((button) => {
            button
                .setIcon(isExpanded ? 'chevron-down' : 'chevron-right')
                .setTooltip(isExpanded ? 'Collapse' : 'Expand')
                .setClass('lt-property-chevron')
                .onClick(() => {
                    if (this.expandedDefinitions.has(definition.id)) {
                        this.expandedDefinitions.delete(definition.id)
                    } else {
                        this.expandedDefinitions.add(definition.id)
                    }
                    // Toggle details visibility without full re-render
                    const detailsEl = itemContainer.querySelector(
                        CSS_SELECTOR.PROPERTY_DETAILS
                    ) as HTMLElement
                    if (detailsEl) {
                        const nowExpanded = this.expandedDefinitions.has(definition.id)
                        detailsEl.toggleClass('lt-hidden', !nowExpanded)
                        button.setIcon(nowExpanded ? 'chevron-down' : 'chevron-right')
                        button.setTooltip(nowExpanded ? 'Collapse' : 'Expand')
                    }
                })
        })

        // Property name input
        mainSetting.addText((text) => {
            text.setPlaceholder('Property name (frontmatter key)')
                .setValue(definition.name)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            d.name = value
                        }
                    })
                })
            text.inputEl.classList.add('lt-property-name-input')
        })

        // Type dropdown
        mainSetting.addDropdown((dropdown) => {
            const options: Record<string, string> = {}
            for (const type of PROPERTY_TYPES) {
                options[type] = PROPERTY_TYPE_LABELS[type]
            }
            dropdown
                .addOptions(options)
                .setValue(definition.type)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            d.type = value as ObsidianPropertyType
                            // Clear type-specific constraints when type changes
                            if (value !== 'number') {
                                d.numberRange = null
                            }
                            if (!['text', 'list', 'tags'].includes(value)) {
                                d.allowedValues = []
                            }
                        }
                    })
                    // Expand when type changes to show relevant options
                    this.expandedDefinitions.add(definition.id)
                    this.requestRerender()
                })
        })

        // Required toggle
        mainSetting.addToggle((toggle) => {
            toggle
                .setTooltip('Required')
                .setValue(definition.required ?? false)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            d.required = value
                        }
                    })
                })
        })

        // Copy button
        mainSetting.addExtraButton((button) => {
            button
                .setIcon('copy')
                .setTooltip('Copy property definition')
                .onClick(async () => {
                    await this.copyPropertyDefinition(definition.id)
                    this.requestRerender()
                })
        })

        // Delete button
        mainSetting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Delete property definition')
                .onClick(async () => {
                    this.expandedDefinitions.delete(definition.id)
                    await this.deletePropertyDefinition(definition.id)
                    this.requestRerender()
                })
        })

        // Collapsible details container
        const detailsContainer = itemContainer.createDiv({
            cls: `${CSS_CLASS.PROPERTY_DETAILS}${isExpanded ? '' : ` ${CSS_CLASS.HIDDEN}`}`
        })

        // Type-specific options
        this.renderPropertyTypeOptions(detailsContainer, definition)
    }

    private renderPropertyTypeOptions(
        container: HTMLElement,
        definition: PropertyDefinition
    ): void {
        const optionsContainer = container.createDiv({ cls: 'lt-property-type-options' })

        // Display label (optional)
        new Setting(optionsContainer)
            .setName('Display label')
            .setDesc('Optional label shown in UI (defaults to property name)')
            .addText((text) => {
                text.setPlaceholder('Optional display label')
                    .setValue(definition.displayName)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                d.displayName = value
                            }
                        })
                    })
            })

        // Type-specific constraints
        if (definition.type === 'number') {
            this.renderNumberConstraints(optionsContainer, definition)
        } else if (['text', 'list', 'tags'].includes(definition.type)) {
            this.renderAllowedValues(optionsContainer, definition)
        }

        // Value mapping (only for text properties)
        if (definition.type === 'text') {
            this.renderValueMapping(optionsContainer, definition)
        }

        // Default value
        this.renderDefaultValue(optionsContainer, definition)

        // Description
        new Setting(optionsContainer)
            .setName('Description')
            .setDesc('Help text shown in capture dialog')
            .addTextArea((textarea) => {
                textarea
                    .setPlaceholder('Optional description or help text')
                    .setValue(definition.description)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                d.description = value
                            }
                        })
                    })
                textarea.inputEl.rows = 2
            })

        // Mappings (note filtering)
        this.renderMappings(optionsContainer, definition)
    }

    private renderMappings(container: HTMLElement, definition: PropertyDefinition): void {
        const mappingsContainer = container.createDiv({ cls: 'lt-mappings-container' })

        // Header with description
        new Setting(mappingsContainer)
            .setName('Note filtering')
            .setDesc(
                'Define which notes this property applies to. If no filters are set, property applies to all notes. Multiple filters use OR logic.'
            )
            .addButton((button) => {
                button
                    .setIcon('plus')
                    .setTooltip('Add filter')
                    .onClick(async () => {
                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                d.mappings.push(createDefaultMapping())
                            }
                        })
                        this.requestRerender()
                    })
            })

        // List existing mappings
        if (definition.mappings.length === 0) {
            mappingsContainer.createDiv({
                cls: 'lt-mappings-empty',
                text: 'No filters configured. This property applies to all notes.'
            })
            return
        }

        const mappingsList = mappingsContainer.createDiv({ cls: 'lt-mappings-list' })

        definition.mappings.forEach((_mapping, index) => {
            this.renderMappingItem(mappingsList, definition, index)
        })
    }

    private renderMappingItem(
        container: HTMLElement,
        definition: PropertyDefinition,
        mappingIndex: number
    ): void {
        const mapping = definition.mappings[mappingIndex]
        if (!mapping) return

        const setting = new Setting(container)
        setting.settingEl.classList.add('lt-mapping-item')

        // Enabled toggle
        setting.addToggle((toggle) => {
            toggle
                .setTooltip('Enable/disable filter')
                .setValue(mapping.enabled)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        const m = d?.mappings[mappingIndex]
                        if (m) {
                            m.enabled = value
                        }
                    })
                })
        })

        // Type dropdown. 'formula' matching isn't implemented
        // (PropertyRecognitionService.matchesMapping returns false), so it's
        // hidden for new mappings; kept visible only if a legacy mapping
        // already uses it so the stored value still displays.
        const typeOptions: Record<string, string> = Object.fromEntries(
            Object.entries(MAPPING_TYPE_LABELS).filter(
                ([type]) => type !== 'formula' || mapping.type === 'formula'
            )
        )
        setting.addDropdown((dropdown) => {
            dropdown
                .addOptions(typeOptions)
                .setValue(mapping.type)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        const m = d?.mappings[mappingIndex]
                        if (m) {
                            m.type = value as MappingType
                            m.value = ''
                        }
                    })
                    this.requestRerender()
                })
        })

        // Value input with placeholder based on type
        setting.addText((text) => {
            let placeholder = 'Value'
            switch (mapping.type) {
                case 'tag':
                    placeholder = 'tag-name (without #)'
                    break
                case 'folder':
                    placeholder = 'Start typing to search folders...'
                    break
                case 'regex':
                    placeholder = 'pattern (e.g., ^daily-)'
                    break
                case 'formula':
                    placeholder = 'Formula (not yet supported)'
                    break
            }

            text.setPlaceholder(placeholder)
                .setValue(mapping.value)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        const m = d?.mappings[mappingIndex]
                        if (m) {
                            m.value = value
                        }
                    })
                })
            text.inputEl.classList.add('lt-mapping-value-input')

            // Add folder autocomplete for folder type
            if (mapping.type === 'folder') {
                new FolderSuggest(text.inputEl, this.app)
            }
        })

        // Delete button
        setting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Remove filter')
                .onClick(async () => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            d.mappings.splice(mappingIndex, 1)
                        }
                    })
                    this.requestRerender()
                })
        })
    }

    private renderNumberConstraints(container: HTMLElement, definition: PropertyDefinition): void {
        const numberRange = definition.numberRange

        const constraintSetting = new Setting(container)
            .setName('Number range')
            .setDesc(
                'Min, max, and optional step (leave min and max empty for no constraints). ' +
                    'When only one bound is set, the other is inferred.'
            )

        let minText: TextComponent | null = null
        let maxText: TextComponent | null = null

        // Min
        constraintSetting.addText((text) => {
            minText = text
            text.setPlaceholder('Min')
                .setValue(numberRange?.min?.toString() ?? '')
                .onChange((value) => {
                    void this.updateNumberRange(definition, 'min', value, maxText)
                })
            text.inputEl.type = 'number'
            text.inputEl.classList.add('lt-constraint-input')
        })

        // Max
        constraintSetting.addText((text) => {
            maxText = text
            text.setPlaceholder('Max')
                .setValue(numberRange?.max?.toString() ?? '')
                .onChange((value) => {
                    void this.updateNumberRange(definition, 'max', value, minText)
                })
            text.inputEl.type = 'number'
            text.inputEl.classList.add('lt-constraint-input')
        })

        // Step (optional)
        constraintSetting.addText((text) => {
            text.setPlaceholder('Step')
                .setValue(numberRange?.step?.toString() ?? '')
                .onChange(async (value) => {
                    const step = value ? parseFloat(value) : null
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        // Step only applies when a range exists; ignore otherwise.
                        if (d?.numberRange) {
                            if (step !== null && step > 0) {
                                d.numberRange.step = step
                            } else {
                                delete d.numberRange.step
                            }
                        }
                    })
                })
            text.inputEl.type = 'number'
            text.inputEl.classList.add('lt-constraint-input')
        })
    }

    /**
     * Apply a change to one bound of a property's number range, inferring the
     * other bound when only one is provided and surfacing the inferred value
     * (both as a Notice and by reflecting it in the sibling input).
     */
    private async updateNumberRange(
        definition: PropertyDefinition,
        changed: 'min' | 'max',
        rawValue: string,
        siblingText: TextComponent | null
    ): Promise<void> {
        // Compute the new range (and any inference) synchronously from current
        // state, then apply it in one update.
        const current = this.plugin.settings.propertyDefinitions.find((d) => d.id === definition.id)
        const entered = rawValue ? parseFloat(rawValue) : null
        const { range: newRange, inferred } = computeNumberRange(
            changed,
            entered,
            current?.numberRange ?? null
        )

        await this.plugin.updateSettings((draft) => {
            const d = draft.propertyDefinitions.find((def) => def.id === definition.id)
            if (d) d.numberRange = newRange
        })

        // Reflect the inferred bound in the sibling field + notify the user.
        if (inferred) {
            siblingText?.setValue(String(inferred.value))
            new Notice(`${inferred.bound} set to ${inferred.value}`)
        }
    }

    private renderAllowedValues(container: HTMLElement, definition: PropertyDefinition): void {
        new Setting(container)
            .setName('Allowed values')
            .setDesc('Comma-separated list of allowed values (leave empty for free input)')
            .addTextArea((textarea) => {
                textarea
                    .setPlaceholder('value1, value2, value3')
                    .setValue(definition.allowedValues.join(', '))
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                if (value.trim()) {
                                    d.allowedValues = value
                                        .split(',')
                                        .map((v) => v.trim())
                                        .filter(Boolean)
                                } else {
                                    d.allowedValues = []
                                }
                            }
                        })
                    })
                textarea.inputEl.rows = 2
            })
    }

    private renderValueMapping(container: HTMLElement, definition: PropertyDefinition): void {
        const mappingContainer = container.createDiv({ cls: 'lt-value-mapping-container' })

        new Setting(mappingContainer)
            .setName('Value mapping')
            .setDesc(
                'Map text values to numbers for calculations. Display shows original text, charts use mapped numbers. Example: "⭐" → 1, "⭐⭐" → 2'
            )
            .addButton((button) => {
                button
                    .setIcon('plus')
                    .setTooltip('Add value mapping')
                    .onClick(async () => {
                        // Blur any focused input to trigger onChange before adding new mapping
                        const activeElement = activeDocument.activeElement as HTMLElement
                        if (activeElement && activeElement.blur) {
                            activeElement.blur()
                        }

                        // Wait a bit for any pending onChange handlers to complete
                        await new Promise((resolve) => window.setTimeout(resolve, 50))

                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                if (!d.valueMapping) {
                                    d.valueMapping = {}
                                }
                                d.valueMapping[''] = 0
                            }
                        })
                        this.requestRerender()
                    })
            })

        if (!definition.valueMapping || Object.keys(definition.valueMapping).length === 0) {
            mappingContainer.createDiv({
                cls: 'lt-value-mapping-empty',
                text: 'No mappings configured.'
            })
            return
        }

        const mappingsList = mappingContainer.createDiv({ cls: 'lt-value-mapping-list' })

        for (const [textValue, numericValue] of Object.entries(definition.valueMapping)) {
            this.renderValueMappingItem(mappingsList, definition, textValue, numericValue)
        }
    }

    private renderValueMappingItem(
        container: HTMLElement,
        definition: PropertyDefinition,
        textValue: string,
        numericValue: number
    ): void {
        const setting = new Setting(container)

        // Text value input
        setting.addText((text) => {
            text.setPlaceholder('Text value (e.g., ⭐⭐⭐)')
                .setValue(textValue)
                .onChange(async (newTextValue) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d?.valueMapping) {
                            delete d.valueMapping[textValue]
                            if (newTextValue.trim()) {
                                d.valueMapping[newTextValue.trim()] = numericValue
                            }
                        }
                    })
                })
        })

        // Arrow separator
        setting.settingEl.createSpan({ text: '→', cls: 'lt-value-mapping-arrow' })

        // Numeric value input
        setting.addText((text) => {
            text.setPlaceholder('Number')
                .setValue(String(numericValue))
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d?.valueMapping && textValue in d.valueMapping) {
                            const num = parseFloat(value)
                            if (!isNaN(num)) {
                                d.valueMapping[textValue] = num
                            }
                        }
                    })
                })
            text.inputEl.type = 'number'
        })

        // Delete button
        setting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Remove mapping')
                .onClick(async () => {
                    // Blur any focused input to trigger onChange before deleting
                    const activeElement = activeDocument.activeElement as HTMLElement
                    if (activeElement && activeElement.blur) {
                        activeElement.blur()
                    }

                    // Wait a bit for any pending onChange handlers to complete
                    await new Promise((resolve) => window.setTimeout(resolve, 50))

                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d?.valueMapping) {
                            delete d.valueMapping[textValue]
                            if (Object.keys(d.valueMapping).length === 0) {
                                d.valueMapping = null
                            }
                        }
                    })
                    this.requestRerender()
                })
        })
    }

    private renderDefaultValue(container: HTMLElement, definition: PropertyDefinition): void {
        const setting = new Setting(container)
            .setName('Default value')
            .setDesc('Click "Use default" in capture dialog to apply this value and advance')

        switch (definition.type) {
            case 'checkbox':
                setting.addToggle((toggle) => {
                    toggle.setValue(definition.defaultValue === true).onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                            if (d) {
                                d.defaultValue = value
                            }
                        })
                    })
                })
                break

            case 'number':
                setting.addText((text) => {
                    const defaultVal =
                        typeof definition.defaultValue === 'number'
                            ? definition.defaultValue.toString()
                            : ''
                    text.setPlaceholder('Default number')
                        .setValue(defaultVal)
                        .onChange(async (value) => {
                            await this.plugin.updateSettings((draft) => {
                                const d = draft.propertyDefinitions.find(
                                    (d) => d.id === definition.id
                                )
                                if (d) {
                                    d.defaultValue = value ? parseFloat(value) : null
                                }
                            })
                        })
                    text.inputEl.type = 'number'
                })
                break

            case 'text':
                if (definition.allowedValues.length > 0) {
                    setting.addDropdown((dropdown) => {
                        const options: Record<string, string> = { '': '(none)' }
                        for (const val of definition.allowedValues) {
                            const strVal = String(val)
                            options[strVal] = strVal
                        }
                        dropdown
                            .addOptions(options)
                            .setValue(String(definition.defaultValue ?? ''))
                            .onChange(async (value) => {
                                await this.plugin.updateSettings((draft) => {
                                    const d = draft.propertyDefinitions.find(
                                        (d) => d.id === definition.id
                                    )
                                    if (d) {
                                        d.defaultValue = value || null
                                    }
                                })
                            })
                    })
                } else {
                    setting.addText((text) => {
                        text.setPlaceholder('Default text')
                            .setValue(String(definition.defaultValue ?? ''))
                            .onChange(async (value) => {
                                await this.plugin.updateSettings((draft) => {
                                    const d = draft.propertyDefinitions.find(
                                        (d) => d.id === definition.id
                                    )
                                    if (d) {
                                        d.defaultValue = value || null
                                    }
                                })
                            })
                    })
                }
                break

            case 'date':
            case 'datetime':
                setting.addText((text) => {
                    text.setPlaceholder(
                        definition.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DDTHH:mm'
                    )
                        .setValue(String(definition.defaultValue ?? ''))
                        .onChange(async (value) => {
                            await this.plugin.updateSettings((draft) => {
                                const d = draft.propertyDefinitions.find(
                                    (d) => d.id === definition.id
                                )
                                if (d) {
                                    d.defaultValue = value || null
                                }
                            })
                        })
                    text.inputEl.type = definition.type === 'date' ? 'date' : 'datetime-local'
                })
                break

            case 'list':
            case 'tags':
                setting.addTextArea((textarea) => {
                    const currentValue = Array.isArray(definition.defaultValue)
                        ? definition.defaultValue.join(', ')
                        : ''
                    textarea
                        .setPlaceholder('value1, value2 (comma-separated)')
                        .setValue(currentValue)
                        .onChange(async (value) => {
                            await this.plugin.updateSettings((draft) => {
                                const d = draft.propertyDefinitions.find(
                                    (d) => d.id === definition.id
                                )
                                if (d) {
                                    if (value.trim()) {
                                        d.defaultValue = value
                                            .split(',')
                                            .map((v) => v.trim())
                                            .filter(Boolean)
                                    } else {
                                        d.defaultValue = null
                                    }
                                }
                            })
                        })
                    textarea.inputEl.rows = 1
                })
                break
        }
    }

    private async addNewPropertyDefinition(): Promise<void> {
        const nextOrder = this.plugin.settings.propertyDefinitions.length
        const newDefinition = createDefaultPropertyDefinition(crypto.randomUUID(), nextOrder)
        // Auto-expand newly created definitions
        this.expandedDefinitions.add(newDefinition.id)
        await this.plugin.updateSettings((draft) => {
            draft.propertyDefinitions.push(newDefinition)
        })
    }

    private async deletePropertyDefinition(id: string): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            draft.propertyDefinitions = draft.propertyDefinitions.filter((d) => d.id !== id)
        })
    }

    /**
     * Copy an existing property definition.
     * Creates a new definition with:
     * - New unique ID
     * - Empty name and displayName (user must fill in)
     * - All other properties copied (type, mappings, defaultValue, numberRange, allowedValues, etc.)
     */
    private async copyPropertyDefinition(sourceId: string): Promise<void> {
        const source = this.plugin.settings.propertyDefinitions.find((d) => d.id === sourceId)
        if (!source) return

        const nextOrder = this.plugin.settings.propertyDefinitions.length
        const newId = crypto.randomUUID()

        // Deep copy allowedValues preserving the type
        // PropertyAllowedValues is string[] | number[], spread operator loses the union distinction
        const copiedAllowedValues =
            source.allowedValues.length > 0 && typeof source.allowedValues[0] === 'number'
                ? (source.allowedValues.map((v) => v) as number[])
                : (source.allowedValues.map((v) => v) as string[])

        // Create copy with new ID, cleared name/displayName, and copied mappings
        const copiedDefinition: PropertyDefinition = {
            id: newId,
            name: '', // Clear - user must fill in
            displayName: '', // Clear - user must fill in
            type: source.type,
            allowedValues: copiedAllowedValues,
            numberRange: source.numberRange ? { ...source.numberRange } : null, // Deep copy object
            defaultValue: Array.isArray(source.defaultValue)
                ? [...source.defaultValue] // Deep copy array default values
                : source.defaultValue,
            required: source.required,
            description: source.description,
            order: nextOrder,
            mappings: source.mappings.map((m) => ({ ...m })), // Deep copy mappings
            valueMapping: source.valueMapping ? { ...source.valueMapping } : null // Deep copy value mapping
        }

        // Auto-expand the new definition
        this.expandedDefinitions.add(newId)

        await this.plugin.updateSettings((draft) => {
            draft.propertyDefinitions.push(copiedDefinition)
        })
    }

    /**
     * Reorder property definitions by moving the dragged item to the position of the target item.
     * Updates the order field for all affected items to maintain consistent ordering.
     */
    private async reorderDefinitions(draggedId: string, targetId: string): Promise<void> {
        await this.plugin.updateSettings(
            (draft) => {
                const definitions = draft.propertyDefinitions

                // Find the indices
                const draggedIndex = definitions.findIndex((d) => d.id === draggedId)
                const targetIndex = definitions.findIndex((d) => d.id === targetId)

                if (draggedIndex === -1 || targetIndex === -1) return

                // Remove the dragged item
                const [draggedItem] = definitions.splice(draggedIndex, 1)
                if (!draggedItem) return

                // Insert at the target position
                definitions.splice(targetIndex, 0, draggedItem)

                // Update all order values to reflect new positions
                definitions.forEach((def, index) => {
                    def.order = index
                })
            },
            { type: 'property-definitions-changed' }
        )

        // Re-render to show new order
        this.requestRerender()
    }
}
