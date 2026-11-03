/**
 * Capture targets: named destinations for captured values other than the
 * daily note (see `documentation/plans/capture-targets.md`).
 */

/** One `property = value` pair a target note must match */
export interface CaptureTargetFilter {
    property: string
    value: string
}

/**
 * Where captured values go when they do not belong in the daily note, e.g.
 * "the day's strength session with `workout_kind: Through the day`".
 */
export interface CaptureTarget {
    /** Unique ID (UUID); also the suffix of the target's command id */
    id: string
    /** Name shown in settings, commands and the quick-add panel */
    name: string
    /**
     * Starter Kit note type id. Empty for a standalone target, which uses
     * `folder`, `fileNamePattern` and `tags` instead.
     */
    noteTypeId: string
    /** Standalone: folder, may carry `{{token}}`s, e.g. `Sessions/{{year}}` */
    folder: string
    /** Standalone: basename pattern with `{{token}}`s, e.g. `{{date}} (Workout)` */
    fileNamePattern: string
    /** Template applied on creation; overrides the note type's. Empty = none */
    templatePath: string
    /** Standalone: tags a note must carry; written on creation */
    tags: string[]
    /** Pairs a note must match; written on creation */
    filters: CaptureTargetFilter[]
    /** Frontmatter property holding the note's date; written on creation */
    dateProperty: string
}

/**
 * `PropertyDefinition.captureTargetId` value that sends a property to the
 * daily note even when a target would otherwise be derived for it.
 */
export const DAILY_NOTE_TARGET_ID = 'daily-note'

/** Date property a new target starts with */
export const DEFAULT_TARGET_DATE_PROPERTY = 'date'

/** Basename pattern a new standalone target starts with */
export const DEFAULT_TARGET_FILE_NAME_PATTERN = '{{date}}'

/** A fresh target with every field at its default */
export function createCaptureTarget(id: string, name: string): CaptureTarget {
    return {
        id,
        name,
        noteTypeId: '',
        folder: '',
        fileNamePattern: DEFAULT_TARGET_FILE_NAME_PATTERN,
        templatePath: '',
        tags: [],
        filters: [],
        dateProperty: DEFAULT_TARGET_DATE_PROPERTY
    }
}

function stringOr(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback
}

/**
 * Read one stored target field by field, defaulting anything missing or of the
 * wrong shape. Returns null when the entry is not an object at all.
 *
 * `data.json` can be hand-edited or written by an older or newer version, so
 * nothing is trusted: a malformed filter is dropped, not half-kept.
 */
export function sanitizeCaptureTarget(
    raw: unknown,
    generateId: () => string
): CaptureTarget | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const entry = raw as Record<string, unknown>

    const id = typeof entry['id'] === 'string' && entry['id'].trim() ? entry['id'] : generateId()
    const tags = Array.isArray(entry['tags'])
        ? entry['tags'].filter((tag): tag is string => typeof tag === 'string')
        : []
    const filters = Array.isArray(entry['filters'])
        ? entry['filters'].flatMap((filter: unknown): CaptureTargetFilter[] => {
              if (!filter || typeof filter !== 'object') return []
              const pair = filter as Record<string, unknown>
              if (typeof pair['property'] !== 'string' || typeof pair['value'] !== 'string') {
                  return []
              }
              return [{ property: pair['property'], value: pair['value'] }]
          })
        : []

    return {
        id,
        name: stringOr(entry['name'], ''),
        noteTypeId: stringOr(entry['noteTypeId'], ''),
        folder: stringOr(entry['folder'], ''),
        fileNamePattern: stringOr(entry['fileNamePattern'], DEFAULT_TARGET_FILE_NAME_PATTERN),
        templatePath: stringOr(entry['templatePath'], ''),
        tags,
        filters,
        dateProperty: stringOr(entry['dateProperty'], DEFAULT_TARGET_DATE_PROPERTY)
    }
}

/**
 * Read the stored target list. Not a list → empty; entries that are not
 * objects are dropped; duplicate ids are re-minted so commands stay unique.
 */
export function sanitizeCaptureTargets(raw: unknown, generateId: () => string): CaptureTarget[] {
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const targets: CaptureTarget[] = []
    for (const entry of raw) {
        const target = sanitizeCaptureTarget(entry, generateId)
        if (!target) continue
        if (seen.has(target.id)) target.id = generateId()
        seen.add(target.id)
        targets.push(target)
    }
    return targets
}
