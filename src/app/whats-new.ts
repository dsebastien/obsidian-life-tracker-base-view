import type { Plugin } from 'obsidian'
// Bundled at build time; the release workflow regenerates CHANGELOG.md before
// building, so the view always carries the notes of the version it ships in.
import changelog from '../../CHANGELOG.md' with { type: 'text' }
import { compareSemver, extractReleaseNotes } from './utils/release-notes'
import { createWhatsNewViewCreator, getWhatsNewViewType } from './ui/whats-new-view'
import type { WhatsNewEntry } from './ui/whats-new-view'

const STORAGE_KEY_SUFFIX = ':whats-new-last-seen-version'

/**
 * Register and, after an update, open the "What's new" tab.
 *
 * Call this as the FIRST statement of `onload`, before anything can call
 * `saveData`: fresh-install detection relies on reading the pre-existing
 * plugin data, and the view must be registered synchronously so a tab restored
 * with the workspace layout resolves.
 *
 * The tab opens at most once per version per device (tracked via vault-scoped
 * localStorage), only when the version increased, and never on a fresh install
 * or a plain restart. Each plugin owns its own view type, so several plugins
 * updated at once each open their own tab. Tabs are detached when the plugin
 * unloads.
 */
export function registerWhatsNewView(plugin: Plugin): void {
    // Captured before the plugin's own settings handling may persist defaults.
    const preexistingData = plugin.loadData().catch((): null => null)
    const viewType = getWhatsNewViewType(plugin.manifest.id)
    let unloaded = false
    // Resolved lazily: a restored tab renders the current version's notes.
    let sinceVersion: string | undefined

    const buildEntry = (): WhatsNewEntry => ({
        pluginId: plugin.manifest.id,
        pluginName: plugin.manifest.name,
        version: plugin.manifest.version,
        notesMarkdown: extractReleaseNotes(changelog, plugin.manifest.version, sinceVersion)
    })

    plugin.registerView(viewType, createWhatsNewViewCreator(viewType, buildEntry))
    plugin.register(() => {
        unloaded = true
        plugin.app.workspace.detachLeavesOfType(viewType)
    })

    plugin.app.workspace.onLayoutReady(() => {
        void (async (): Promise<void> => {
            if (unloaded) {
                return
            }
            const lastSeen = await consumeUpdate(plugin, preexistingData)
            if (undefined === lastSeen || unloaded) {
                return
            }
            sinceVersion = '' !== lastSeen ? lastSeen : undefined
            await openWhatsNewTab(plugin, viewType)
        })()
    })
}

/**
 * Decide whether this load is an update worth announcing, and record the new
 * version either way. Returns `{ value }` semantics via a sentinel: `undefined`
 * means "say nothing"; a string (possibly empty) is the previously seen
 * version, with `''` meaning "no recorded version, but the plugin had data".
 */
async function consumeUpdate(
    plugin: Plugin,
    preexistingData: Promise<unknown>
): Promise<string | undefined> {
    const { app, manifest } = plugin
    const storageKey = `${manifest.id}${STORAGE_KEY_SUFFIX}`
    const lastSeen: unknown = app.loadLocalStorage(storageKey)
    const current = manifest.version

    if (lastSeen === current) {
        return undefined
    }
    // Downgrade or sideways move: keep the stored high-water mark untouched so
    // a later re-upgrade does not re-show notes the user already saw.
    if ('string' === typeof lastSeen && compareSemver(current, lastSeen) <= 0) {
        return undefined
    }
    app.saveLocalStorage(storageKey, current)

    if ('string' !== typeof lastSeen) {
        // First run with this feature on this device. Only treat it as an
        // update when the plugin already has stored data; a fresh install must
        // not greet the user with a tab.
        if (null == (await preexistingData)) {
            return undefined
        }
        return ''
    }
    return lastSeen
}

/** Open the plugin's tab, or reveal it when one is already around. */
async function openWhatsNewTab(plugin: Plugin, viewType: string): Promise<void> {
    const { workspace } = plugin.app
    const existing = workspace.getLeavesOfType(viewType)[0]
    if (existing) {
        await workspace.revealLeaf(existing)
        return
    }
    const leaf = workspace.getLeaf('tab')
    await leaf.setViewState({ type: viewType, active: true })
    await workspace.revealLeaf(leaf)
}
