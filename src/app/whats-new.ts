import type { Plugin } from 'obsidian'
// Bundled at build time; the release workflow regenerates CHANGELOG.md before
// building, so the dialog always carries the notes of the version it ships in.
import changelog from '../../CHANGELOG.md' with { type: 'text' }
import { compareSemver, extractReleaseNotes } from './utils/release-notes'
import { WhatsNewModal, isAnyWhatsNewDialogOpen } from './ui/whats-new-modal'

const STORAGE_KEY_SUFFIX = ':whats-new-last-seen-version'

/**
 * Show the "What's new" dialog once after a plugin update.
 *
 * Call this as the FIRST statement of `onload`, before anything can call
 * `saveData`: fresh-install detection relies on reading the pre-existing
 * plugin data. The dialog is shown at most once per version per device
 * (tracked via vault-scoped localStorage), only when the version increased,
 * and never on a fresh install or a plain restart. The modal is closed if
 * the plugin unloads while it is open.
 */
export function registerWhatsNewDialog(plugin: Plugin): void {
    // Captured before the plugin's own settings handling may persist defaults.
    const preexistingData = plugin.loadData().catch((): null => null)
    let unloaded = false
    let modal: WhatsNewModal | null = null
    plugin.register(() => {
        unloaded = true
        modal?.close()
        modal = null
    })
    plugin.app.workspace.onLayoutReady(() => {
        void (async (): Promise<void> => {
            const shown = await maybeShowWhatsNew(plugin, preexistingData, () => unloaded)
            if (shown && unloaded) {
                // Unload raced the async gap: close immediately.
                shown.close()
            } else {
                modal = shown
            }
        })()
    })
}

async function maybeShowWhatsNew(
    plugin: Plugin,
    preexistingData: Promise<unknown>,
    isUnloaded: () => boolean
): Promise<WhatsNewModal | null> {
    const { app, manifest } = plugin
    const storageKey = `${manifest.id}${STORAGE_KEY_SUFFIX}`
    const lastSeen: unknown = app.loadLocalStorage(storageKey)
    const current = manifest.version

    if (lastSeen === current) {
        return null
    }
    // Downgrade or sideways move: keep the stored high-water mark untouched so
    // a later re-upgrade does not re-show notes the user already saw.
    if ('string' === typeof lastSeen && compareSemver(current, lastSeen) <= 0) {
        return null
    }
    app.saveLocalStorage(storageKey, current)

    if ('string' !== typeof lastSeen) {
        // First run with this feature on this device. Only treat it as an
        // update when the plugin already has stored data; a fresh install
        // must not greet the user with a dialog.
        if (null == (await preexistingData)) {
            return null
        }
    }
    if (isUnloaded()) {
        return null
    }
    // At most one what's-new dialog at a time across every plugin shipping
    // this feature: a bulk "Update all" would otherwise stack one modal per
    // plugin. Skipped plugins recorded the version above, so they stay silent.
    if (isAnyWhatsNewDialogOpen()) {
        return null
    }

    const sinceVersion = 'string' === typeof lastSeen ? lastSeen : undefined
    const notes = extractReleaseNotes(changelog, current, sinceVersion)
    const modal = new WhatsNewModal(app, manifest, notes)
    modal.open()
    return modal
}
