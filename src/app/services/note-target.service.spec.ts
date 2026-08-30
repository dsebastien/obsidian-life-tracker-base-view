import { describe, expect, test } from 'bun:test'
import { createRequire } from 'node:module'
import { TimeGranularity } from '../types/visualization/time-granularity.intf'
import type { StarterKitNoteType } from '../types/property/starter-kit.types'
import { NoteTargetService, type NoteTargetHost } from './note-target.service'

// See periodic-note-path.utils.spec.ts for why moment is loaded this way.
type MomentLike = (date: Date) => { format: (pattern: string) => string }
const momentFn: MomentLike = createRequire(import.meta.url)('moment')
const formatMoment = (date: Date, format: string): string => momentFn(date).format(format)

const SUNDAY = new Date(2026, 7, 30)

/** The real Daily Notes type from the reference vault (nt-0038) */
const DAILY_NOTE_TYPE: StarterKitNoteType = {
    id: 'nt-0038',
    name: 'Daily Notes',
    description: 'Daily planning',
    icon: 'lucide-calendar-days',
    mappings: [],
    properties: [],
    associatedFolder: '40 Journal/41 Daily Notes/{{year}}/{{week}}',
    templatePath: '50 Resources/54 Templates/Templater/TPL Daily Note.md',
    noteNamePrefix: null,
    noteNameSuffix: null,
    tags: ['zone/journal', 'type/periodic_note', 'type/periodic_note/daily']
}

function createApp(
    options: { enabled?: string[]; periodicNotesSettings?: unknown } = {}
): NoteTargetHost {
    const { enabled = [], periodicNotesSettings } = options
    const app: NoteTargetHost = {
        plugins: {
            enabledPlugins: new Set(enabled),
            plugins:
                periodicNotesSettings === undefined
                    ? {}
                    : { 'periodic-notes': { settings: periodicNotesSettings } }
        }
    }
    return app
}

const REAL_PN_SETTINGS = {
    daily: {
        format: 'YYYY/WW/YYYY-MM-DD',
        template: '50 Resources/54 Templates/Templater/TPL Daily Note.md',
        folder: '40 Journal/41 Daily Notes/',
        enabled: true
    },
    monthly: { format: 'YYYY/YYYY-MM', template: '', folder: 'Monthly', enabled: false }
}

describe('resolveFromStarterKit', () => {
    test('resolves the reference vault path, template and mandatory tags', () => {
        const service = new NoteTargetService(createApp(), formatMoment)

        const resolution = service.resolveFromStarterKit(
            SUNDAY,
            TimeGranularity.Daily,
            DAILY_NOTE_TYPE
        )

        expect(resolution?.target.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
        expect(resolution?.target.folder).toBe('40 Journal/41 Daily Notes/2026/35')
        expect(resolution?.templatePath).toBe(
            '50 Resources/54 Templates/Templater/TPL Daily Note.md'
        )
        expect(resolution?.mandatoryTags).toEqual([
            'zone/journal',
            'type/periodic_note',
            'type/periodic_note/daily'
        ])
        expect(resolution?.source).toBe('starter-kit')
    })

    test('a note type with no folder is not a location', () => {
        const service = new NoteTargetService(createApp(), formatMoment)

        const resolution = service.resolveFromStarterKit(SUNDAY, TimeGranularity.Daily, {
            ...DAILY_NOTE_TYPE,
            associatedFolder: null
        })

        expect(resolution).toBeNull()
    })

    test('a folder that cannot be rendered is refused rather than guessed at', () => {
        const service = new NoteTargetService(createApp(), formatMoment)

        const resolution = service.resolveFromStarterKit(SUNDAY, TimeGranularity.Daily, {
            ...DAILY_NOTE_TYPE,
            associatedFolder: 'Journal/*/{{year}}'
        })

        expect(resolution).toBeNull()
    })

    test('a note type with no template still resolves a location', () => {
        const service = new NoteTargetService(createApp(), formatMoment)

        const resolution = service.resolveFromStarterKit(SUNDAY, TimeGranularity.Daily, {
            ...DAILY_NOTE_TYPE,
            templatePath: null
        })

        expect(resolution?.templatePath).toBeNull()
        expect(resolution?.target.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
    })
})

describe('resolveFromPeriodicNotes', () => {
    test('resolves from the plugin settings, subfolders included', () => {
        const service = new NoteTargetService(
            createApp({ enabled: ['periodic-notes'], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        const resolution = service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Daily)

        expect(resolution?.target.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
        expect(resolution?.target.folder).toBe('40 Journal/41 Daily Notes/2026/35')
        expect(resolution?.source).toBe('periodic-notes')
        expect(resolution?.mandatoryTags).toEqual([])
    })

    test('a disabled granularity is not a location to write to', () => {
        const service = new NoteTargetService(
            createApp({ enabled: ['periodic-notes'], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        expect(service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Monthly)).toBeNull()
    })

    test('a granularity the user never configured yields nothing', () => {
        const service = new NoteTargetService(
            createApp({ enabled: ['periodic-notes'], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        expect(service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Yearly)).toBeNull()
    })

    test('the plugin installed but disabled is not read', () => {
        const service = new NoteTargetService(
            createApp({ enabled: [], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        expect(service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Daily)).toBeNull()
    })

    test('an unrecognised settings shape degrades instead of throwing', () => {
        const service = new NoteTargetService(
            createApp({
                enabled: ['periodic-notes'],
                periodicNotesSettings: { calendarSets: [{ id: 'default' }] }
            }),
            formatMoment
        )

        expect(service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Daily)).toBeNull()
    })

    test('no plugin registry at all degrades instead of throwing', () => {
        const service = new NoteTargetService({}, formatMoment)

        expect(service.resolveFromPeriodicNotes(SUNDAY, TimeGranularity.Daily)).toBeNull()
    })
})

describe('resolve: the source chain', () => {
    test('Starter Kit wins when it can resolve, even with Periodic Notes present', () => {
        const service = new NoteTargetService(
            createApp({
                enabled: ['periodic-notes'],
                periodicNotesSettings: {
                    daily: { format: 'YYYY-MM-DD', folder: 'Elsewhere', enabled: true }
                }
            }),
            formatMoment
        )

        const resolution = service.resolve(SUNDAY, TimeGranularity.Daily, DAILY_NOTE_TYPE)

        expect(resolution?.source).toBe('starter-kit')
        expect(resolution?.target.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
    })

    test('falls through to Periodic Notes when no note type is mapped', () => {
        const service = new NoteTargetService(
            createApp({ enabled: ['periodic-notes'], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        const resolution = service.resolve(SUNDAY, TimeGranularity.Daily, null)

        expect(resolution?.source).toBe('periodic-notes')
    })

    test('falls through when the mapped note type cannot produce a path', () => {
        // A note type whose folder is unrenderable must not dead-end the chain:
        // Periodic Notes may still know where the note belongs.
        const service = new NoteTargetService(
            createApp({ enabled: ['periodic-notes'], periodicNotesSettings: REAL_PN_SETTINGS }),
            formatMoment
        )

        const resolution = service.resolve(SUNDAY, TimeGranularity.Daily, {
            ...DAILY_NOTE_TYPE,
            associatedFolder: null
        })

        expect(resolution?.source).toBe('periodic-notes')
    })

    test('neither source available means no location, never a guess', () => {
        const service = new NoteTargetService(createApp(), formatMoment)

        expect(service.resolve(SUNDAY, TimeGranularity.Daily, null)).toBeNull()
    })
})
