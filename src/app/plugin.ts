import { Plugin, type TFile } from 'obsidian'
import {
    DEFAULT_SETTINGS,
    type PluginSettings,
    type BatchFilterMode,
    type FileProvider,
    type SettingsChangeCallback
} from './types'
import { LifeTrackerPluginSettingTab } from './settings/settings-tab'
import { log } from '../utils'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { LifeTrackerView, LIFE_TRACKER_VIEW_TYPE } from './view/life-tracker-view'
import { getLifeTrackerViewOptions } from './view/view-options'
import { GridView, GRID_VIEW_TYPE } from './view/grid-view/grid-view'
import { getGridViewOptions } from './view/grid-view/grid-view-options'
import { registerCommands } from './commands'

export class LifeTrackerPlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    /**
     * Listeners for settings changes
     */
    private settingsChangeListeners: Set<SettingsChangeCallback> = new Set()

    /**
     * Currently active file provider (base view that can provide files for batch capture)
     */
    private activeFileProvider: FileProvider | null = null

    /**
     * Register a file provider as active (called when view becomes visible)
     */
    setActiveFileProvider(provider: FileProvider | null): void {
        this.activeFileProvider = provider
    }

    /**
     * Get files from the active file provider (if any)
     */
    getActiveProviderFiles(): TFile[] | null {
        if (!this.activeFileProvider) return null
        return this.activeFileProvider.getFiles()
    }

    /**
     * Get filter mode from the active file provider (if any)
     */
    getActiveProviderFilterMode(): BatchFilterMode | null {
        if (!this.activeFileProvider) return null
        return this.activeFileProvider.getFilterMode()
    }

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

        // Register the Grid View
        const gridRegistered = this.registerBasesView(GRID_VIEW_TYPE, {
            name: 'Life Tracker Grid',
            icon: 'layout-grid',
            factory: (controller, containerEl) => new GridView(controller, containerEl, this),
            options: getGridViewOptions
        })

        if (gridRegistered) {
            log('Life Tracker Grid view registered', 'debug')
        }

        // Add a settings screen for the plugin
        this.addSettingTab(new LifeTrackerPluginSettingTab(this.app, this))

        // Register commands
        registerCommands(this)
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

        this.settings = produce(DEFAULT_SETTINGS, (draft: Draft<PluginSettings>) => {
            // Load visualization presets
            if (Array.isArray(loadedSettings.visualizationPresets)) {
                draft.visualizationPresets = loadedSettings.visualizationPresets
            }

            // Load animation duration
            if (typeof loadedSettings.animationDuration === 'number') {
                draft.animationDuration = loadedSettings.animationDuration
            }

            // Load property definitions
            if (Array.isArray(loadedSettings.propertyDefinitions)) {
                draft.propertyDefinitions = loadedSettings.propertyDefinitions
            }

            // Load confetti setting
            if (typeof loadedSettings.showConfettiOnCapture === 'boolean') {
                draft.showConfettiOnCapture = loadedSettings.showConfettiOnCapture
            }
        })

        log(`Settings loaded`, 'debug', loadedSettings)
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
        this.notifySettingsChanged()
    }

    /**
     * Register a callback to be notified when settings change
     * @param callback Function to call when settings change
     * @returns Function to unregister the callback
     */
    onSettingsChange(callback: SettingsChangeCallback): () => void {
        this.settingsChangeListeners.add(callback)
        return () => {
            this.settingsChangeListeners.delete(callback)
        }
    }

    /**
     * Notify all listeners that settings have changed
     */
    private notifySettingsChanged(): void {
        for (const listener of this.settingsChangeListeners) {
            try {
                listener(this.settings)
            } catch (error) {
                log('Error in settings change listener', 'error', error)
            }
        }
    }
}
