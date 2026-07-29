/**
 * Pure helpers describing the identity of the "What's new" view. Kept out of
 * the view module so they can be unit tested without the Obsidian runtime.
 *
 * Each plugin registers its own view type, so several plugins updated in the
 * same session each get their own tab instead of sharing one dialog.
 */

/** Marker class shared by every plugin shipping this view (test hook). */
export const WHATS_NEW_MARKER_CLASS = 'whats-new-view'

/** Per-plugin view type, unique across the plugins shipping this feature. */
export function getWhatsNewViewType(pluginId: string): string {
    return `${pluginId}-whats-new`
}

/** Tab title. Kept short: tab headers truncate aggressively. */
export function getWhatsNewTitle(pluginName: string, version: string): string {
    return `What's new: ${pluginName} ${version}`
}
