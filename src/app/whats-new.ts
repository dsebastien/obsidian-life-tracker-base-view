import type { Plugin } from 'obsidian'
// Bundled at build time; the release workflow regenerates CHANGELOG.md before
// building, so the dialog always carries the notes of the version it ships in.
import changelog from '../../CHANGELOG.md' with { type: 'text' }
import { compareSemver, extractReleaseNotes } from './utils/release-notes'
import { WhatsNewModal, getWhatsNewRegistry, isAnyWhatsNewDialogOpen } from './ui/whats-new-modal'
import type { WhatsNewEntry } from './ui/whats-new-modal'

const STORAGE_KEY_SUFFIX = ':whats-new-last-seen-version'
/**
 * Collection window before the dialog opens, so plugins updated in the same
 * burst (e.g. "Update all") aggregate into one dialog instead of stacking.
 */
const AGGREGATION_DELAY_MS = 400

/**
 * Show the "What's new" dialog once after a plugin update.
 *
 * Call this as the FIRST statement of `onload`, before anything can call
 * `saveData`: fresh-install detection relies on reading the pre-existing
 * plugin data. The dialog is shown at most once per version per device
 * (tracked via vault-scoped localStorage), only when the version increased,
 * and never on a fresh install or a plain restart. Simultaneously updated
 * sibling plugins share a single aggregated dialog; the dialog closes if the
 * plugin that opened it unloads, and a pending entry is withdrawn when its
 * plugin unloads first.
 */
export function registerWhatsNewDialog(plugin: Plugin): void {
    // Captured before the plugin's own settings handling may persist defaults.
    const preexistingData = plugin.loadData().catch((): null => null)
    let unloaded = false
    plugin.register(() => {
        unloaded = true
        const registry = getWhatsNewRegistry()
        registry.pending = registry.pending.filter((entry) => entry.pluginId !== plugin.manifest.id)
        if (registry.ownerId === plugin.manifest.id) {
            registry.close?.()
        }
    })
    plugin.app.workspace.onLayoutReady(() => {
        void (async (): Promise<void> => {
            if (unloaded) {
                return
            }
            await maybeQueueWhatsNew(plugin, preexistingData, () => unloaded)
        })()
    })
}

async function maybeQueueWhatsNew(
    plugin: Plugin,
    preexistingData: Promise<unknown>,
    isUnloaded: () => boolean
): Promise<void> {
    const { app, manifest } = plugin
    const storageKey = `${manifest.id}${STORAGE_KEY_SUFFIX}`
    const lastSeen: unknown = app.loadLocalStorage(storageKey)
    const current = manifest.version

    if (lastSeen === current) {
        return
    }
    // Downgrade or sideways move: keep the stored high-water mark untouched so
    // a later re-upgrade does not re-show notes the user already saw.
    if ('string' === typeof lastSeen && compareSemver(current, lastSeen) <= 0) {
        return
    }
    app.saveLocalStorage(storageKey, current)

    if ('string' !== typeof lastSeen) {
        // First run with this feature on this device. Only treat it as an
        // update when the plugin already has stored data; a fresh install
        // must not greet the user with a dialog.
        if (null == (await preexistingData)) {
            return
        }
    }
    if (isUnloaded()) {
        return
    }

    const sinceVersion = 'string' === typeof lastSeen ? lastSeen : undefined
    const entry: WhatsNewEntry = {
        pluginId: manifest.id,
        pluginName: manifest.name,
        version: current,
        notesMarkdown: extractReleaseNotes(changelog, current, sinceVersion)
    }

    const registry = getWhatsNewRegistry()
    if (registry.open) {
        // A sibling's dialog is on screen: join it live.
        registry.append?.(entry)
        return
    }
    if (isAnyWhatsNewDialogOpen()) {
        // An older version of this feature (another plugin) shows a dialog it
        // cannot share; stay silent — the version is already recorded.
        return
    }

    registry.pending.push(entry)
    if (undefined !== registry.timer) {
        window.clearTimeout(registry.timer)
    }
    registry.timer = window.setTimeout(() => {
        registry.timer = undefined
        const entries = registry.pending.splice(0, registry.pending.length)
        if (0 === entries.length || registry.open || isAnyWhatsNewDialogOpen()) {
            return
        }
        new WhatsNewModal(app, manifest.id, entries).open()
    }, AGGREGATION_DELAY_MS)
}
