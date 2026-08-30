import type { App } from 'obsidian'
import type { TimeGranularity } from '../types'
import {
    PERIODIC_NOTES_PLUGIN_ID,
    parsePeriodicNotesSettings,
    type PeriodicNoteConfig
} from '../types/periodic-notes.types'
import type { StarterKitNoteType } from '../types'
import { log } from '../../utils'
import {
    resolvePeriodicNotesTarget,
    resolveStarterKitTarget,
    type MomentFormatter,
    type ResolvedNoteTarget
} from '../../utils'

/**
 * The slice of `App` this service uses — only the plugin registry.
 *
 * Narrower than `App` so a test can supply a plain object instead of casting a
 * stub, which would require the `as unknown as` the pre-commit hook refuses.
 */
export interface NoteTargetHost {
    plugins?: App['plugins']
}

/** Where a resolved target's configuration came from, for messages and tests */
export type NoteTargetSource = 'starter-kit' | 'periodic-notes'

/**
 * A place to create a note, plus the template to apply and where it came from.
 */
export interface NoteTargetResolution {
    target: ResolvedNoteTarget
    /** Vault path of a template to apply, or null when none is configured */
    templatePath: string | null
    /** Tags the note must carry; empty unless Starter Kit supplied them */
    mandatoryTags: readonly string[]
    source: NoteTargetSource
}

/**
 * Resolves where a periodic note for a date belongs.
 *
 * Configuration is read from the vault's existing setup, never invented, in a
 * fixed order (issue #160):
 *
 * 1. **Starter Kit** — knows the most. It carries the note type's folder,
 *    template, name affixes *and* its mandatory tags, so a note created from it
 *    is born correct rather than merely present.
 * 2. **Periodic Notes** — folder, format and template only.
 *
 * Neither available means no creation: Life Tracker does not guess a location
 * for a file it is about to write into someone's vault.
 *
 * Core Daily Notes is deliberately unsupported. Periodic Notes supersedes it,
 * and a third partially overlapping source is cost without users.
 */
export class NoteTargetService {
    constructor(
        private readonly app: NoteTargetHost,
        private readonly formatMoment: MomentFormatter
    ) {}

    /**
     * Periodic Notes' config for a granularity, or null when the plugin is
     * absent, disabled, or exposing a shape this version does not understand.
     */
    getPeriodicNotesConfig(granularity: TimeGranularity): PeriodicNoteConfig | null {
        const registry = this.app.plugins
        if (!registry?.enabledPlugins?.has(PERIODIC_NOTES_PLUGIN_ID)) return null

        const instance = registry.plugins?.[PERIODIC_NOTES_PLUGIN_ID]
        if (!instance || typeof instance !== 'object') return null

        const settings = (instance as { settings?: unknown }).settings
        const parsed = parsePeriodicNotesSettings(settings)
        if (!parsed) {
            log('Periodic Notes found but its settings shape was not recognised', 'debug')
            return null
        }

        return parsed[granularity] ?? null
    }

    /**
     * Resolve a target from a Starter Kit note type.
     *
     * Returns null when the note type has no folder to build on, or when that
     * folder cannot be rendered to a concrete path (a wildcard or an unknown
     * token can be matched but never generated).
     */
    resolveFromStarterKit(
        date: Date,
        granularity: TimeGranularity,
        noteType: StarterKitNoteType
    ): NoteTargetResolution | null {
        if (!noteType.associatedFolder) return null

        const target = resolveStarterKitTarget(
            date,
            granularity,
            {
                associatedFolder: noteType.associatedFolder,
                noteNamePrefix: noteType.noteNamePrefix ?? null,
                noteNameSuffix: noteType.noteNameSuffix ?? null
            },
            this.formatMoment
        )
        if (!target) {
            log('Starter Kit note type folder cannot be rendered to a path', 'debug', {
                noteType: noteType.name,
                associatedFolder: noteType.associatedFolder
            })
            return null
        }

        return {
            target,
            templatePath: noteType.templatePath ?? null,
            mandatoryTags: noteType.tags ?? [],
            source: 'starter-kit'
        }
    }

    /**
     * Resolve a target from Periodic Notes' configuration for a granularity.
     *
     * A granularity the user disabled is not a location to write to.
     */
    resolveFromPeriodicNotes(
        date: Date,
        granularity: TimeGranularity
    ): NoteTargetResolution | null {
        const config = this.getPeriodicNotesConfig(granularity)
        if (!config || !config.enabled) return null

        const target = resolvePeriodicNotesTarget(
            date,
            { folder: config.folder, format: config.format },
            this.formatMoment
        )
        if (!target) return null

        return {
            target,
            templatePath: config.template.length > 0 ? config.template : null,
            mandatoryTags: [],
            source: 'periodic-notes'
        }
    }

    /**
     * Resolve a target, preferring Starter Kit when a note type is supplied.
     *
     * `noteType` is null when the Starter Kit is unavailable or the user has not
     * mapped a note type to this granularity; the chain then falls through.
     */
    resolve(
        date: Date,
        granularity: TimeGranularity,
        noteType: StarterKitNoteType | null
    ): NoteTargetResolution | null {
        if (noteType) {
            const fromStarterKit = this.resolveFromStarterKit(date, granularity, noteType)
            if (fromStarterKit) return fromStarterKit
        }
        return this.resolveFromPeriodicNotes(date, granularity)
    }
}
