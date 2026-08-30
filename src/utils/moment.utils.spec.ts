import { describe, expect, test } from 'bun:test'
import { createRequire } from 'node:module'
import { formatMomentPattern } from './moment.utils'

// See periodic-note-path.utils.spec.ts for why moment is loaded this way.
type MomentLike = (date: Date) => { format: (pattern: string) => string }
const momentFn: MomentLike = createRequire(import.meta.url)('moment')

const PATTERNS = [
    'YYYY-MM-DD',
    'YYYY/WW/YYYY-MM-DD',
    'GGGG-[W]WW',
    'gggg-[W]ww',
    'YYYY-MM',
    'YYYY-[Q]Q',
    'YYYY'
]

/** Dates chosen for the boundaries: ISO year edges, a leap day, a DST switch */
const DATES = [
    new Date(2026, 7, 30),
    new Date(2026, 11, 31),
    new Date(2027, 0, 1),
    new Date(2024, 1, 29),
    new Date(2026, 2, 29),
    new Date(2021, 0, 1)
]

describe('formatMomentPattern', () => {
    test('formats identically to calling moment directly', () => {
        // The whole point of using moment.unix: it must be indistinguishable
        // from moment(date), which is what Periodic Notes itself effectively
        // does when it builds a filename.
        for (const date of DATES) {
            for (const pattern of PATTERNS) {
                expect(formatMomentPattern(date, pattern)).toBe(momentFn(date).format(pattern))
            }
        }
    })

    test('stays in local time rather than shifting to UTC', () => {
        // moment.utc would have been the other reachable namespace function and
        // would silently move a local midnight to the previous day west of UTC.
        const localMidnight = new Date(2026, 7, 30, 0, 0, 0)

        expect(formatMomentPattern(localMidnight, 'YYYY-MM-DD')).toBe('2026-08-30')
    })

    test('a late-evening local time keeps its own date', () => {
        const lateEvening = new Date(2026, 7, 30, 23, 30, 0)

        expect(formatMomentPattern(lateEvening, 'YYYY-MM-DD')).toBe('2026-08-30')
    })
})
