import type { Plugin } from 'obsidian'
// Bundled at build time; the release workflow regenerates CHANGELOG.md before
// building, so the dialog always carries the notes of the version it ships in.
import changelog from '../../CHANGELOG.md' with { type: 'text' }
import { compareSemver, extractReleaseNotes } from './utils/release-notes'
import { WhatsNewModal } from './ui/whats-new-modal'

const STORAGE_KEY_SUFFIX = ':whats-new-last-seen-version'

/**
 * Show the "What's new" dialog once after a plugin update.
 *
 * Call this as the FIRST statement of `onload`, before anything can call
 * `saveData`: fresh-install detection relies on reading the pre-existing
 * plugin data. The dialog is shown at most once per version per device
 * (tracked via vault-scoped localStorage), only when the version increased,
 * and never on a fresh install or a plain restart.
 */
export function registerWhatsNewDialog(plugin: Plugin): void {
    // Captured before the plugin's own settings handling may persist defaults.
    const preexistingData = plugin.loadData().catch((): null => null)
    plugin.app.workspace.onLayoutReady(() => {
        void maybeShowWhatsNew(plugin, preexistingData)
    })
}

async function maybeShowWhatsNew(plugin: Plugin, preexistingData: Promise<unknown>): Promise<void> {
    const { app, manifest } = plugin
    const storageKey = `${manifest.id}${STORAGE_KEY_SUFFIX}`
    const lastSeen: unknown = app.loadLocalStorage(storageKey)
    const current = manifest.version

    if (lastSeen === current) {
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
    } else if (compareSemver(current, lastSeen) <= 0) {
        // Downgrade or sideways move: record it silently.
        return
    }

    const sinceVersion = 'string' === typeof lastSeen ? lastSeen : undefined
    const notes = extractReleaseNotes(changelog, current, sinceVersion)
    new WhatsNewModal(app, manifest, notes).open()
}
