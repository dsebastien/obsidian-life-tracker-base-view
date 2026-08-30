import { describe, expect, test } from 'bun:test'
import { TimeGranularity } from './visualization/time-granularity.intf'
import {
    PERIODIC_NOTE_GRANULARITIES,
    isPeriodicNoteConfig,
    parsePeriodicNotesSettings
} from './periodic-notes.types'

/** The shape the Periodic Notes plugin actually persists (v0.0.17) */
const REAL_SETTINGS = {
    showGettingStartedBanner: false,
    hasMigratedDailyNoteSettings: false,
    daily: {
        format: 'YYYY/WW/YYYY-MM-DD',
        template: '50 Resources/54 Templates/Templater/TPL Daily Note.md',
        folder: '40 Journal/41 Daily Notes/',
        enabled: true
    },
    weekly: {
        format: 'YYYY/gggg-[W]ww',
        template: '50 Resources/54 Templates/Templater/TPL Weekly Note.md',
        folder: '40 Journal/42 Weekly Notes',
        enabled: true
    }
}

describe('isPeriodicNoteConfig', () => {
    test('accepts a real config', () => {
        expect(isPeriodicNoteConfig(REAL_SETTINGS.daily)).toBe(true)
    })

    test('rejects a config with no format, which would name the note ".md"', () => {
        expect(isPeriodicNoteConfig({ folder: 'Journal', format: '', enabled: true })).toBe(false)
        expect(isPeriodicNoteConfig({ folder: 'Journal', enabled: true })).toBe(false)
    })

    test('tolerates an omitted folder, template and enabled flag', () => {
        expect(isPeriodicNoteConfig({ format: 'YYYY-MM-DD' })).toBe(true)
    })

    test('rejects wrongly typed fields rather than trusting them into a path', () => {
        expect(isPeriodicNoteConfig({ format: 'YYYY-MM-DD', folder: 42 })).toBe(false)
        expect(isPeriodicNoteConfig({ format: 'YYYY-MM-DD', template: [] })).toBe(false)
        expect(isPeriodicNoteConfig({ format: 123 })).toBe(false)
    })

    test('rejects non-objects', () => {
        expect(isPeriodicNoteConfig(null)).toBe(false)
        expect(isPeriodicNoteConfig(undefined)).toBe(false)
        expect(isPeriodicNoteConfig('daily')).toBe(false)
    })
})

describe('parsePeriodicNotesSettings', () => {
    test('reads the granularities present and ignores unrelated keys', () => {
        const parsed = parsePeriodicNotesSettings(REAL_SETTINGS)

        expect(parsed?.[TimeGranularity.Daily]?.format).toBe('YYYY/WW/YYYY-MM-DD')
        expect(parsed?.[TimeGranularity.Daily]?.folder).toBe('40 Journal/41 Daily Notes/')
        expect(parsed?.[TimeGranularity.Weekly]?.folder).toBe('40 Journal/42 Weekly Notes')
        expect(parsed?.[TimeGranularity.Monthly]).toBeUndefined()
    })

    test('fills the fields Periodic Notes may omit, leaving it disabled', () => {
        // Periodic Notes reads `enabled` as a plain boolean, so an absent flag
        // is off. Defaulting it on would create notes for a granularity the
        // user never enabled.
        const parsed = parsePeriodicNotesSettings({ daily: { format: 'YYYY-MM-DD' } })

        expect(parsed?.[TimeGranularity.Daily]).toEqual({
            enabled: false,
            folder: '',
            format: 'YYYY-MM-DD',
            template: ''
        })
    })

    test('skips one malformed granularity without losing the others', () => {
        const parsed = parsePeriodicNotesSettings({
            daily: { format: 'YYYY-MM-DD', folder: 'D', enabled: true },
            weekly: { format: 42 }
        })

        expect(parsed?.[TimeGranularity.Daily]?.folder).toBe('D')
        expect(parsed?.[TimeGranularity.Weekly]).toBeUndefined()
    })

    test('the 1.x calendarSets shape is not misread', () => {
        // Periodic Notes 1.x stores granularities inside calendar sets. Reading
        // it as 0.x must yield nothing, so the caller degrades to "not
        // available" rather than inventing a path from a shape it cannot parse.
        const parsed = parsePeriodicNotesSettings({
            calendarSets: [{ id: 'default', day: { format: 'YYYY-MM-DD', folder: 'Journal' } }]
        })

        expect(parsed).toBeNull()
    })

    test('returns null for settings with no recognisable granularity', () => {
        expect(parsePeriodicNotesSettings({})).toBeNull()
        expect(parsePeriodicNotesSettings(null)).toBeNull()
        expect(parsePeriodicNotesSettings('nope')).toBeNull()
    })
})

describe('granularity keys', () => {
    test("Periodic Notes' keys are exactly TimeGranularity's values", () => {
        // No mapping table exists between the two because of this. If a
        // granularity is ever added to one side only, this fails rather than
        // letting the plugin silently ignore it.
        expect([...PERIODIC_NOTE_GRANULARITIES].sort()).toEqual(
            Object.values(TimeGranularity).sort()
        )
    })
})
