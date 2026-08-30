/** Plugin id of the Templater plugin */
export const TEMPLATER_PLUGIN_ID = 'templater-obsidian'

/**
 * The parts of Templater's settings that decide whether it templates a file on
 * its own. Declared loosely because none of it is contractual.
 */
export interface TemplaterAutoFireSettings {
    trigger_on_file_creation?: unknown
    /**
     * Templater 2.x: `'none' | 'folder' | 'regex'`. This is the real runtime
     * gate. The older `enable_folder_templates` / `enable_file_templates`
     * booleans still exist in 2.25 but only drive settings-pane visibility, so
     * they must not be trusted alone — a vault can carry a stale `true` while
     * the mode says `none`.
     */
    trigger_on_file_creation_mode?: unknown
    enable_folder_templates?: unknown
    folder_templates?: unknown
    enable_file_templates?: unknown
    file_templates?: unknown
    ignore_folders_on_creation?: unknown
}

function isEnabled(value: unknown): boolean {
    return value === true
}

/** The folder a vault path sits in; empty for a note at the vault root */
function parentFolder(path: string): string {
    const lastSlash = path.lastIndexOf('/')
    return lastSlash === -1 ? '' : path.slice(0, lastSlash)
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '')
}

/**
 * Whether a Templater folder-template entry covers a folder.
 *
 * Templater treats `/` as the vault root, matching everything. Any other value
 * matches its own folder and everything beneath it — so `Journal` covers
 * `Journal/2026`, but must not cover `Journal Archive`.
 */
function folderTemplateCovers(templateFolder: string, folder: string): boolean {
    const normalized = trimSlashes(templateFolder)
    if (normalized.length === 0) return true
    return folder === normalized || folder.startsWith(`${normalized}/`)
}

/**
 * Which trigger mode is in effect.
 *
 * Falls back to the legacy booleans only when the mode key is absent, which is
 * how a Templater predating it presents itself.
 */
function resolveMode(settings: TemplaterAutoFireSettings): 'none' | 'folder' | 'regex' {
    const mode = settings.trigger_on_file_creation_mode
    if (mode === 'folder' || mode === 'regex' || mode === 'none') return mode
    if (mode !== undefined) return 'none'

    if (isEnabled(settings.enable_folder_templates)) return 'folder'
    if (isEnabled(settings.enable_file_templates)) return 'regex'
    return 'none'
}

/**
 * Whether a path sits under one of Templater's ignored folders.
 *
 * Mirrors Templater's own test — a plain `startsWith` on the normalized folder,
 * with the empty string ignoring nothing — deliberately, including its
 * looseness: matching more strictly here would claim Templater templates a file
 * it actually skips, and the note would come out empty.
 */
function isIgnored(settings: TemplaterAutoFireSettings, path: string): boolean {
    if (!Array.isArray(settings.ignore_folders_on_creation)) return false

    for (const entry of settings.ignore_folders_on_creation) {
        if (!entry || typeof entry !== 'object') continue
        const folder = (entry as { folder?: unknown }).folder
        if (typeof folder !== 'string') continue
        const normalized = trimSlashes(folder)
        if (normalized.length > 0 && path.startsWith(normalized)) return true
    }
    return false
}

/**
 * Whether Templater will template a newly created file at `path` by itself.
 *
 * This decides whether Life Tracker applies a template at all. Applying one on
 * top of a file Templater has already templated duplicates its whole contents,
 * and a vault configured with `trigger_on_file_creation` plus a folder template
 * on `/` — a dispatcher that picks a template per note type — templates
 * *everything*. Getting this wrong either duplicates a note or leaves it empty,
 * so the decision is isolated here and tested directly.
 *
 * Modelled on Templater 2.25's actual creation hook, which ignores configured
 * folders, waits, skips files it created itself, and then applies a folder
 * template only when the file is still empty and the mode is `folder`.
 *
 * Note this answers the question only for a file Life Tracker creates *plainly*.
 * A file created through Templater's own `create_new_note_from_template` is
 * registered as pending and never templated twice, so the caller does not need
 * to consult this for that path.
 */
export function templaterWillAutoApply(
    settings: TemplaterAutoFireSettings | null,
    path: string
): boolean {
    if (!settings || !isEnabled(settings.trigger_on_file_creation)) return false
    if (isIgnored(settings, path)) return false

    const mode = resolveMode(settings)
    const folder = parentFolder(path)

    if (mode === 'folder' && Array.isArray(settings.folder_templates)) {
        for (const entry of settings.folder_templates) {
            if (!entry || typeof entry !== 'object') continue
            const candidate = entry as { folder?: unknown; template?: unknown }
            // An entry with no template configured templates nothing.
            if (typeof candidate.template !== 'string' || candidate.template.length === 0) continue
            if (typeof candidate.folder !== 'string') continue
            if (folderTemplateCovers(candidate.folder, folder)) return true
        }
    }

    if (mode === 'regex' && Array.isArray(settings.file_templates)) {
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
