import { App, PluginSettingTab, Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { FolderSuggest } from '../components/ui/folder-suggest'
import { CSS_CLASS, CSS_SELECTOR } from '../../utils'
import {
    VisualizationType,
    SETTINGS_TAB_VISUALIZATION_OPTIONS,
    SCALE_PRESETS_RECORD,
    supportsScale,
    PROPERTY_TYPES,
    PROPERTY_TYPE_LABELS,
    MAPPING_TYPE_LABELS,
    createDefaultPropertyDefinition,
    createDefaultMapping,
    type PropertyVisualizationPreset,
    type PropertyDefinition,
    type PropertyType,
    type MappingType
} from '../types'

type SettingsTab = 'properties' | 'visualizations' | 'about'

export class LifeTrackerPluginSettingTab extends PluginSettingTab {
    plugin: LifeTrackerPlugin
    private activeTab: SettingsTab = 'properties'
    // Track which property definitions are expanded (by id)
    private expandedDefinitions: Set<string> = new Set()

    constructor(app: App, plugin: LifeTrackerPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()
        containerEl.addClass('lt-settings')

        // Render tab navigation
        this.renderTabNav(containerEl)

        // Render content container
        const contentEl = containerEl.createDiv({ cls: 'lt-settings-content' })

        // Render active tab content
        switch (this.activeTab) {
            case 'properties':
                this.renderPropertiesTab(contentEl)
                break
            case 'visualizations':
                this.renderVisualizationsTab(contentEl)
                break
            case 'about':
                this.renderAboutTab(contentEl)
                break
        }
    }

    private renderTabNav(containerEl: HTMLElement): void {
        const navEl = containerEl.createDiv({ cls: 'lt-settings-nav' })

        const tabs: Array<{ id: SettingsTab; label: string }> = [
            { id: 'properties', label: 'Property definitions' },
            { id: 'visualizations', label: 'Visualizations' },
            { id: 'about', label: 'About' }
        ]

        for (const tab of tabs) {
            const tabEl = navEl.createDiv({
                cls: `lt-settings-nav-tab ${this.activeTab === tab.id ? 'lt-settings-nav-tab--active' : ''}`
            })
            tabEl.textContent = tab.label
            tabEl.addEventListener('click', () => {
                this.activeTab = tab.id
                this.display()
            })
        }
    }

    // ========================================
    // Properties Tab
    // ========================================

    private renderPropertiesTab(containerEl: HTMLElement): void {
        const desc = new DocumentFragment()
        desc.createDiv({
            text: 'Define properties to track. These determine what appears in the capture dialog and editing views.'
        })
        new Setting(containerEl).setDesc(desc)

        // Capture settings
        new Setting(containerEl)
            .setName('Confetti celebration')
            .setDesc('Show confetti animation when completing property capture')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showConfettiOnCapture)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.showConfettiOnCapture = value
                        })
                    })
            })

        // Separator
        containerEl.createEl('hr', { cls: 'lt-settings-separator' })

        // Property definitions header
        containerEl.createEl('h3', { text: 'Property definitions' })

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
                    this.display()
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
        const itemContainer = container.createDiv({ cls: 'lt-property-definition-item' })

        // Check if expanded (new items start expanded, others start collapsed)
        const isExpanded = isNew || this.expandedDefinitions.has(definition.id)

        // Main row with chevron, name, type, and delete button
        const mainSetting = new Setting(itemContainer)
        mainSetting.settingEl.classList.add('lt-property-header')

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
                            d.type = value as PropertyType
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
                    this.display()
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

        // Delete button
        mainSetting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Delete property definition')
                .onClick(async () => {
                    this.expandedDefinitions.delete(definition.id)
                    await this.deletePropertyDefinition(definition.id)
                    this.display()
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
                        this.display()
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

        // Type dropdown
        setting.addDropdown((dropdown) => {
            dropdown
                .addOptions(MAPPING_TYPE_LABELS)
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
                    this.display()
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
                    this.display()
                })
        })
    }

    private renderNumberConstraints(container: HTMLElement, definition: PropertyDefinition): void {
        const numberRange = definition.numberRange

        const constraintSetting = new Setting(container)
            .setName('Number range')
            .setDesc('Min and max values (leave both empty for no constraints)')

        // Min
        constraintSetting.addText((text) => {
            text.setPlaceholder('Min')
                .setValue(numberRange?.min?.toString() ?? '')
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            const min = value ? parseFloat(value) : null
                            const max = d.numberRange?.max ?? null
                            if (min !== null && max !== null) {
                                d.numberRange = { min, max }
                            } else if (min !== null) {
                                d.numberRange = { min, max: min + 100 }
                            } else {
                                d.numberRange = null
                            }
                        }
                    })
                })
            text.inputEl.type = 'number'
            text.inputEl.classList.add('lt-constraint-input')
        })

        // Max
        constraintSetting.addText((text) => {
            text.setPlaceholder('Max')
                .setValue(numberRange?.max?.toString() ?? '')
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const d = draft.propertyDefinitions.find((d) => d.id === definition.id)
                        if (d) {
                            const max = value ? parseFloat(value) : null
                            const min = d.numberRange?.min ?? null
                            if (min !== null && max !== null) {
                                d.numberRange = { min, max }
                            } else if (max !== null) {
                                d.numberRange = { min: 0, max }
                            } else {
                                d.numberRange = null
                            }
                        }
                    })
                })
            text.inputEl.type = 'number'
            text.inputEl.classList.add('lt-constraint-input')
        })
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

    private renderDefaultValue(container: HTMLElement, definition: PropertyDefinition): void {
        const setting = new Setting(container)
            .setName('Default value')
            .setDesc('Value used when creating or resetting')

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

    // ========================================
    // Visualizations Tab
    // ========================================

    private renderVisualizationsTab(containerEl: HTMLElement): void {
        // Animation settings
        new Setting(containerEl).setName('Animation').setHeading()

        new Setting(containerEl)
            .setName('Animation duration')
            .setDesc('Duration of visualization animations in seconds')
            .addSlider((slider) => {
                slider
                    .setLimits(1, 10, 0.5)
                    .setValue(this.plugin.settings.animationDuration / 1000)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.animationDuration = value * 1000
                        })
                    })
            })

        // Visualization presets
        new Setting(containerEl).setName('Visualization presets').setHeading()

        const desc = new DocumentFragment()
        desc.createDiv({
            text: 'Configure default visualizations for property names. These are applied automatically when a property matches.'
        })
        new Setting(containerEl).setDesc(desc)

        // List existing presets
        const presetsContainer = containerEl.createDiv({ cls: 'lt-presets-container' })
        this.renderPresetsList(presetsContainer)

        // Add new preset button
        new Setting(containerEl).addButton((button) => {
            button
                .setButtonText('Add preset')
                .setIcon('plus')
                .onClick(async () => {
                    await this.addNewPreset()
                    this.display()
                })
        })
    }

    private renderPresetsList(container: HTMLElement): void {
        container.empty()

        const presets = this.plugin.settings.visualizationPresets

        if (presets.length === 0) {
            container.createDiv({
                cls: 'lt-presets-empty',
                text: 'No presets configured. Add a preset to automatically configure visualizations for matching properties.'
            })
            return
        }

        for (const preset of presets) {
            this.renderPresetItem(container, preset)
        }
    }

    private renderPresetItem(container: HTMLElement, preset: PropertyVisualizationPreset): void {
        const setting = new Setting(container)

        // Property name input
        setting.addText((text) => {
            text.setPlaceholder('Property name')
                .setValue(preset.propertyNamePattern)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const p = draft.visualizationPresets.find((p) => p.id === preset.id)
                        if (p) {
                            p.propertyNamePattern = value
                        }
                    })
                })
            text.inputEl.classList.add('lt-preset-name-input')
        })

        // Visualization type dropdown
        setting.addDropdown((dropdown) => {
            dropdown
                .addOptions(SETTINGS_TAB_VISUALIZATION_OPTIONS)
                .setValue(preset.visualizationType)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const p = draft.visualizationPresets.find((p) => p.id === preset.id)
                        if (p) {
                            p.visualizationType = value as VisualizationType
                            if (!supportsScale(p.visualizationType)) {
                                p.scale = undefined
                            }
                        }
                    })
                    this.display()
                })
        })

        // Scale dropdown (only for supported types)
        if (supportsScale(preset.visualizationType)) {
            setting.addDropdown((dropdown) => {
                const scaleOptions: Record<string, string> = {
                    auto: 'Auto'
                }
                for (const key of Object.keys(SCALE_PRESETS_RECORD)) {
                    if (key !== 'auto') {
                        scaleOptions[key] = key
                    }
                }

                let currentValue = 'auto'
                if (preset.scale) {
                    const matchingKey = Object.entries(SCALE_PRESETS_RECORD).find(
                        ([_, value]) =>
                            value?.min === preset.scale?.min && value?.max === preset.scale?.max
                    )
                    if (matchingKey) {
                        currentValue = matchingKey[0]
                    }
                }

                dropdown
                    .addOptions(scaleOptions)
                    .setValue(currentValue)
                    .onChange(async (value) => {
                        const scaleValue = SCALE_PRESETS_RECORD[value]
                        await this.plugin.updateSettings((draft) => {
                            const p = draft.visualizationPresets.find((p) => p.id === preset.id)
                            if (p) {
                                p.scale = scaleValue
                                    ? { min: scaleValue.min, max: scaleValue.max }
                                    : undefined
                            }
                        })
                    })
            })
        }

        // Delete button
        setting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Delete preset')
                .onClick(async () => {
                    await this.deletePreset(preset.id)
                    this.display()
                })
        })
    }

    private async addNewPreset(): Promise<void> {
        const newPreset: PropertyVisualizationPreset = {
            id: crypto.randomUUID(),
            propertyNamePattern: '',
            visualizationType: VisualizationType.Heatmap
        }
        await this.plugin.updateSettings((draft) => {
            draft.visualizationPresets.push(newPreset)
        })
    }

    private async deletePreset(id: string): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            draft.visualizationPresets = draft.visualizationPresets.filter((p) => p.id !== id)
        })
    }

    // ========================================
    // About Tab
    // ========================================

    private renderAboutTab(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Follow me on X')
            .setDesc('Sébastien Dubois (@dSebastien)')
            .addButton((button) => {
                button.setCta()
                button.setButtonText('Follow me on X').onClick(() => {
                    window.open('https://x.com/dSebastien')
                })
            })

        new Setting(containerEl).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin'
        })

        new Setting(containerEl).setDesc(supportDesc)

        this.renderBuyMeACoffeeBadge(containerEl)
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src =
            'https://github.com/dsebastien/obsidian-plugin-template/blob/main/src/assets/buy-me-a-coffee.png?raw=true'
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
