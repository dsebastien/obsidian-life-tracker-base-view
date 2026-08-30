/** Plugin id of the Templater plugin */
export const TEMPLATER_PLUGIN_ID = 'templater-obsidian'

/**
 * The parts of Templater's settings that decide whether it templates a file on
 * its own. Declared loosely because none of it is contractual.
 */
export interface TemplaterAutoFireSettings {
    trigger_on_file_creation?: unknown
    enable_folder_templates?: unknown
    folder_templates?: unknown
    enable_file_templates?: unknown
    file_templates?: unknown
}

function isEnabled(value: unknown): boolean {
    return value === true
}

/** The folder a vault path sits in; empty for a note at the vault root */
function parentFolder(path: string): string {
    const lastSlash = path.lastIndexOf('/')
    return lastSlash === -1 ? '' : path.slice(0, lastSlash)
}

/**
 * Whether a Templater folder-template entry covers a folder.
 *
 * Templater treats `/` as the vault root, matching everything. Any other value
 * matches its own folder and everything beneath it — so `Journal` covers
 * `Journal/2026`, but must not covers `Journal Archive`.
 */
function folderTemplateCovers(templateFolder: string, folder: string): boolean {
    const normalized = templateFolder.replace(/^\/+|\/+$/g, '')
    if (normalized.length === 0) return true
    return folder === normalized || folder.startsWith(`${normalized}/`)
}

/**
 * Whether Templater will template a newly created file at `path` by itself.
 *
 * This decides whether Life Tracker applies a template at all. Applying one on
 * top of a file Templater has already templated duplicates its whole contents,
 * and a vault configured with `trigger_on_file_creation` plus a folder template
 * on `/` — a dispatcher that picks a template per note type — templates
 * *everything*. Getting this wrong corrupts the very notes the feature exists to
 * create, so the decision is isolated here and tested directly.
 *
 * When this returns true the caller creates the file and leaves templating to
 * Templater, accepting that Templater may apply a different template than the
 * one configured: that is the user's own routing, and it is the only option
 * that cannot double-apply.
 */
export function templaterWillAutoApply(
    settings: TemplaterAutoFireSettings | null,
    path: string
): boolean {
    if (!settings || !isEnabled(settings.trigger_on_file_creation)) return false

    const folder = parentFolder(path)

    if (isEnabled(settings.enable_folder_templates) && Array.isArray(settings.folder_templates)) {
        for (const entry of settings.folder_templates) {
            if (!entry || typeof entry !== 'object') continue
            const candidate = entry as { folder?: unknown; template?: unknown }
            // An entry with no template configured templates nothing.
            if (typeof candidate.template !== 'string' || candidate.template.length === 0) continue
            if (typeof candidate.folder !== 'string') continue
            if (folderTemplateCovers(candidate.folder, folder)) return true
        }
    }

    if (isEnabled(settings.enable_file_templates) && Array.isArray(settings.file_templates)) {
        for (const entry of settings.file_templates) {
            if (!entry || typeof entry !== 'object') continue
            const candidate = entry as { regex?: unknown; template?: unknown }
            if (typeof candidate.template !== 'string' || candidate.template.length === 0) continue
            if (typeof candidate.regex !== 'string' || candidate.regex.length === 0) continue
            try {
                if (new RegExp(candidate.regex).test(path)) return true
            } catch {
                // A regex the user typed wrong is Templater's problem to report.
                // Here it simply matches nothing rather than breaking creation.
                continue
            }
        }
    }

    return false
}
