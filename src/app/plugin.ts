import { registerWhatsNewView } from './whats-new'
import { Plugin, type TFile } from 'obsidian'
import {
    DEFAULT_SETTINGS,
    sanitizeCaptureTargets,
    type PluginSettings,
    type PropertyDefinition,
    type BatchFilterMode,
    type FileProvider,
    type SettingsChangeCallback,
    type SettingsChangeInfo
} from './types'
import { LifeTrackerPluginSettingTab } from './settings/settings-tab'
import {
    allMigrationIds,
    readCompletedMigrations,
    runPendingMigrations
} from './settings/settings-migrations'
import {
    createCoalescingWriter,
    log,
    setCustomFilenameDatePatterns,
    setHighContrastMode,
    setWeekStartDay,
    isWeekStartDay
} from '../utils'
import { LifeTrackerView, LIFE_TRACKER_VIEW_TYPE } from './view/life-tracker-view'
import { getLifeTrackerViewOptions } from './view/view-options'
import { GridView, GRID_VIEW_TYPE } from './view/grid-view/grid-view'
import { getGridViewOptions } from './view/grid-view/grid-view-options'
import { registerCommands } from './commands'
import { syncCaptureTargetCommands } from './commands/capture-target-commands'
import { StarterKitService } from './services/starter-kit.service'
import { syncLinkedDefinitions } from './services/starter-kit.utils'

/** How long settings must stay still before the per-target commands re-sync */
const COMMAND_SYNC_DEBOUNCE_MS = 500

export class LifeTrackerPlugin extends Plugin {
    /**
     * The plugin settings.
     *
     * Replaced wholesale rather than mutated in place: `updateSettings` clones,
     * applies the update to the clone and swaps it in, so anything holding the
     * previous object keeps seeing a consistent snapshot.
     */
    override settings: PluginSettings = structuredClone(DEFAULT_SETTINGS)

    /**
     * Reads note types and properties from the Obsidian Starter Kit plugin,
     * when it is installed. Always safe to call — degrades to "not available".
     */
    starterKit!: StarterKitService

    /**
     * The settings tab, kept so a reload from disk can redraw it while open
     * (see `onExternalSettingsChange`). Null until `onload` registers it.
     */
    settingTab: LifeTrackerPluginSettingTab | null = null

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

        // The plugin may have been unloaded while settings were loading (hot
        // reload, a quick disable). Registering now would attach views,
        // commands and the obsidian:// handler to an unloaded component that
        // never cleans them up, and the next enable fails with "Action
        // life-tracker-quick-add is already registered".
        if (this.unloaded) {
            log('Unloaded while loading settings; skipping registration', 'debug')
            return
        }

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
        this.settingTab = new LifeTrackerPluginSettingTab(this.app, this)
        this.addSettingTab(this.settingTab)

        // Register commands
        registerCommands(this)
        // One "Capture today: <target>" per capture target, kept in step with
        // the settings (targets added, renamed or removed). Debounced: the
        // target name field saves on every keystroke
        syncCaptureTargetCommands(this)
        this.onSettingsChange(() => {
            this.scheduleCommandSync()
        })

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

    /** Set by `onunload`, so an `onload` still awaiting settings stops there */
    private unloaded = false

    /** Pending debounced command sync, 0 when none */
    private commandSyncTimer = 0

    /** Re-sync the per-target commands once settings stop changing */
    private scheduleCommandSync(): void {
        window.clearTimeout(this.commandSyncTimer)
        this.commandSyncTimer = window.setTimeout(() => {
            this.commandSyncTimer = 0
            if (!this.unloaded) syncCaptureTargetCommands(this)
        }, COMMAND_SYNC_DEBOUNCE_MS)
    }

    override onunload() {
        this.unloaded = true
        window.clearTimeout(this.commandSyncTimer)
    }

    /**
     * Called by Obsidian when `data.json` changes on disk outside the app
     * (Obsidian Sync, git, a hand edit). Without this, the in-memory settings
     * stay stale and the next save writes them back over the external change.
     *
     * Reloads only; nothing is saved, so the external file is kept as written.
     * A file that cannot be read (caught mid-write by a sync tool) or is gone
     * keeps the current settings: resetting to defaults there would let the
     * next save wipe every property definition.
     */
    override async onExternalSettingsChange(): Promise<void> {
        log('Settings changed on disk, reloading', 'debug')
        let loadedSettings: PluginSettings | null
        try {
            loadedSettings = (await this.loadData()) as PluginSettings | null
        } catch (error: unknown) {
            log('Could not read the changed settings, keeping the current ones', 'warn', error)
            return
        }
        if (!loadedSettings) {
            log('Settings file is empty or missing, keeping the current settings', 'warn')
            return
        }
        this.applyLoadedSettings(loadedSettings)
        this.notifySettingsChanged({ type: 'full' })
        // Views listen for changes, the settings tab does not (it would redraw
        // under the user's cursor on every keystroke): refresh it explicitly
        this.settingTab?.refreshFromSettings()
    }

    /**
     * Load the plugin settings
     */
    async loadSettings() {
        log('Loading settings', 'debug')
        const migrated = this.applyLoadedSettings((await this.loadData()) as PluginSettings | null)
        // Persist what a one-time migration changed, with its marker, so it
        // stays done even if nothing else is ever saved
        if (migrated) await this.saveSettings()
    }

    /**
     * Replace the in-memory settings with the contents of `data.json`, taking
     * each known field only when it has the right shape (defaults otherwise),
     * then run the one-time migrations not yet done.
     *
     * @returns whether a migration ran (the caller decides whether to save)
     */
    private applyLoadedSettings(loadedSettings: PluginSettings | null): boolean {
        if (!loadedSettings) {
            log('Using default settings', 'debug')
            this.settings = structuredClone(DEFAULT_SETTINGS)
            // Nothing to migrate in a fresh install: mark every migration
            // done so none can ever reset what the user sets from now on
            this.settings.completedMigrations = allMigrationIds()
            this.applyRuntimeSettings()
            return false
        }

        const draft = structuredClone(DEFAULT_SETTINGS)
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
            draft.propertyDefinitions =
                loadedSettings.propertyDefinitions.map(normalizeCaptureTargetId)
        }

        // Load confetti setting
        if (typeof loadedSettings.showConfettiOnCapture === 'boolean') {
            draft.showConfettiOnCapture = loadedSettings.showConfettiOnCapture
        }

        // Load capture auto-advance
        if (typeof loadedSettings.autoAdvanceOnPick === 'boolean') {
            draft.autoAdvanceOnPick = loadedSettings.autoAdvanceOnPick
        }

        // Load week start (0 = Sunday, 1 = Monday)
        if (isWeekStartDay(loadedSettings.weekStartsOn)) {
            draft.weekStartsOn = loadedSettings.weekStartsOn
        }

        // Load high contrast mode (issue #137)
        if (typeof loadedSettings.highContrast === 'boolean') {
            draft.highContrast = loadedSettings.highContrast
        }

        // Load note creation settings (issue #160)
        if (typeof loadedSettings.createMissingNotes === 'boolean') {
            draft.createMissingNotes = loadedSettings.createMissingNotes
        }
        if (typeof loadedSettings.dailyNoteTypeId === 'string') {
            draft.dailyNoteTypeId = loadedSettings.dailyNoteTypeId
        }

        // Load capture targets: field by field, malformed entries defaulted
        draft.captureTargets = sanitizeCaptureTargets(loadedSettings.captureTargets, () =>
            crypto.randomUUID()
        )

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

        // Migrations done: those recorded on disk, plus those this session
        // already ran. A file written by an older version (another device
        // through Sync) drops the field; a migration must still never run
        // twice, or it would reset what the user set after it
        draft.completedMigrations = [
            ...new Set([
                ...readCompletedMigrations(loadedSettings.completedMigrations),
                ...this.settings.completedMigrations
            ])
        ]
        const migrations = runPendingMigrations(draft)
        if (migrations.length > 0) log('Settings migrated', 'debug', migrations)

        this.settings = draft
        this.applyRuntimeSettings()
        log(`Settings loaded`, 'debug', loadedSettings)
        return migrations.length > 0
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
     * Push every setting that render code reads from module state rather than
     * from a prop: the date settings above, plus high contrast (issue #137),
     * which every color lookup consults.
     */
    private applyRuntimeSettings(): void {
        this.applyDateSettings()
        setHighContrastMode(this.settings.highContrast)
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
     * Update settings by mutating a private copy, then swapping it in.
     *
     * The updater is handed a deep clone, never the live object, so a partial
     * update cannot leave `this.settings` half-written and readers of the
     * previous object keep a consistent snapshot. Settings are plain data
     * (they round-trip through `data.json`), so `structuredClone` covers them.
     *
     * @param updater Function that receives a draft and can mutate it
     * @param changeInfo Information about what changed (for targeted updates)
     */
    async updateSettings(
        updater: (draft: PluginSettings) => void,
        changeInfo: SettingsChangeInfo = { type: 'full' }
    ): Promise<void> {
        const draft = structuredClone(this.settings)
        updater(draft)
        this.settings = draft
        this.applyRuntimeSettings()
        // Views follow memory, which is what the plugin runs on: notified
        // before the save, they stay in step even when the save fails
        this.notifySettingsChanged(changeInfo)
        await this.saveSettings()
    }

    /**
     * Update a specific visualization preset
     * Triggers a targeted update for views that use this preset
     */
    async updatePreset(
        presetId: string,
        updater: (preset: PluginSettings['visualizationPresets'][number]) => void
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

/**
 * Keep a definition's `captureTargetId` only when it is a string: a value of
 * another shape (hand edit, other version) would otherwise reach the target
 * resolver. Definitions without the field are returned untouched.
 */
function normalizeCaptureTargetId(definition: PropertyDefinition): PropertyDefinition {
    // A hand-edited data.json can hold anything here (null, a string): `in`
    // throws on those and would stop the plugin from loading
    if (!definition || typeof definition !== 'object') return definition
    if (!('captureTargetId' in definition)) return definition
    if (typeof definition.captureTargetId === 'string') return definition
    const { captureTargetId: _ignored, ...rest } = definition
    return rest
}
