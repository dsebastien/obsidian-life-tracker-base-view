import { describe, expect, test } from 'bun:test'
import { createRequire } from 'node:module'
import { TimeGranularity } from '../app/types/visualization/time-granularity.intf'
import {
    DEFAULT_BASENAME_FORMAT,
    folderAncestry,
    resolvePeriodicNotesTarget,
    resolveStarterKitTarget
} from './periodic-note-path.utils'
import { parseDateFromFilename } from './filename-date.utils'

/**
 * The real moment, which is what Obsidian hands the plugin at runtime and what
 * Periodic Notes' stored formats were written against. A hand-rolled fake would
 * only prove the code calls a function.
 *
 * Loaded through `createRequire` rather than imported: plugin code must take
 * `moment` from 'obsidian' so a build never bundles a second copy, and the lint
 * rules enforcing that stay switched on. A spec is never bundled, and
 * `createRequire` returns an untyped value that lands directly in the precise
 * local type below, so nothing is cast or suppressed to get here.
 */
type MomentLike = (date: Date) => { format: (pattern: string) => string }
const momentFn: MomentLike = createRequire(import.meta.url)('moment')

const formatMoment = (date: Date, format: string): string => momentFn(date).format(format)

/** 2026-08-30 is a Sunday, ISO week 35 — the end of a week, so week/day disagree */
const SUNDAY = new Date(2026, 7, 30)

describe('resolveStarterKitTarget', () => {
    test('renders folder tokens and the granularity default basename', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            {
                associatedFolder: '40 Journal/41 Daily Notes/{{year}}/{{week}}',
                noteNamePrefix: null,
                noteNameSuffix: null
            },
            formatMoment
        )

        // Matches what `osk-cli daily-note-path` resolves for this date
        expect(target?.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
    })

    test('the folder to create includes the token-derived subfolders', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            {
                associatedFolder: '40 Journal/41 Daily Notes/{{year}}/{{week}}',
                noteNamePrefix: null,
                noteNameSuffix: null
            },
            formatMoment
        )

        // Not '40 Journal/41 Daily Notes' — the tokens contribute directories
        expect(target?.folder).toBe('40 Journal/41 Daily Notes/2026/35')
    })

    test('applies the note type name affixes', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            { associatedFolder: 'Journal', noteNamePrefix: 'D ', noteNameSuffix: ' (Daily)' },
            formatMoment
        )

        expect(target?.path).toBe('Journal/D 2026-08-30 (Daily).md')
    })

    test('a wildcard folder cannot be generated', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            { associatedFolder: 'Journal/*/{{year}}', noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )

        expect(target).toBeNull()
    })

    test('an unknown token cannot be generated', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            {
                associatedFolder: 'Journal/{{fortnight}}',
                noteNamePrefix: null,
                noteNameSuffix: null
            },
            formatMoment
        )

        expect(target).toBeNull()
    })

    test('an absent folder puts the note at the vault root, with no leading slash', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            { associatedFolder: null, noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )

        expect(target?.path).toBe('2026-08-30.md')
        expect(target?.folder).toBe('')
    })

    test('every granularity default round-trips through the built-in parse formats', () => {
        const cases: Array<[TimeGranularity, string]> = [
            [TimeGranularity.Daily, '2026-08-30'],
            [TimeGranularity.Weekly, '2026-W35'],
            [TimeGranularity.Monthly, '2026-08'],
            [TimeGranularity.Quarterly, '2026-Q3'],
            [TimeGranularity.Yearly, '2026']
        ]

        for (const [granularity, expected] of cases) {
            expect(formatMoment(SUNDAY, DEFAULT_BASENAME_FORMAT[granularity])).toBe(expected)
        }
    })
})

describe('resolvePeriodicNotesTarget', () => {
    test('a folder-structured format contributes subfolders to the path', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '40 Journal/41 Daily Notes/', format: 'YYYY/WW/YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('40 Journal/41 Daily Notes/2026/35/2026-08-30.md')
    })

    test('the folder to create is the dirname of the resolved path, not the configured folder', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '40 Journal/41 Daily Notes/', format: 'YYYY/WW/YYYY-MM-DD' },
            formatMoment
        )

        // Creating only the configured folder would leave 2026/35 missing and
        // vault.create would throw
        expect(target?.folder).toBe('40 Journal/41 Daily Notes/2026/35')
    })

    test('a flat format keeps the configured folder', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Journal', format: 'YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('Journal/2026-08-30.md')
        expect(target?.folder).toBe('Journal')
    })

    test('an empty folder yields a root path, never a leading slash', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '', format: 'YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('2026-08-30.md')
        expect(target?.folder).toBe('')
    })

    test('a trailing slash on the configured folder does not double up', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Journal/', format: 'YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('Journal/2026-08-30.md')
    })

    test('a locale-week format is rendered as configured, not silently made ISO', () => {
        // `gggg-[W]ww` are locale tokens: an en locale starts a week on Sunday,
        // so 2026-08-30 is locale week 36 while being ISO week 35. Periodic
        // Notes owns its format, so it is applied verbatim — the divergence
        // belongs to the user's configuration, not to this renderer.
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Weekly', format: 'gggg-[W]ww' },
            formatMoment
        )

        expect(target?.path).toBe('Weekly/2026-W36.md')
    })

    test('an ISO-week format resolves the Sunday to ISO week 35', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Weekly', format: 'GGGG-[W]WW' },
            formatMoment
        )

        expect(target?.path).toBe('Weekly/2026-W35.md')
    })
})

describe('round-trip: what is created can be found again', () => {
    // The point of the defaults. A created note whose name this plugin's own
    // parser resolves to a different date (or no date) is invisible in the grid
    // and unreachable by `Capture today` — the bug #160 is about, reintroduced.
    const granularities: TimeGranularity[] = [
        TimeGranularity.Daily,
        TimeGranularity.Weekly,
        TimeGranularity.Monthly,
        TimeGranularity.Quarterly,
        TimeGranularity.Yearly
    ]

    for (const granularity of granularities) {
        test(`${granularity} basename parses back to the same granularity`, () => {
            const target = resolveStarterKitTarget(
                SUNDAY,
                granularity,
                { associatedFolder: 'Journal', noteNamePrefix: null, noteNameSuffix: null },
                formatMoment
            )
            const basename = target?.path.replace(/^Journal\//, '').replace(/\.md$/, '') ?? ''

            const parsed = parseDateFromFilename(basename)

            expect(parsed).not.toBeNull()
            expect(parsed?.granularity).toBe(granularity)
        })
    }

    test('the daily basename parses back to the same day', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            { associatedFolder: null, noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )

        const parsed = parseDateFromFilename(target?.path.replace(/\.md$/, '') ?? '')

        expect(parsed?.date.getFullYear()).toBe(2026)
        expect(parsed?.date.getMonth()).toBe(7)
        expect(parsed?.date.getDate()).toBe(30)
    })

    test('the weekly basename parses back into the week containing the date', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Weekly,
            { associatedFolder: null, noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )

        const parsed = parseDateFromFilename(target?.path.replace(/\.md$/, '') ?? '')

        // ISO week 35 of 2026 starts Monday 2026-08-24 and contains the Sunday
        expect(parsed?.date.getFullYear()).toBe(2026)
        expect(parsed?.date.getMonth()).toBe(7)
        expect(parsed?.date.getDate()).toBe(24)
    })
})

describe('folderAncestry', () => {
    test('lists every folder to create, outermost first', () => {
        expect(folderAncestry('40 Journal/41 Daily Notes/2026/35')).toEqual([
            '40 Journal',
            '40 Journal/41 Daily Notes',
            '40 Journal/41 Daily Notes/2026',
            '40 Journal/41 Daily Notes/2026/35'
        ])
    })

    test('the vault root needs nothing created', () => {
        expect(folderAncestry('')).toEqual([])
    })

    test('ignores empty segments from stray slashes', () => {
        expect(folderAncestry('a//b/')).toEqual(['a', 'a/b'])
    })
})
