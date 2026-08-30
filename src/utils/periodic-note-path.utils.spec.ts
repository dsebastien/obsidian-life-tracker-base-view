import { describe, expect, test } from 'bun:test'
import { createRequire } from 'node:module'
import { TimeGranularity } from '../app/types/visualization/time-granularity.intf'
import {
    DEFAULT_BASENAME_FORMAT,
    folderAncestry,
    isTargetDiscoverable,
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

describe('path safety', () => {
    // The folder and format come from another plugin's settings, which the user
    // can hand-edit, and this turns them into a filesystem write.
    test('a folder escaping the vault is refused', () => {
        expect(
            resolvePeriodicNotesTarget(
                SUNDAY,
                { folder: '../../outside', format: 'YYYY-MM-DD' },
                formatMoment
            )
        ).toBeNull()
    })

    test('a .. segment anywhere is refused', () => {
        expect(
            resolvePeriodicNotesTarget(
                SUNDAY,
                { folder: 'Journal/../../etc', format: 'YYYY-MM-DD' },
                formatMoment
            )
        ).toBeNull()
    })

    test('a leading slash is normalized away, staying inside the vault', () => {
        // Obsidian's own normalizePath strips it, so '/Journal' is the
        // vault-relative 'Journal'. Refusing it would reject a configuration
        // Obsidian itself accepts.
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '/Journal', format: 'YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('Journal/2026-08-30.md')
    })

    test('a Windows drive path is refused', () => {
        expect(
            resolvePeriodicNotesTarget(
                SUNDAY,
                { folder: 'C:/Windows', format: 'YYYY-MM-DD' },
                formatMoment
            )
        ).toBeNull()
    })

    test('characters illegal in a filename are refused', () => {
        for (const folder of ['Jour:nal', 'Jour*nal', 'Jour?nal', 'Jour"nal', 'Jour|nal']) {
            expect(
                resolvePeriodicNotesTarget(SUNDAY, { folder, format: 'YYYY-MM-DD' }, formatMoment)
            ).toBeNull()
        }
    })

    test('a backslash is refused rather than treated as a separator', () => {
        expect(
            resolvePeriodicNotesTarget(
                SUNDAY,
                { folder: 'Journal\\2026', format: 'YYYY-MM-DD' },
                formatMoment
            )
        ).toBeNull()
    })

    test('a segment ending in a dot or space is refused', () => {
        // Windows silently strips these, so the vault and the disk disagree
        // about the file's name.
        expect(
            resolvePeriodicNotesTarget(
                SUNDAY,
                { folder: 'Journal.', format: 'YYYY-MM-DD' },
                formatMoment
            )
        ).toBeNull()
    })

    test('an empty format produces no note rather than a file called ".md"', () => {
        expect(
            resolvePeriodicNotesTarget(SUNDAY, { folder: 'Journal', format: '' }, formatMoment)
        ).toBeNull()
    })

    test('a legitimate folder with dots and spaces still resolves', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '40 Journal/41 Daily Notes', format: 'YYYY-MM-DD' },
            formatMoment
        )

        expect(target?.path).toBe('40 Journal/41 Daily Notes/2026-08-30.md')
    })
})

describe('Starter Kit affixes carry date expressions', () => {
    test('tokens in a prefix and suffix are rendered, not concatenated literally', () => {
        // The Starter Kit evaluates expressions in affixes, so leaving them
        // literal would create a file actually named "{{date}} - ...".
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            {
                associatedFolder: 'Journal',
                noteNamePrefix: '{{year}} ',
                noteNameSuffix: ' {{quarter}}'
            },
            formatMoment
        )

        expect(target?.path).toBe('Journal/2026 2026-08-30 Q3.md')
    })

    test('an unrenderable affix refuses the target rather than emitting a token', () => {
        expect(
            resolveStarterKitTarget(
                SUNDAY,
                TimeGranularity.Daily,
                {
                    associatedFolder: 'Journal',
                    noteNamePrefix: '{{nonsense}} ',
                    noteNameSuffix: null
                },
                formatMoment
            )
        ).toBeNull()
    })
})

describe('year tokens at the ISO boundary', () => {
    // 2024-12-30 is the Monday of ISO week 01 of 2025. The Starter Kit added
    // {{isoyear}} (1.8.0) precisely because {{year}}/{{week}} strands these days
    // in the previous January's week folder. Life Tracker must reproduce the
    // Starter Kit's semantics exactly for both tokens — including the wrong-
    // looking one, because matching the configured folder is what lets the note
    // be found again.
    const MONDAY_OF_ISO_WEEK_1_2025 = new Date(2024, 11, 30)
    const NEW_YEARS_DAY_2022 = new Date(2022, 0, 1)

    function folderFor(template: string, date: Date): string | undefined {
        return resolveStarterKitTarget(
            date,
            TimeGranularity.Daily,
            { associatedFolder: template, noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )?.folder
    }

    test('{{isoyear}}/{{week}} keeps a week together across New Year', () => {
        expect(folderFor('Daily/{{isoyear}}/{{week}}', MONDAY_OF_ISO_WEEK_1_2025)).toBe(
            'Daily/2025/01'
        )
    })

    test('{{year}}/{{week}} stays the calendar year, matching the Starter Kit', () => {
        // Not a bug here: the Starter Kit resolves it this way too, and a folder
        // that disagreed with it would put the note somewhere nothing looks.
        expect(folderFor('Daily/{{year}}/{{week}}', MONDAY_OF_ISO_WEEK_1_2025)).toBe(
            'Daily/2024/01'
        )
    })

    test('{{isoyear}} rolls back in early January', () => {
        expect(folderFor('Daily/{{isoyear}}/{{week}}', NEW_YEARS_DAY_2022)).toBe('Daily/2021/52')
    })

    test('the basename is unaffected by which year token the folder uses', () => {
        const target = resolveStarterKitTarget(
            MONDAY_OF_ISO_WEEK_1_2025,
            TimeGranularity.Daily,
            {
                associatedFolder: 'Daily/{{year}}/{{week}}',
                noteNamePrefix: null,
                noteNameSuffix: null
            },
            formatMoment
        )

        expect(target?.path).toBe('Daily/2024/01/2024-12-30.md')
        expect(parseDateFromFilename('2024-12-30')?.granularity).toBe(TimeGranularity.Daily)
    })

    test('the weekly basename uses the ISO week year, not the calendar year', () => {
        // GGGG, not YYYY: on 2024-12-30 the calendar year is 2024 but the week
        // belongs to 2025, and '2024-W01' would be a different week entirely.
        const target = resolveStarterKitTarget(
            MONDAY_OF_ISO_WEEK_1_2025,
            TimeGranularity.Weekly,
            { associatedFolder: 'Weekly', noteNamePrefix: null, noteNameSuffix: null },
            formatMoment
        )

        expect(target?.path).toBe('Weekly/2025-W01.md')
    })
})

describe('what gets created but cannot be found again', () => {
    // Life Tracker finds notes by parsing their filename. A created note whose
    // name its own parser does not resolve is invisible in the grid and
    // unreachable by Capture today — issue #160 all over again. These cases are
    // real and currently unguarded; the resolver returns a target regardless.
    test('a Starter Kit prefix makes the basename unparseable', () => {
        const target = resolveStarterKitTarget(
            SUNDAY,
            TimeGranularity.Daily,
            { associatedFolder: 'Journal', noteNamePrefix: 'D ', noteNameSuffix: null },
            formatMoment
        )

        expect(target?.path).toBe('Journal/D 2026-08-30.md')
        expect(parseDateFromFilename('D 2026-08-30')).toBeNull()
    })

    test('a non-ISO Periodic Notes format makes the basename unparseable', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Journal', format: 'DD-MM-YYYY' },
            formatMoment
        )

        expect(target?.path).toBe('Journal/30-08-2026.md')
        expect(parseDateFromFilename('30-08-2026')).toBeNull()
    })

    test('a locale-week format resolves to a different week than it names', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Weekly', format: 'gggg-[W]ww' },
            formatMoment
        )

        expect(target?.path).toBe('Weekly/2026-W36.md')
        // Parsed as ISO week 36, which starts the day after this Sunday
        expect(parseDateFromFilename('2026-W36')?.date.getDate()).toBe(31)
    })
})

describe('isTargetDiscoverable', () => {
    function starterKitTarget(prefix: string | null, granularity: TimeGranularity) {
        return resolveStarterKitTarget(
            SUNDAY,
            granularity,
            { associatedFolder: 'Journal', noteNamePrefix: prefix, noteNameSuffix: null },
            formatMoment
        )
    }

    test('a default basename is discoverable at every granularity', () => {
        for (const granularity of Object.values(TimeGranularity)) {
            const target = starterKitTarget(null, granularity)
            expect(target).not.toBeNull()
            expect(target && isTargetDiscoverable(target, SUNDAY, granularity)).toBe(true)
        }
    })

    test('a prefixed basename is not discoverable', () => {
        const target = starterKitTarget('D ', TimeGranularity.Daily)

        expect(target && isTargetDiscoverable(target, SUNDAY, TimeGranularity.Daily)).toBe(false)
    })

    test('a non-ISO Periodic Notes format is not discoverable', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Journal', format: 'DD-MM-YYYY' },
            formatMoment
        )

        expect(target && isTargetDiscoverable(target, SUNDAY, TimeGranularity.Daily)).toBe(false)
    })

    test('a locale-week format names a week other than the date it was built for', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Weekly', format: 'gggg-[W]ww' },
            formatMoment
        )

        expect(target && isTargetDiscoverable(target, SUNDAY, TimeGranularity.Weekly)).toBe(false)
    })

    test('the ISO weekly default is discoverable for a Sunday', () => {
        // The end of a week: the note resolves to its Monday, which is the same
        // week and must count as discoverable.
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: 'Weekly', format: 'GGGG-[W]WW' },
            formatMoment
        )

        expect(target && isTargetDiscoverable(target, SUNDAY, TimeGranularity.Weekly)).toBe(true)
    })

    test('a daily note at a folder-scoped path stays discoverable', () => {
        const target = resolvePeriodicNotesTarget(
            SUNDAY,
            { folder: '40 Journal/41 Daily Notes', format: 'YYYY/WW/YYYY-MM-DD' },
            formatMoment
        )

        expect(target && isTargetDiscoverable(target, SUNDAY, TimeGranularity.Daily)).toBe(true)
    })
})
