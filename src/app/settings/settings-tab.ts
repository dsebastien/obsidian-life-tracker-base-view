import { App, PluginSettingTab, Setting } from 'obsidian'
import type { LifeTrackerBaseViewPlugin } from '../plugin'
import { VisualizationType } from '../domain/visualization-type.enum'
import { SETTINGS_TAB_VISUALIZATION_OPTIONS } from '../domain/visualization-options'
import type { PropertyVisualizationPreset } from '../types/plugin-settings.intf'
import { supportsScale } from '../types/column-config.types'

/**
 * Re-export for backwards compatibility
 */
export const VISUALIZATION_OPTIONS = SETTINGS_TAB_VISUALIZATION_OPTIONS

/**
 * Scale presets for dropdown
 */
const SCALE_PRESETS: Record<string, { min: number; max: number } | null> = {
    'auto': null,
    '0-1': { min: 0, max: 1 },
    '0-5': { min: 0, max: 5 },
    '1-5': { min: 1, max: 5 },
    '0-10': { min: 0, max: 10 },
    '1-10': { min: 1, max: 10 },
    '0-100': { min: 0, max: 100 }
}

export class LifeTrackerBaseViewPluginSettingTab extends PluginSettingTab {
    plugin: LifeTrackerBaseViewPlugin

    constructor(app: App, plugin: LifeTrackerBaseViewPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderAnimationSettings(containerEl)
        this.renderVisualizationPresets(containerEl)
        this.renderFollowButton(containerEl)
        this.renderSupportHeader(containerEl)
    }

    renderAnimationSettings(containerEl: HTMLElement): void {
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
    }

    renderVisualizationPresets(containerEl: HTMLElement): void {
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
                    this.display() // Refresh
                })
        })
    }

    renderPresetsList(container: HTMLElement): void {
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

    renderPresetItem(container: HTMLElement, preset: PropertyVisualizationPreset): void {
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
                .addOptions(VISUALIZATION_OPTIONS)
                .setValue(preset.visualizationType)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const p = draft.visualizationPresets.find((p) => p.id === preset.id)
                        if (p) {
                            p.visualizationType = value as VisualizationType
                            // Clear scale if new type doesn't support it
                            if (!supportsScale(p.visualizationType)) {
                                p.scale = undefined
                            }
                        }
                    })
                    this.display() // Refresh to show/hide scale
                })
        })

        // Scale dropdown (only for supported types)
        if (supportsScale(preset.visualizationType)) {
            setting.addDropdown((dropdown) => {
                // Build scale options
                const scaleOptions: Record<string, string> = {
                    auto: 'Auto'
                }
                for (const key of Object.keys(SCALE_PRESETS)) {
                    if (key !== 'auto') {
                        scaleOptions[key] = key
                    }
                }

                // Determine current value
                let currentValue = 'auto'
                if (preset.scale) {
                    const matchingKey = Object.entries(SCALE_PRESETS).find(
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
                        const scaleValue = SCALE_PRESETS[value]
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
                    this.display() // Refresh
                })
        })
    }

    async addNewPreset(): Promise<void> {
        const newPreset: PropertyVisualizationPreset = {
            id: crypto.randomUUID(),
            propertyNamePattern: '',
            visualizationType: VisualizationType.Heatmap
        }
        await this.plugin.updateSettings((draft) => {
            draft.visualizationPresets.push(newPreset)
        })
    }

    async deletePreset(id: string): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            draft.visualizationPresets = draft.visualizationPresets.filter((p) => p.id !== id)
        })
    }

    renderFollowButton(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Follow me on X')
            .setDesc('@dSebastien')
            .addButton((button) => {
                button.setCta()
                button.setButtonText('Follow me on X').onClick(() => {
                    window.open('https://x.com/dSebastien')
                })
            })
    }

    renderSupportHeader(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin ❤️'
        })

        new Setting(containerEl).setDesc(supportDesc)

        this.renderBuyMeACoffeeBadge(containerEl)
        const spacing = containerEl.createDiv()
        spacing.classList.add('support-header-margin')
    }

    renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src =
            'https://github.com/dsebastien/obsidian-plugin-template/raw/main/apps/plugin/src/assets/buy-me-a-coffee.png'
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
