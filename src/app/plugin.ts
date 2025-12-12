import { Plugin } from 'obsidian'
import { DEFAULT_SETTINGS } from './types/plugin-settings.intf'
import type { PluginSettings } from './types/plugin-settings.intf'
import { LifeTrackerBaseViewPluginSettingTab } from './settings/settings-tab'
import { log } from '../utils/log'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { LifeTrackerView, LIFE_TRACKER_VIEW_TYPE } from './view/life-tracker-view'
import { getLifeTrackerViewOptions } from './view/view-options'

export class LifeTrackerBaseViewPlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    /**
     * Executed as soon as the plugin loads
     */
    override async onload() {
        log('Initializing', 'debug')
        await this.loadSettings()

        // Register the Life Tracker Base View
        const registered = this.registerBasesView(LIFE_TRACKER_VIEW_TYPE, {
            name: 'Life Tracker',
            icon: 'activity',
            factory: (controller, containerEl) =>
                new LifeTrackerView(controller, containerEl, this),
            options: getLifeTrackerViewOptions
        })

        if (!registered) {
            log('Bases feature is not enabled in this vault', 'warn')
        } else {
            log('Life Tracker view registered', 'debug')
        }

        // Add a settings screen for the plugin
        this.addSettingTab(new LifeTrackerBaseViewPluginSettingTab(this.app, this))
    }

    override onunload() {}

    /**
     * Load the plugin settings
     */
    async loadSettings() {
        log('Loading settings', 'debug')
        const loadedSettings = (await this.loadData()) as PluginSettings | null

        if (!loadedSettings) {
            log('Using default settings', 'debug')
            this.settings = produce(DEFAULT_SETTINGS, (draft) => draft)
            return
        }

        let needToSaveSettings = false

        this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
            // Load enabled setting
            if (loadedSettings.enabled !== undefined) {
                draft.enabled = loadedSettings.enabled
            } else {
                log('The loaded settings miss the [enabled] property', 'debug')
                needToSaveSettings = true
            }

            // Load visualization presets
            if (Array.isArray(loadedSettings.visualizationPresets)) {
                draft.visualizationPresets = loadedSettings.visualizationPresets
            }

            // Load animation duration
            if (typeof loadedSettings.animationDuration === 'number') {
                draft.animationDuration = loadedSettings.animationDuration
            }
        })

        log(`Settings loaded`, 'debug', loadedSettings)

        if (needToSaveSettings) {
            this.saveSettings()
        }
    }

    /**
     * Save the plugin settings
     */
    async saveSettings() {
        log('Saving settings', 'debug', this.settings)
        await this.saveData(this.settings)
        log('Settings saved', 'debug', this.settings)
    }

    /**
     * Update settings immutably using immer
     * @param updater Function that receives a draft and can mutate it
     */
    async updateSettings(updater: (draft: Draft<PluginSettings>) => void): Promise<void> {
        this.settings = produce(this.settings, updater)
        await this.saveSettings()
    }
}
