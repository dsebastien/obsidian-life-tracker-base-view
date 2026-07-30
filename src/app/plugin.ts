import { registerWhatsNewView } from './whats-new'
import { Plugin, type TFile } from 'obsidian'
import {
    DEFAULT_SETTINGS,
    type PluginSettings,
    type BatchFilterMode,
    type FileProvider,
    type SettingsChangeCallback,
    type SettingsChangeInfo
} from './types'
import { LifeTrackerPluginSettingTab } from './settings/settings-tab'
import {
    createCoalescingWriter,
    log,
    setCustomFilenameDatePatterns,
    setWeekStartDay
} from '../utils'
import { produce } from 'immer'
import type { Draft } from 'immer'
import { LifeTrackerView, LIFE_TRACKER_VIEW_TYPE } from './view/life-tracker-view'
import { getLifeTrackerViewOptions } from './view/view-options'
import { GridView, GRID_VIEW_TYPE } from './view/grid-view/grid-view'
import { getGridViewOptions } from './view/grid-view/grid-view-options'
import { registerCommands } from './commands'
import { StarterKitService } from './services/starter-kit.service'
import { syncLinkedDefinitions } from './services/starter-kit.utils'

export class LifeTrackerPlugin extends Plugin {
    /**
     * The plugin settings are immutable
     */
    settings: PluginSettings = produce(DEFAULT_SETTINGS, () => DEFAULT_SETTINGS)

    /**
     * Reads note types and properties from the Obsidian Starter Kit plugin,
     * when it is installed. Always safe to call — degrades to "not available".
     */
    starterKit!: StarterKitService

    /**
     * Listeners for settings changes
     */
    private settingsChangeListeners: Set<SettingsChangeCallback> = new Set()

    /**
     * Serializes and coalesces settings writes (see `saveSettings`).
     */
    private readonly enqueueSave = createCoalescingWriter(async () => {
        log('Saving settings', 'debug', this.settings)
        await this.saveData(this.settings)
        log('Settings saved', 'debug', this.settings)
    })

    /**
     * Registered file providers (base views that can provide files for batch
     * capture), ordered least → most recently active. Several views can be
     * open at once (split panes); the most recently interacted-with one wins
     * (issue #96: a single slot meant "last constructed wins", and unloading
     * any view cleared the provider of the others).
     */
    private fileProviders: FileProvider[] = []

    /**
     * Register a file provider, or mark an already-registered one as the
     * most recently active. Called on view creation and on user interaction
     * with the view.
     */
    touchFileProvider(provider: FileProvider): void {
        const index = this.fileProviders.indexOf(provider)
        if (index !== -1) {
            this.fileProviders.splice(index, 1)
        }
        this.fileProviders.push(provider)
    }

    /**
     * Unregister a file provider (called when its view unloads)
     */
    removeFileProvider(provider: FileProvider): void {
        const index = this.fileProviders.indexOf(provider)
        if (index !== -1) {
            this.fileProviders.splice(index, 1)
        }
    }

    /**
     * The most recently active file provider (if any)
     */
    private getActiveFileProvider(): FileProvider | null {
        return this.fileProviders[this.fileProviders.length - 1] ?? null
    }

    /**
     * Get files from the active file provider (if any)
     */
    getActiveProviderFiles(): TFile[] | null {
        return this.getActiveFileProvider()?.getFiles() ?? null
    }

    /**
     * Get filter mode from the active file provider (if any)
     */
    getActiveProviderFilterMode(): BatchFilterMode | null {
        return this.getActiveFileProvider()?.getFilterMode() ?? null
    }

    /**
     * Executed as soon as the plugin loads
     */
    override async onload() {
        // Must run before anything can call saveData (fresh-install detection)
        registerWhatsNewView(this)
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

        this.starterKit = new StarterKitService(this.app)

        // Add a settings screen for the plugin
        this.addSettingTab(new LifeTrackerPluginSettingTab(this.app, this))

        // Register commands
        registerCommands(this)

        // Refresh Starter Kit-linked definitions once every plugin has loaded:
        // during our own onload, Starter Kit may not be registered yet
        this.app.workspace.onLayoutReady(() => {
            // Never let a Starter Kit problem surface as an unhandled rejection
            // during startup
            void this.syncStarterKitDefinitions().catch((error: unknown) => {
                log('Starter Kit sync failed', 'warn', error)
            })
        })
    }

    /**
     * Re-read the structure of every Starter Kit-linked property definition.
     *
     * A no-op when Starter Kit is absent, when nothing is linked, or when the
     * structure already matches — so a normal startup writes nothing. Never
     * removes a definition whose source has disappeared: Starter Kit may simply
     * be mid-edit, and the user's tracked property must survive that.
     *
     * @returns whether anything changed
     */
    async syncStarterKitDefinitions(): Promise<boolean> {
        const sources = this.starterKit.collectSources()
        if (sources.length === 0) return false

        const synced = syncLinkedDefinitions(this.settings.propertyDefinitions, sources)
        if (!synced) return false

        log('Syncing Starter Kit-linked property definitions', 'debug')
        await this.updateSettings(
            (draft) => {
                draft.propertyDefinitions = synced
            },
            { type: 'property-definitions-changed' }
        )
        return true
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
            this.applyDateSettings()
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

            // Load week start (0 = Sunday, 1 = Monday)
            if (loadedSettings.weekStartsOn === 0 || loadedSettings.weekStartsOn === 1) {
                draft.weekStartsOn = loadedSettings.weekStartsOn
            }

            // Load custom filename date patterns (issue #139). Entries can be
            // hand-edited in data.json, so keep anything with a usable pattern
            // and backfill missing ids (the settings UI keys on them).
            if (Array.isArray(loadedSettings.filenameDatePatterns)) {
                draft.filenameDatePatterns = loadedSettings.filenameDatePatterns
                    .filter((entry) => typeof entry?.pattern === 'string')
                    .map((entry) => ({
                        id: entry.id ? entry.id : crypto.randomUUID(),
                        pattern: entry.pattern
                    }))
            }
        })

        this.applyDateSettings()
        log(`Settings loaded`, 'debug', loadedSettings)
    }

    /**
     * Push date-related settings into the date utilities: the week start so
     * week grouping and heatmap columns honor the user's preference (issue
     * #99), and the custom filename date patterns used to resolve date anchors
     * from filenames (issue #139).
     */
    private applyDateSettings(): void {
        setWeekStartDay(this.settings.weekStartsOn)
        setCustomFilenameDatePatterns(
            this.settings.filenameDatePatterns.map((entry) => entry.pattern)
        )
    }

    /**
     * Save the plugin settings.
     *
     * Writes are serialized *and* coalesced (see `createCoalescingWriter`).
     * Settings editors call `updateSettings` on every keystroke: without
     * serialization two saves can be in flight at once and land out of order,
     * leaving the older snapshot on disk; without coalescing, a burst of
     * keystrokes queues one redundant write per character.
     *
     * The write always persists `this.settings` as it is when it runs, so the
     * newest state is what reaches disk.
     */
    async saveSettings() {
        await this.enqueueSave()
    }

    /**
     * Update settings immutably using immer
     * @param updater Function that receives a draft and can mutate it
     * @param changeInfo Information about what changed (for targeted updates)
     */
    async updateSettings(
        updater: (draft: Draft<PluginSettings>) => void,
        changeInfo: SettingsChangeInfo = { type: 'full' }
    ): Promise<void> {
        this.settings = produce(this.settings, updater)
        this.applyDateSettings()
        await this.saveSettings()
        this.notifySettingsChanged(changeInfo)
    }

    /**
     * Update a specific visualization preset
     * Triggers a targeted update for views that use this preset
     */
    async updatePreset(
        presetId: string,
        updater: (preset: Draft<PluginSettings['visualizationPresets'][number]>) => void
    ): Promise<void> {
        await this.updateSettings(
            (draft) => {
                const preset = draft.visualizationPresets.find((p) => p.id === presetId)
                if (preset) {
                    updater(preset)
                }
            },
            { type: 'preset-updated', presetId }
        )
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
     * @param changeInfo Information about what changed
     */
    private notifySettingsChanged(changeInfo: SettingsChangeInfo): void {
        for (const listener of this.settingsChangeListeners) {
            try {
                listener(this.settings, changeInfo)
            } catch (error) {
                log('Error in settings change listener', 'error', error)
            }
        }
    }
}
