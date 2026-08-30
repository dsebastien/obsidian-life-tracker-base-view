import { TimeGranularity } from '../app/types/visualization/time-granularity.intf'
import { renderDateTokens } from './filename-date.utils'

/**
 * Where a periodic note for a date should live.
 *
 * `folder` is the dirname of `path`, not the configured folder: a date format
 * may itself contribute directories (Periodic Notes' `YYYY/WW/YYYY-MM-DD`, the
 * Starter Kit's `{{year}}/{{week}}`), and those have to exist before the file
 * can be created.
 */
export interface ResolvedNoteTarget {
    /** Vault-relative path, including the `.md` extension */
    path: string
    /** Folder that must exist before creating `path`; empty for the vault root */
    folder: string
}

/**
 * Formats a date with a moment format string.
 *
 * Injected rather than imported so the path logic stays free of Obsidian:
 * callers pass Obsidian's bundled `moment`, tests pass whatever they like.
 */
export type MomentFormatter = (date: Date, format: string) => string

/**
 * Default basename format per granularity, as a moment format string.
 *
 * These mirror the built-in filename patterns Life Tracker already *parses*
 * (`YYYY-MM-DD`, `YYYY-Www`, `YYYY-MM`, `YYYY-Qq`, `YYYY`), so a note this
 * plugin creates is a note this plugin can find again.
 *
 * The weekly format uses moment's **ISO** week tokens (`GGGG`/`WW`), not the
 * locale ones (`gggg`/`ww`). Life Tracker resolves week filenames through
 * `getDateFromISOWeek`, and the two disagree: with an en locale, Sunday
 * 2026-08-30 *ends* ISO week 35 but *starts* locale week 36. Locale tokens
 * would emit a name this plugin reads back as a different week.
 *
 * Needed for the Starter Kit path only: a Starter Kit note type records a
 * folder, a template and name affixes, but no filename format.
 */
export const DEFAULT_BASENAME_FORMAT: Readonly<Record<TimeGranularity, string>> = {
    [TimeGranularity.Daily]: 'YYYY-MM-DD',
    [TimeGranularity.Weekly]: 'GGGG-[W]WW',
    [TimeGranularity.Monthly]: 'YYYY-MM',
    [TimeGranularity.Quarterly]: 'YYYY-[Q]Q',
    [TimeGranularity.Yearly]: 'YYYY'
}

/**
 * Join a folder and a basename into a vault path.
 *
 * An empty folder yields a root-relative path with no leading slash: Obsidian
 * treats `/Note.md` and `Note.md` as different paths, and only the latter
 * exists.
 */
function toVaultPath(folder: string, basename: string): string {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    const cleanBase = basename.replace(/^\/+|\/+$/g, '')
    return cleanFolder ? `${cleanFolder}/${cleanBase}.md` : `${cleanBase}.md`
}

/**
 * Split a full path back into the folder that must exist and the path itself.
 */
function toTarget(path: string): ResolvedNoteTarget {
    const lastSlash = path.lastIndexOf('/')
    return { path, folder: lastSlash === -1 ? '' : path.slice(0, lastSlash) }
}

/** A Starter Kit note type, reduced to what locating a note needs */
export interface StarterKitNoteTarget {
    /** May contain `{{token}}`s, e.g. `40 Journal/41 Daily Notes/{{year}}/{{week}}` */
    associatedFolder: string | null
    noteNamePrefix: string | null
    noteNameSuffix: string | null
}

/** A Periodic Notes per-granularity config, reduced to what locating a note needs */
export interface PeriodicNotesNoteTarget {
    folder: string
    /** moment format; may contain `/`, contributing subfolders */
    format: string
}

/**
 * Resolve the target for a Starter Kit note type.
 *
 * The folder comes from the note type (tokens rendered for `date`); the
 * basename is the granularity default wrapped in the note type's affixes.
 *
 * Returns null when the folder contains a wildcard or an unknown token, since
 * neither can be turned into a concrete path.
 */
export function resolveStarterKitTarget(
    date: Date,
    granularity: TimeGranularity,
    target: StarterKitNoteTarget,
    formatMoment: MomentFormatter
): ResolvedNoteTarget | null {
    const folder = renderDateTokens(target.associatedFolder ?? '', date)
    if (folder === null) return null

    const stem = formatMoment(date, DEFAULT_BASENAME_FORMAT[granularity])
    if (!stem) return null

    const basename = `${target.noteNamePrefix ?? ''}${stem}${target.noteNameSuffix ?? ''}`
    return toTarget(toVaultPath(folder, basename))
}

/**
 * Resolve the target for a Periodic Notes granularity config.
 *
 * The format is applied whole, including any `/` it contains, so a
 * folder-structured format such as `YYYY/WW/YYYY-MM-DD` produces the
 * subdirectories the user configured.
 */
export function resolvePeriodicNotesTarget(
    date: Date,
    target: PeriodicNotesNoteTarget,
    formatMoment: MomentFormatter
): ResolvedNoteTarget | null {
    const stem = formatMoment(date, target.format)
    if (!stem) return null

    return toTarget(toVaultPath(target.folder, stem))
}

/**
 * Every folder that must exist for `folder` to be creatable, outermost first.
 *
 * Obsidian's `createFolder` does not create intermediate directories, and
 * asking for one that already exists throws, so callers walk this list and
 * create only what is missing.
 */
export function folderAncestry(folder: string): string[] {
    const parts = folder.split('/').filter((part) => part.length > 0)
    const ancestry: string[] = []
    let current = ''
    for (const part of parts) {
        current = current ? `${current}/${part}` : part
        ancestry.push(current)
    }
    return ancestry
}
