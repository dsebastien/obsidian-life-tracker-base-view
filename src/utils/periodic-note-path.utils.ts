import { TimeGranularity } from '../app/types/visualization/time-granularity.intf'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { parseDateFromPath, renderDateTokens } from './filename-date.utils'

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
 * Characters no filesystem this plugin runs on accepts in a name. `/` is
 * excluded on purpose: it is the path separator and is checked structurally.
 */
const ILLEGAL_NAME_CHARS = /[\\:*?"<>|]/

/**
 * Control characters, checked by code point rather than by regex.
 *
 * A `\u0000-\u001f` character class is exactly what `no-control-regex` exists
 * to flag, and suppressing that rule to write one would be the escape hatch this
 * repo refuses. The loop says the same thing and needs no exemption.
 */
function hasControlCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index)
        if (code <= 0x1f || code === 0x7f) return true
    }
    return false
}

/**
 * Whether a resolved path is safe to create in the vault.
 *
 * The folder and format come from another plugin's settings, which a user can
 * hand-edit and which this plugin is about to turn into a filesystem write. A
 * `..` segment escapes the vault and the reserved characters produce files that
 * cannot be created on Windows; neither should ever be repaired silently — a
 * path that is not obviously right is not a path to write to.
 *
 * A leading `/` is not rejected. Obsidian's own `normalizePath` strips it, so
 * `/Journal` is simply the vault-relative `Journal` and refusing it would break
 * a configuration Obsidian itself accepts. A drive letter is caught by the
 * illegal-character test, since `:` cannot appear in a vault path.
 */
function isSafeVaultPath(path: string): boolean {
    if (path.length === 0) return false
    if (ILLEGAL_NAME_CHARS.test(path)) return false
    if (hasControlCharacter(path)) return false

    const segments = path.split('/')
    return segments.every((segment) => {
        if (segment.length === 0) return false
        if (segment === '.' || segment === '..') return false
        // A trailing dot or space is stripped by Windows, so the file the vault
        // believes it created is not the file on disk.
        return !/[. ]$/.test(segment)
    })
}

/**
 * Join a folder and a basename into a vault path.
 *
 * An empty folder yields a root-relative path with no leading slash: Obsidian
 * treats `/Note.md` and `Note.md` as different paths, and only the latter
 * exists.
 *
 * Null when the result is not a safe vault path.
 */
function toVaultPath(folder: string, basename: string): string | null {
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    const cleanBase = basename.replace(/^\/+|\/+$/g, '')
    if (cleanBase.length === 0) return null

    const path = cleanFolder ? `${cleanFolder}/${cleanBase}.md` : `${cleanBase}.md`
    return isSafeVaultPath(path) ? path : null
}

/**
 * Split a full path back into the folder that must exist and the path itself.
 */
function toTarget(path: string | null): ResolvedNoteTarget | null {
    if (path === null) return null
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

    // The Starter Kit evaluates date expressions inside the affixes too, so a
    // prefix of `{{date}} - ` must become a date, not the literal token.
    const prefix = renderDateTokens(target.noteNamePrefix ?? '', date, { preserveWhitespace: true })
    const suffix = renderDateTokens(target.noteNameSuffix ?? '', date, { preserveWhitespace: true })
    if (prefix === null || suffix === null) return null

    return toTarget(toVaultPath(folder, `${prefix}${stem}${suffix}`))
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

/**
 * Whether Life Tracker will recognise the note it is about to create.
 *
 * Notes are discovered by parsing their path, so a name this plugin creates but
 * cannot parse back is invisible in every view and unreachable by `Capture
 * today` — issue #160 reintroduced by the fix for it. That happens legitimately:
 * a Starter Kit note type with a name prefix, a Periodic Notes format like
 * `DD-MM-YYYY`, or locale week tokens that name a different week than they mean.
 *
 * The answer is not used to refuse creation. The configuration belongs to the
 * user and the note is still worth having; it is used to warn them, and the fix
 * is a matching filename date pattern (issue #139).
 */
export function isTargetDiscoverable(
    target: ResolvedNoteTarget,
    date: Date,
    granularity: TimeGranularity
): boolean {
    const parsed = parseDateFromPath(target.path)
    if (!parsed || parsed.granularity !== granularity) return false

    // Same period, not the same instant: a weekly note resolves to its Monday.
    const expected = resolvePeriodStart(date, granularity)
    const actual = resolvePeriodStart(parsed.date, granularity)
    return expected === actual
}

/** A comparable key for the period a date falls in, at a given granularity */
function resolvePeriodStart(date: Date, granularity: TimeGranularity): string {
    const year = date.getFullYear()
    const month = date.getMonth()
    switch (granularity) {
        case TimeGranularity.Yearly:
            return `${year}`
        case TimeGranularity.Quarterly:
            return `${year}-Q${Math.floor(month / 3) + 1}`
        case TimeGranularity.Monthly:
            return `${year}-${month}`
        case TimeGranularity.Weekly:
            // A weekly note parses back to its Monday, so comparing days would
            // call every other day of the week a mismatch. The ISO week year is
            // the right partner for the week number: around New Year the
            // calendar year belongs to a different week entirely.
            return `${getISOWeekYear(date)}-W${getISOWeek(date)}`
        default:
            return `${year}-${month}-${date.getDate()}`
    }
}
