import { Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import {
    COLOR_SCHEME_OPTIONS as COLOR_SCHEME_OPTIONS_LIST,
    type ChartColorScheme
} from '../../utils'
import {
    VisualizationType,
    SETTINGS_TAB_VISUALIZATION_OPTIONS,
    SCALE_PRESETS_RECORD,
    supportsScale,
    supportsColorScheme,
    supportsAggregationMethod,
    DEFAULT_AGGREGATION_METHOD,
    type PropertyVisualizationPreset,
    type AggregationMethod
} from '../types'

/**
 * Aggregation method options for the preset dropdown
 */
const AGGREGATION_METHOD_OPTIONS: Record<string, string> = {
    average: 'Average',
    sum: 'Sum'
}

/**
 * Color scheme options for the preset dropdown, derived from the shared
 * canonical list so the settings and context menu never drift apart.
 */
const COLOR_SCHEME_OPTIONS: Record<string, string> = Object.fromEntries(
    COLOR_SCHEME_OPTIONS_LIST.map((option) => [option.value, option.label])
)

/**
 * Renders and manages the "Visualizations" settings tab: global week-start /
 * animation settings and the visualization preset list. Extracted from the
 * settings tab to keep each module focused (issue #112).
 */
export class VisualizationPresetSection {
    constructor(
        private readonly plugin: LifeTrackerPlugin,
        private readonly requestRerender: () => void
    ) {}

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('First day of the week')
            .setDesc(
                'Starting day for week grouping and heatmap columns. ISO week labels stay Monday-based.'
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({ '1': 'Monday', '0': 'Sunday' })
                    .setValue(String(this.plugin.settings.weekStartsOn))
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.weekStartsOn = value === '0' ? 0 : 1
                        })
                    })
            })

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
                    this.requestRerender()
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
                    await this.plugin.updatePreset(preset.id, (p) => {
                        p.propertyNamePattern = value
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
                    await this.plugin.updatePreset(preset.id, (p) => {
                        p.visualizationType = value as VisualizationType
                        if (!supportsScale(p.visualizationType)) {
                            p.scale = undefined
                        }
                        if (!supportsColorScheme(p.visualizationType)) {
                            p.colorScheme = undefined
                        }
                        if (!supportsAggregationMethod(p.visualizationType)) {
                            p.aggregationMethod = undefined
                        }
                    })
                    this.requestRerender()
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
                        await this.plugin.updatePreset(preset.id, (p) => {
                            p.scale = scaleValue
                                ? { min: scaleValue.min, max: scaleValue.max }
                                : undefined
                        })
                    })
            })
        }

        // Color scheme dropdown (only for chart types)
        if (supportsColorScheme(preset.visualizationType)) {
            setting.addDropdown((dropdown) => {
                dropdown
                    .addOptions(COLOR_SCHEME_OPTIONS)
                    .setValue(preset.colorScheme ?? 'default')
                    .onChange(async (value) => {
                        await this.plugin.updatePreset(preset.id, (p) => {
                            p.colorScheme =
                                value === 'default' ? undefined : (value as ChartColorScheme)
                        })
                    })
            })
        }

        // Aggregation method dropdown (only for chart types that aggregate)
        if (supportsAggregationMethod(preset.visualizationType)) {
            setting.addDropdown((dropdown) => {
                dropdown
                    .addOptions(AGGREGATION_METHOD_OPTIONS)
                    .setValue(preset.aggregationMethod ?? DEFAULT_AGGREGATION_METHOD)
                    .onChange(async (value) => {
                        await this.plugin.updatePreset(preset.id, (p) => {
                            p.aggregationMethod =
                                value === DEFAULT_AGGREGATION_METHOD
                                    ? undefined
                                    : (value as AggregationMethod)
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
                    this.requestRerender()
                })
        })
    }

    private async addNewPreset(): Promise<void> {
        const newPreset: PropertyVisualizationPreset = {
            id: crypto.randomUUID(),
            propertyNamePattern: '',
            visualizationType: VisualizationType.Heatmap
        }
        await this.plugin.updateSettings(
            (draft) => {
                draft.visualizationPresets.push(newPreset)
            },
            { type: 'preset-added', presetId: newPreset.id }
        )
    }

    private async deletePreset(id: string): Promise<void> {
        await this.plugin.updateSettings(
            (draft) => {
                draft.visualizationPresets = draft.visualizationPresets.filter((p) => p.id !== id)
            },
            { type: 'preset-deleted', presetId: id }
        )
    }
}
