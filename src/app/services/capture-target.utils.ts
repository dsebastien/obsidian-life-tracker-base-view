/**
 * Capture targets (see `documentation/plans/capture-targets.md`): which
 * destination a property goes to, how a target note is recognized for a date,
 * and where a new one is created. Pure, so it is specced without Obsidian.
 */
import {
    DAILY_NOTE_TARGET_ID,
    TimeGranularity,
    type CaptureTarget,
    type CaptureTargetFilter,
    type PropertyDefinition,
    type StarterKitNoteType
} from '../types'
import {
    buildNoteTarget,
    formatDateISO,
    isSameDay,
    isTargetDiscoverable,
    parseDateFromPath,
    renderDateTokens,
    type ResolvedNoteTarget
} from '../../utils'
import { matchesMapping, subjectHasTag, type MappingSubject } from './property-recognition.service'

/**
 * The target a property's values are written to, or null for the daily note.
 *
 * 1. An explicit target id that still exists.
 * 2. `DAILY_NOTE_TARGET_ID`: the daily note, whatever else is configured.
 * 3. Automatic: for a Starter Kit-linked definition, the one target whose
 *    note type is the link's note type. None or several: no target.
 * 4. Otherwise the daily note, which is the behavior before targets existed.
 */
export function resolveDefinitionTarget(
    definition: PropertyDefinition,
    targets: readonly CaptureTarget[]
): CaptureTarget | null {
    const explicit = definition.captureTargetId ?? ''
    if (explicit === DAILY_NOTE_TARGET_ID) return null
    if (explicit) {
        const named = targets.find((target) => target.id === explicit)
        if (named) return named
    }

    const noteTypeId = definition.starterKitLink?.noteTypeId
    if (!noteTypeId) return null
    const sameType = targets.filter((target) => target.noteTypeId === noteTypeId)
    return sameType.length === 1 ? (sameType[0] ?? null) : null
}

/** The definitions whose destination is `target` (null = the daily note) */
export function definitionsForDestination(
    definitions: readonly PropertyDefinition[],
    targets: readonly CaptureTarget[],
    target: CaptureTarget | null
): PropertyDefinition[] {
    return definitions.filter(
        (definition) => resolveDefinitionTarget(definition, targets)?.id === target?.id
    )
}

/** Definitions grouped by destination */
export interface DestinationGroup {
    /** Null for the daily note */
    target: CaptureTarget | null
    definitions: PropertyDefinition[]
}

/**
 * Group definitions by destination: the daily note first, then each target in
 * settings order. Only destinations with at least one definition are listed;
 * definition order is kept inside each group.
 */
export function groupByDestination(
    definitions: readonly PropertyDefinition[],
    targets: readonly CaptureTarget[]
): DestinationGroup[] {
    const destinations: Array<CaptureTarget | null> = [null, ...targets]
    return destinations
        .map((target) => ({
            target,
            definitions: definitionsForDestination(definitions, targets, target)
        }))
        .filter((group) => group.definitions.length > 0)
}

/** A note considered by the target lookup */
export interface TargetNoteCandidate extends MappingSubject {
    frontmatter: Record<string, unknown>
    /** Modification time, newest wins between several matches */
    mtime: number
}

function normalizeValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value.trim().toLowerCase()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).toLowerCase()
    return ''
}

/**
 * The filter pairs that count: both a property and a value. A half-filled
 * settings row is ignored for matching and never written, so it can neither
 * match notes that lack the property nor write `property: ''` into a note.
 */
export function completeFilters(filters: readonly CaptureTargetFilter[]): CaptureTargetFilter[] {
    return filters
        .map((filter) => ({ property: filter.property.trim(), value: filter.value.trim() }))
        .filter((filter) => filter.property.length > 0 && filter.value.length > 0)
}

/**
 * Whether frontmatter matches every complete filter pair. Trimmed,
 * case-insensitive comparison; a list value matches when one of its items
 * does. Incomplete pairs are ignored (see `completeFilters`).
 */
export function matchesFilters(
    frontmatter: Record<string, unknown>,
    filters: readonly CaptureTargetFilter[]
): boolean {
    return completeFilters(filters).every((filter) => {
        const property = filter.property
        const wanted = filter.value.toLowerCase()
        const actual = frontmatter[property]
        if (Array.isArray(actual)) {
            return actual.some((item) => normalizeValue(item) === wanted)
        }
        return normalizeValue(actual) === wanted
    })
}

const ISO_DAY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** Local-midnight date for a string starting with `YYYY-MM-DD`; null otherwise */
function parseLeadingIsoDay(text: string): Date | null {
    const match = ISO_DAY_PREFIX.exec(text.trim())
    if (!match) return null
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null
    }
    return date
}

/** `[[2026-11-03]]` or `[[2026-11-03|alias]]` → `2026-11-03` */
const WIKILINK = /^\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]$/

/**
 * The day a date property value names, or null when it names none: an ISO
 * date, a datetime starting with one (`2026-11-03T08:15`), a wikilink to a
 * daily note (`[[2026-11-03]]`), or a Date from a YAML parser that reads
 * timestamps (UTC midnight for a bare date: its calendar day is kept).
 */
export function parseDateValue(raw: unknown): Date | null {
    if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return null
        return new Date(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate())
    }
    if (typeof raw !== 'string') return null
    const text = raw.trim()
    const link = WIKILINK.exec(text)
    const inner = link ? (link[1] ?? '').trim() : text
    // A link may point to a path: the daily note's name is its last segment
    return parseLeadingIsoDay(inner.slice(inner.lastIndexOf('/') + 1))
}

/**
 * A note's date: its date property when it names a day (see
 * `parseDateValue`), otherwise the date in its file name (filename patterns
 * at daily granularity, then a leading `YYYY-MM-DD` such as in
 * `2026-11-03 (Strength Session)`). A property value that names no day
 * (`soon`, a broken link) falls back to the file name as well.
 */
export function readTargetNoteDate(
    candidate: Pick<TargetNoteCandidate, 'path' | 'basename' | 'frontmatter'>,
    dateProperty: string
): Date | null {
    const property = dateProperty.trim()
    const fromProperty = property ? parseDateValue(candidate.frontmatter[property]) : null
    if (fromProperty) return fromProperty

    const parsed = parseDateFromPath(candidate.path)
    if (parsed && parsed.granularity === TimeGranularity.Daily) return parsed.date
    return parseLeadingIsoDay(candidate.basename)
}

/**
 * Whether a note is of the target's note type.
 *
 * Starter Kit target: one of the note type's enabled mappings matches; a type
 * with no enabled mapping matches nothing (Starter Kit's own semantics).
 * Standalone target: every configured tag is present; no tags means the folder
 * alone decides (the lookup only ever scans the target's folder).
 */
export function isOfTargetType(
    subject: MappingSubject,
    target: CaptureTarget,
    noteType: StarterKitNoteType | null
): boolean {
    if (target.noteTypeId) {
        if (!noteType) return false
        const enabled = noteType.mappings.filter((mapping) => mapping.enabled)
        return enabled.some((mapping) => matchesMapping(subject, mapping))
    }
    return cleanTags(target.tags).every((tag) => subjectHasTag(subject, tag))
}

/**
 * The target note for a day among candidates, or null. Several matches: the
 * most recently modified wins.
 */
export function pickTargetNote<T extends TargetNoteCandidate>(
    candidates: readonly T[],
    target: CaptureTarget,
    noteType: StarterKitNoteType | null,
    date: Date
): T | null {
    let best: T | null = null
    for (const candidate of candidates) {
        if (!isOfTargetType(candidate, target, noteType)) continue
        if (!matchesFilters(candidate.frontmatter, target.filters)) continue
        const noteDate = readTargetNoteDate(candidate, target.dateProperty)
        if (!noteDate || !isSameDay(noteDate, date)) continue
        if (!best || candidate.mtime > best.mtime) best = candidate
    }
    return best
}

/** Tags without `#`, trimmed, empty ones dropped */
function cleanTags(tags: readonly string[]): string[] {
    return tags.map((tag) => tag.trim().replace(/^#/, '')).filter((tag) => tag.length > 0)
}

/**
 * Where a target's notes live and how they are named, before a date is
 * applied. The basename is split around the date part so a counter can go
 * right after it (`2026-11-03 2 (Strength Session)`).
 */
export interface TargetLayout {
    /** Folder template, may carry `{{token}}`s */
    folder: string
    /** Basename up to and including the date part (template) */
    head: string
    /** Basename after the date part (template), may be empty */
    tail: string
    /** Template to apply on creation, or null */
    templatePath: string | null
    /** Tags a created note must carry */
    tags: string[]
}

/** Why a target cannot be used */
export type TargetLayoutError =
    | 'missing-note-type'
    | 'missing-folder'
    | 'missing-file-name'
    | 'missing-date-token'
    | 'folder-in-file-name'

/** The `{{date}}` token of a file name pattern (case-insensitive, like rendering) */
const DATE_TOKEN = /\{\{\s*date\s*\}\}/i

/** Whether a file name pattern is set but has no `{{date}}` token */
function lacksDateToken(pattern: string): boolean {
    return pattern.trim().length > 0 && !DATE_TOKEN.test(pattern)
}

/** A folder separator: a file name pattern names a file, never folders */
const FOLDER_SEPARATOR = /[/\\]/

/** A letter or digit: text continuing a word, so not a boundary */
const WORD_CHARACTER = /[\p{L}\p{N}]/u

/** Whether a character is a word boundary: absent, or not a letter or digit */
function isBoundary(character: string | undefined): boolean {
    return character === undefined || !WORD_CHARACTER.test(character)
}

/**
 * `tail` without a trailing copy of the type's suffix, typed by the user.
 *
 * Only a real copy is dropped (case-insensitive): the tail ends with the whole
 * suffix, or with the trimmed suffix at a word boundary (preceded by nothing,
 * a space or punctuation, or the suffix itself starts with punctuation). So
 * suffix ` Log` drops ` log` from `Gym log` but leaves `Backlog` alone. The
 * spaces left before the dropped copy are trimmed only when the suffix brings
 * its own leading space: with suffix `_S`, `Gym _S` stays `Gym _S`.
 */
function dropTypedSuffix(tail: string, suffix: string): string {
    const lowerTail = tail.toLowerCase()
    const typed = suffix.trim()
    let kept: string | null = null
    if (suffix && lowerTail.endsWith(suffix.toLowerCase())) {
        kept = tail.slice(0, tail.length - suffix.length)
    } else if (typed && lowerTail.endsWith(typed.toLowerCase())) {
        const before = tail.slice(0, tail.length - typed.length)
        if (isBoundary(before.at(-1)) || isBoundary(typed[0])) kept = before
    }
    if (kept === null) return tail
    return /^\s/.test(suffix) ? kept.trimEnd() : kept
}

/**
 * `head` without a leading copy of the type's prefix, typed by the user: the
 * mirror of `dropTypedSuffix`. Prefix `S ` drops the `S` of `S {{date}}` but
 * leaves `Sauna {{date}}` alone.
 */
function dropTypedPrefix(head: string, prefix: string): string {
    const lowerHead = head.toLowerCase()
    const typed = prefix.trim()
    let kept: string | null = null
    if (prefix && lowerHead.startsWith(prefix.toLowerCase())) {
        kept = head.slice(prefix.length)
    } else if (typed && lowerHead.startsWith(typed.toLowerCase())) {
        const after = head.slice(typed.length)
        if (isBoundary(after[0]) || isBoundary(typed.at(-1))) kept = after
    }
    if (kept === null) return head
    return /\s$/.test(prefix) ? kept.trimStart() : kept
}

/**
 * The text a Starter Kit target's own file name pattern puts around the date,
 * or null when the pattern is empty or has no `{{date}}` (the type's plain
 * `<prefix><date><suffix>` name is then used). The pattern is trimmed: the
 * type's affixes bring their own spacing. A typed copy of the type's prefix
 * or suffix is dropped, so it never appears twice.
 */
function splitNoteTypePattern(
    pattern: string,
    prefix: string,
    suffix: string
): { head: string; tail: string } | null {
    const trimmed = pattern.trim()
    const dateToken = DATE_TOKEN.exec(trimmed)
    if (!dateToken) return null
    const split = dateToken.index + dateToken[0].length
    return {
        head: dropTypedPrefix(trimmed.slice(0, split), prefix),
        tail: dropTypedSuffix(trimmed.slice(split), suffix)
    }
}

/**
 * The layout of a target, or the reason it is unusable.
 *
 * A Starter Kit target takes the note type's folder, name affixes, template
 * and tags. Its basename is `<prefix><date><suffix>`, like daily notes created
 * from a note type; when the target has a file name pattern with `{{date}}`,
 * that pattern sets the text around the date:
 * `<prefix><pattern up to the date><pattern after the date><suffix>`. A
 * pattern without `{{date}}` is ignored (the settings page flags it). A
 * standalone target uses its own folder and pattern. Both need a folder:
 * lookup is bounded to it, never the whole vault. The target's template, when
 * set, overrides the note type's.
 */
export function describeTargetLayout(
    target: CaptureTarget,
    noteType: StarterKitNoteType | null
): TargetLayout | TargetLayoutError {
    const ownTemplate = target.templatePath.trim() || null

    if (target.noteTypeId) {
        if (!noteType) return 'missing-note-type'
        const folder = noteType.associatedFolder?.trim() ?? ''
        if (!folder) return 'missing-folder'
        const prefix = noteType.noteNamePrefix ?? ''
        const suffix = noteType.noteNameSuffix ?? ''
        const own = splitNoteTypePattern(target.fileNamePattern, prefix, suffix)
        if (own && FOLDER_SEPARATOR.test(target.fileNamePattern)) return 'folder-in-file-name'
        return {
            folder,
            head: `${prefix}${own?.head ?? '{{date}}'}`,
            tail: `${own?.tail ?? ''}${suffix}`,
            templatePath: ownTemplate ?? noteType.templatePath ?? null,
            tags: cleanTags(noteType.tags ?? [])
        }
    }

    const folder = target.folder.trim()
    if (!folder) return 'missing-folder'
    const pattern = target.fileNamePattern
    if (!pattern.trim()) return 'missing-file-name'
    if (FOLDER_SEPARATOR.test(pattern)) return 'folder-in-file-name'

    // The counter goes right after the date, as Starter Kit names do
    // (`<date> 2 (…)`); a name without the date could never be told apart
    const dateToken = DATE_TOKEN.exec(pattern)
    if (!dateToken) return 'missing-date-token'
    const split = dateToken.index + dateToken[0].length
    return {
        folder,
        head: pattern.slice(0, split),
        tail: pattern.slice(split),
        templatePath: ownTemplate,
        tags: cleanTags(target.tags)
    }
}

/** Whether `describeTargetLayout` produced a layout rather than an error */
export function isTargetLayout(value: TargetLayout | TargetLayoutError): value is TargetLayout {
    return typeof value === 'object'
}

/** User-facing explanation of a layout error */
export function describeLayoutError(error: TargetLayoutError, target: CaptureTarget): string {
    switch (error) {
        case 'missing-note-type':
            return `The Starter Kit note type of capture target "${target.name}" is not available.`
        case 'missing-folder':
            return target.noteTypeId
                ? `The Starter Kit note type of capture target "${target.name}" has no folder.`
                : `Capture target "${target.name}" has no folder.`
        case 'missing-file-name':
            return `Capture target "${target.name}" has no file name pattern.`
        case 'missing-date-token':
            return `The file name pattern of capture target "${target.name}" needs {{date}}.`
        case 'folder-in-file-name':
            return target.noteTypeId
                ? `The file name pattern of capture target "${target.name}" contains / or \\. A file name cannot hold folders: the note type gives the folder.`
                : `The file name pattern of capture target "${target.name}" contains / or \\. A file name cannot hold folders: set them in the folder field.`
    }
}

/**
 * Why a usable layout still gives no valid path, for the settings page and
 * capture alike: an unknown `{{token}}` (`{{time}}`, `{{date:YYYY}}`), a
 * character a file name cannot hold, or a trailing dot
 */
export function describeInvalidPath(target: CaptureTarget): string {
    return `Capture target "${target.name}" does not give a valid note path. Check the file name pattern (and the folder) for unknown {{tokens}}, characters such as : ? | # * " < > [ ] ^, or a trailing dot.`
}

/**
 * What is wrong with a target, for the settings page: a setup that makes it
 * unusable (including a name that capture would refuse for `date`), and match
 * filter rows that are incomplete and therefore ignored. Empty when the target
 * is fine.
 */
export function describeTargetIssues(
    target: CaptureTarget,
    noteType: StarterKitNoteType | null,
    date: Date = new Date()
): string[] {
    const issues: string[] = []
    const layout = describeTargetLayout(target, noteType)
    if (!isTargetLayout(layout)) issues.push(describeLayoutError(layout, target))
    else if (resolveFreeTargetPath(layout, date, () => false) === null) {
        // What capture would refuse: say so before the first capture does
        issues.push(describeInvalidPath(target))
    } else if (target.noteTypeId && lacksDateToken(target.fileNamePattern)) {
        // Usable, but the pattern is ignored: say so, as standalone mode does
        issues.push(
            `${describeLayoutError('missing-date-token', target)} Until then, the note type name is used.`
        )
    }

    target.filters.forEach((filter, index) => {
        if (!filter.property.trim() || !filter.value.trim()) {
            issues.push(
                `Match filter row ${index + 1} needs both a property and a value; it is ignored.`
            )
        }
    })
    return issues
}

/** The folder to scan and create in for a date, or null when it cannot be rendered */
export function renderTargetFolder(layout: TargetLayout, date: Date): string | null {
    const folder = renderDateTokens(layout.folder, date)
    if (folder === null) return null
    return folder.replace(/^\/+|\/+$/g, '')
}

/**
 * Characters that break a link to the note (`[[a#b]]` names a heading of `a`).
 * Refused in a target note's name: the note would be created but could not be
 * linked, and Obsidian refuses to rename a note to such a name.
 */
const LINK_BREAKING_CHARS = /[#^[\]|]/

/** Largest counter tried before giving up on a free name */
const MAX_NAME_ATTEMPTS = 100

/**
 * The path a new target note is created at: the first free name, starting
 * with the plain one, then `head 2 tail`, `head 3 tail`... An existing file is
 * never reused: it may be a different note of the same type (a Garmin gym
 * session on the same day as the through-the-day session).
 *
 * Null when the layout cannot be rendered to a safe path (unknown token,
 * illegal or link-breaking character, a name ending in a dot), or no free name
 * is found.
 */
export function resolveFreeTargetPath(
    layout: TargetLayout,
    date: Date,
    isTaken: (path: string) => boolean
): ResolvedNoteTarget | null {
    const folder = renderTargetFolder(layout, date)
    if (folder === null) return null

    const head = renderDateTokens(layout.head, date, { preserveWhitespace: true })
    const tail = renderDateTokens(layout.tail, date, { preserveWhitespace: true })
    if (head === null || tail === null) return null
    if (LINK_BREAKING_CHARS.test(`${head}${tail}`)) return null
    // `Gym..md` is a legal path, but a name ending in a dot is one Windows
    // tools and sync clients mangle: refuse it as folder names already are
    if (`${head}${tail}`.endsWith('.')) return null

    for (let counter = 1; counter <= MAX_NAME_ATTEMPTS; counter++) {
        const basename = counter === 1 ? `${head}${tail}` : `${head} ${counter}${tail}`
        const target = buildNoteTarget(folder, basename)
        if (!target) return null
        if (!isTaken(target.path)) return target
    }
    return null
}

/**
 * Frontmatter tags as written: the `tags` and the singular `tag` key, each a
 * list or a comma- or space-separated string, like Obsidian's
 * `parseFrontMatterTags`. `#` kept as written.
 */
export function readFrontmatterTags(frontmatter: Record<string, unknown>): string[] {
    const tags: string[] = []
    for (const key of ['tags', 'tag']) {
        const raw = frontmatter[key]
        if (Array.isArray(raw)) {
            for (const tag of raw) {
                if (typeof tag === 'string' && tag.trim()) tags.push(tag.trim())
            }
        } else if (typeof raw === 'string') {
            tags.push(
                ...raw
                    .split(/[,\s]+/)
                    .map((tag) => tag.trim())
                    .filter((tag) => tag.length > 0)
            )
        }
    }
    return tags
}

/**
 * The frontmatter written into a note right after the plugin created it: the
 * date property, every complete filter pair, and the mandatory tags merged
 * into `tags`. This is what makes the note findable again, template or not.
 *
 * A date the note already has for that day is kept as written (a template's
 * `2026-11-03T08:15` or `[[2026-11-03]]`); only a missing or different value
 * is replaced.
 */
export function buildCreationFrontmatter(
    target: CaptureTarget,
    layout: TargetLayout,
    date: Date,
    current: Record<string, unknown>
): Record<string, unknown> {
    const values: Record<string, unknown> = {}

    const dateProperty = target.dateProperty.trim()
    if (dateProperty) {
        const existing = parseDateValue(current[dateProperty])
        if (!existing || !isSameDay(existing, date)) values[dateProperty] = formatDateISO(date)
    }

    for (const filter of completeFilters(target.filters)) {
        values[filter.property] = filter.value
    }

    if (layout.tags.length > 0) {
        // `tags` only: a singular `tag` key is left as it is
        const existing = readFrontmatterTags({ tags: current['tags'] })
        const present = readFrontmatterTags(current).map((tag) =>
            tag.replace(/^#/, '').toLowerCase()
        )
        const missing = layout.tags.filter((tag) => !present.includes(tag.toLowerCase()))
        if (missing.length > 0 || typeof current['tags'] === 'string') {
            values['tags'] = [...existing, ...missing]
        }
    }

    return values
}

/**
 * Whether to warn that a created note will not show up in views. A target
 * with a date property dates its notes through it (the plugin writes it), so
 * only a target without one falls back to the file name check.
 */
export function needsDiscoverabilityWarning(
    target: CaptureTarget,
    resolved: ResolvedNoteTarget,
    date: Date
): boolean {
    if (target.dateProperty.trim()) return false
    return !isTargetDiscoverable(resolved, date, TimeGranularity.Daily)
}
