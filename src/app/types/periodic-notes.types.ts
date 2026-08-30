import { TimeGranularity } from './visualization/time-granularity.intf'

/** Plugin id of the Periodic Notes plugin */
export const PERIODIC_NOTES_PLUGIN_ID = 'periodic-notes'

/**
 * One granularity's configuration in the Periodic Notes plugin.
 *
 * Life Tracker's own copy of the shape, declaring only the fields it reads —
 * the same posture as `StarterKitProperty`, so a new field on the other side
 * cannot silently change behavior here.
 */
export interface PeriodicNoteConfig {
    enabled: boolean
    folder: string
    /** moment format; may contain `/`, which contributes subfolders */
    format: string
    /** Vault path to a template, or empty when none is configured */
    template: string
}

/**
 * Periodic Notes' settings: one config per granularity.
 *
 * Partial because a granularity the user never touched may be absent, and
 * because only the granularity being created has to be present for the read to
 * be useful.
 */
export type PeriodicNotesSettings = Partial<Record<TimeGranularity, PeriodicNoteConfig>>

/**
 * Periodic Notes' keys are exactly `TimeGranularity`'s values, which is why no
 * mapping table exists. Asserted by `periodic-notes.service.spec.ts` so a future
 * granularity added to one side cannot drift from the other unnoticed.
 */
export const PERIODIC_NOTE_GRANULARITIES: readonly TimeGranularity[] = [
    TimeGranularity.Daily,
    TimeGranularity.Weekly,
    TimeGranularity.Monthly,
    TimeGranularity.Quarterly,
    TimeGranularity.Yearly
]

/**
 * Whether a value is a usable per-granularity config.
 *
 * `enabled` is tolerated when absent — Periodic Notes writes it, but a config
 * carrying a folder and a format is usable regardless, and rejecting the whole
 * thing over a missing boolean would fail closed for no benefit. `format` must
 * be a non-empty string: it is the only field with no sane default, since an
 * empty one yields a note named `.md`.
 */
export function isPeriodicNoteConfig(value: unknown): value is PeriodicNoteConfig {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PeriodicNoteConfig>
    return (
        typeof candidate.format === 'string' &&
        candidate.format.length > 0 &&
        (candidate.folder === undefined || typeof candidate.folder === 'string') &&
        (candidate.template === undefined || typeof candidate.template === 'string') &&
        (candidate.enabled === undefined || typeof candidate.enabled === 'boolean')
    )
}

/**
 * Normalize a validated config, filling the fields Periodic Notes may omit.
 *
 * An absent `enabled` is treated as **disabled**, matching Periodic Notes,
 * which reads the flag as a plain boolean so a missing one is falsy. Defaulting
 * the other way would let Life Tracker create notes for a granularity the user
 * never switched on — failing open on an operation that writes files.
 */
export function toPeriodicNoteConfig(value: PeriodicNoteConfig): PeriodicNoteConfig {
    return {
        enabled: value.enabled ?? false,
        folder: value.folder ?? '',
        format: value.format,
        template: value.template ?? ''
    }
}

/**
 * Read Periodic Notes' settings object into Life Tracker's shape.
 *
 * Only the flat 0.x layout is understood (`{daily,weekly,…}`). The 1.x beta
 * stores `calendarSets` instead; that shape yields no recognised granularity
 * and the caller degrades to "not available" rather than misreading it.
 *
 * Malformed granularities are skipped individually — one bad entry must not
 * cost the user the others.
 */
export function parsePeriodicNotesSettings(settings: unknown): PeriodicNotesSettings | null {
    if (!settings || typeof settings !== 'object') return null

    const source = settings as Record<string, unknown>
    const parsed: PeriodicNotesSettings = {}
    let found = false

    for (const granularity of PERIODIC_NOTE_GRANULARITIES) {
        const candidate = source[granularity]
        if (isPeriodicNoteConfig(candidate)) {
            parsed[granularity] = toPeriodicNoteConfig(candidate)
            found = true
        }
    }

    return found ? parsed : null
}
