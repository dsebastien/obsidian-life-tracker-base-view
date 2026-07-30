import { afterEach, describe, expect, test } from 'bun:test'
import {
    FILENAME_DATE_TOKENS,
    compileFilenameDatePattern,
    getCustomFilenameDatePatterns,
    getDateFromISOWeek,
    matchFilenameDatePattern,
    parseDateFromFilename,
    renderFilenameDatePatternExample,
    setCustomFilenameDatePatterns,
    validateFilenameDatePattern
} from './filename-date.utils'
import type { CompiledFilenameDatePattern } from './filename-date.utils'
import { TimeGranularity } from '../app/types'

/** Compile a pattern, failing the test if it is invalid */
function compile(pattern: string): CompiledFilenameDatePattern {
    const result = compileFilenameDatePattern(pattern)
    if (!result.ok) {
        throw new Error(`Expected "${pattern}" to compile, got: ${result.error}`)
    }
    return result.compiled
}

/** Match a basename against a pattern in one step */
function parseWith(
    pattern: string,
    basename: string
): { date: Date; granularity: TimeGranularity } | null {
    return matchFilenameDatePattern(basename, compile(pattern))
}

afterEach(() => {
    // The configured patterns are module state; keep tests independent
    setCustomFilenameDatePatterns([])
})

describe('filename-date-utils', () => {
    describe('built-in patterns', () => {
        test('parses daily format YYYY-MM-DD', () => {
            const result = parseDateFromFilename('2024-01-15')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Daily)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(0) // January
            expect(result!.date.getDate()).toBe(15)
        })

        test('parses weekly format YYYY-Www', () => {
            const result = parseDateFromFilename('2024-W01')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Weekly)
            expect(result!.date.getFullYear()).toBe(2024)
        })

        test('parses monthly format YYYY-MM', () => {
            const result = parseDateFromFilename('2024-03')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Monthly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(2) // March
        })

        test('parses quarterly format YYYY-Qq', () => {
            const result = parseDateFromFilename('2024-Q2')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Quarterly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(3) // April (Q2 starts)
        })

        test('parses yearly format YYYY', () => {
            const result = parseDateFromFilename('2024')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Yearly)
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(0) // January
        })

        test('returns null for invalid filename', () => {
            expect(parseDateFromFilename('not-a-date')).toBeNull()
            expect(parseDateFromFilename('my-note')).toBeNull()
            expect(parseDateFromFilename('')).toBeNull()
        })
    })

    describe('getDateFromISOWeek', () => {
        test('returns Monday of the given ISO week', () => {
            // Week 1 of 2024 starts on Monday, January 1
            const result = getDateFromISOWeek(2024, 1)
            expect(result).not.toBeNull()
            expect(result!.getDay()).toBe(1) // Monday
        })

        test('returns null for invalid week numbers', () => {
            expect(getDateFromISOWeek(2024, 0)).toBeNull()
            expect(getDateFromISOWeek(2024, 54)).toBeNull()
            expect(getDateFromISOWeek(2024, -1)).toBeNull()
        })

        test('handles week 53 for years that have it', () => {
            // 2020 has 53 weeks
            const result = getDateFromISOWeek(2020, 53)
            expect(result).not.toBeNull()
        })
    })

    describe('compileFilenameDatePattern (issue #139)', () => {
        test('infers daily granularity from {{date}}', () => {
            expect(compile('{{date}}').granularity).toBe(TimeGranularity.Daily)
        })

        test('infers daily granularity from year + month + day', () => {
            expect(compile('{{day}}-{{month}}-{{year}}').granularity).toBe(TimeGranularity.Daily)
        })

        test('infers weekly granularity from year + week', () => {
            expect(compile('{{year}} week {{week}}').granularity).toBe(TimeGranularity.Weekly)
        })

        test('infers quarterly granularity from year + quarter', () => {
            expect(compile('{{year}} {{quarter}}').granularity).toBe(TimeGranularity.Quarterly)
        })

        test('infers monthly granularity from year + month', () => {
            expect(compile('{{year}}_{{month}}').granularity).toBe(TimeGranularity.Monthly)
        })

        test('infers yearly granularity from year alone', () => {
            expect(compile('Review {{year}}').granularity).toBe(TimeGranularity.Yearly)
        })

        test('records one capture group per token, in order', () => {
            expect(compile('{{day}}-{{month}}-{{year}}').groups).toEqual(['day', 'month', 'year'])
        })

        test('accepts tokens case-insensitively and with inner whitespace', () => {
            expect(compileFilenameDatePattern('{{ Date }}').ok).toBe(true)
        })

        test('rejects an empty pattern', () => {
            expect(validateFilenameDatePattern('  ')).toEqual({
                isValid: false,
                error: 'Pattern cannot be empty'
            })
        })

        test('rejects a pattern without tokens', () => {
            const result = validateFilenameDatePattern('Journal')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('at least one {{token}}')
        })

        test('rejects unknown tokens', () => {
            const result = validateFilenameDatePattern('{{year}}-{{weekday}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('Unknown token {{weekday}}')
        })

        test('rejects a repeated token', () => {
            expect(validateFilenameDatePattern('{{year}}-{{year}}')).toEqual({
                isValid: false,
                error: '{{year}} appears more than once'
            })
        })

        test('rejects a pattern without year or date', () => {
            const result = validateFilenameDatePattern('{{month}}-{{day}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('{{date}} or {{year}}')
        })

        test('rejects {{date}} combined with other date tokens', () => {
            const result = validateFilenameDatePattern('{{date}} {{year}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('cannot be combined')
        })

        test('rejects {{day}} without {{month}}', () => {
            expect(validateFilenameDatePattern('{{year}}-{{day}}')).toEqual({
                isValid: false,
                error: '{{day}} requires {{month}}'
            })
        })

        test('rejects {{week}} combined with {{month}}', () => {
            const result = validateFilenameDatePattern('{{year}}-{{month}}-W{{week}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('{{week}} cannot be combined')
        })

        test('rejects {{quarter}} combined with {{month}}', () => {
            const result = validateFilenameDatePattern('{{year}}-{{month}}-{{quarter}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('{{quarter}} cannot be combined')
        })

        test('rejects {{week}} combined with {{quarter}}', () => {
            const result = validateFilenameDatePattern('{{year}}-{{quarter}}-W{{week}}')
            expect(result.isValid).toBe(false)
            expect(result.error).toContain('{{week}} cannot be combined with {{quarter}}')
        })

        test('rejects unbalanced braces', () => {
            expect(validateFilenameDatePattern('{{date}} {{stray}')).toEqual({
                isValid: false,
                error: 'Unbalanced {{ }} in pattern'
            })
        })
    })

    describe('matchFilenameDatePattern (issue #139)', () => {
        test('matches a prefixed daily filename', () => {
            const result = parseWith('Journal {{date}}', 'Journal 2026-07-30')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Daily)
            expect(result!.date.getFullYear()).toBe(2026)
            expect(result!.date.getMonth()).toBe(6)
            expect(result!.date.getDate()).toBe(30)
        })

        test('matches a compact daily filename', () => {
            const result = parseWith('{{year}}{{month}}{{day}}', '20260730')
            expect(result).not.toBeNull()
            expect(result!.date.getFullYear()).toBe(2026)
            expect(result!.date.getMonth()).toBe(6)
            expect(result!.date.getDate()).toBe(30)
        })

        test('matches a day-first filename', () => {
            const result = parseWith('{{day}}.{{month}}.{{year}}', '30.07.2026')
            expect(result).not.toBeNull()
            expect(result!.date.getDate()).toBe(30)
            expect(result!.date.getMonth()).toBe(6)
        })

        test('matches ISO weeks with and without a leading zero', () => {
            const padded = parseWith('{{year}}-W{{week}}', '2026-W05')
            const unpadded = parseWith('{{year}}-W{{week}}', '2026-W5')
            expect(padded).not.toBeNull()
            expect(unpadded).not.toBeNull()
            expect(padded!.date.getTime()).toBe(unpadded!.date.getTime())
            expect(padded!.granularity).toBe(TimeGranularity.Weekly)
        })

        test('matches quarters, anchoring to the first day of the quarter', () => {
            const result = parseWith('{{year}} {{quarter}} review', '2026 Q3 review')
            expect(result).not.toBeNull()
            expect(result!.date.getMonth()).toBe(6) // July
            expect(result!.date.getDate()).toBe(1)
        })

        test('matches literals case-insensitively', () => {
            expect(parseWith('Journal {{date}}', 'journal 2026-07-30')).not.toBeNull()
        })

        test('treats * as a wildcard', () => {
            expect(parseWith('* {{date}}', 'Morning pages 2026-07-30')).not.toBeNull()
            expect(parseWith('{{date}}*', '2026-07-30 (Thursday)')).not.toBeNull()
        })

        test('requires the whole basename to match', () => {
            expect(parseWith('Journal {{date}}', 'Journal 2026-07-30 draft')).toBeNull()
            expect(parseWith('{{date}}', 'note 2026-07-30')).toBeNull()
        })

        test('rejects impossible calendar dates', () => {
            expect(parseWith('{{day}}-{{month}}-{{year}}', '31-02-2026')).toBeNull()
            expect(parseWith('{{date}}', '2026-02-31')).toBeNull()
            expect(parseWith('{{year}}-{{month}}', '2026-13')).toBeNull()
        })

        test('accepts a leap day in a leap year', () => {
            const result = parseWith('{{date}}', '2024-02-29')
            expect(result).not.toBeNull()
            expect(result!.date.getMonth()).toBe(1)
            expect(result!.date.getDate()).toBe(29)
        })

        test('escapes regex metacharacters in literals', () => {
            expect(parseWith('({{year}})', '(2026)')).not.toBeNull()
            expect(parseWith('({{year}})', 'X2026Y')).toBeNull()
        })
    })

    describe('setCustomFilenameDatePatterns (issue #139)', () => {
        test('makes custom patterns usable by parseDateFromFilename', () => {
            expect(parseDateFromFilename('Journal 2026-07-30')).toBeNull()

            setCustomFilenameDatePatterns(['Journal {{date}}'])

            const result = parseDateFromFilename('Journal 2026-07-30')
            expect(result).not.toBeNull()
            expect(result!.granularity).toBe(TimeGranularity.Daily)
            expect(result!.date.getDate()).toBe(30)
        })

        test('keeps the built-in patterns working as a fallback', () => {
            setCustomFilenameDatePatterns(['Journal {{date}}'])
            expect(parseDateFromFilename('2026-07-30')).not.toBeNull()
        })

        test('applies custom patterns in order', () => {
            setCustomFilenameDatePatterns(['{{year}}-{{month}}', '{{year}}'])
            const patterns = getCustomFilenameDatePatterns()
            expect(patterns).toHaveLength(2)
            expect(patterns[0]!.granularity).toBe(TimeGranularity.Monthly)
        })

        test('skips invalid patterns instead of throwing', () => {
            setCustomFilenameDatePatterns(['{{nope}}', 'Journal {{date}}'])
            expect(getCustomFilenameDatePatterns()).toHaveLength(1)
            expect(parseDateFromFilename('Journal 2026-07-30')).not.toBeNull()
        })

        test('clears previously configured patterns', () => {
            setCustomFilenameDatePatterns(['Journal {{date}}'])
            setCustomFilenameDatePatterns([])
            expect(getCustomFilenameDatePatterns()).toHaveLength(0)
            expect(parseDateFromFilename('Journal 2026-07-30')).toBeNull()
        })
    })

    describe('renderFilenameDatePatternExample (issue #139)', () => {
        const date = new Date(2026, 6, 30) // Thursday, July 30th 2026 (ISO week 31)

        test('renders every token', () => {
            expect(renderFilenameDatePatternExample('{{date}}', date)).toBe('2026-07-30')
            expect(renderFilenameDatePatternExample('{{year}}-{{month}}-{{day}}', date)).toBe(
                '2026-07-30'
            )
            expect(renderFilenameDatePatternExample('{{year}}-W{{week}}', date)).toBe('2026-W31')
            expect(renderFilenameDatePatternExample('{{year}}-{{quarter}}', date)).toBe('2026-Q3')
        })

        test('keeps literals and replaces wildcards with an ellipsis', () => {
            expect(renderFilenameDatePatternExample('Journal * {{date}}', date)).toBe(
                'Journal … 2026-07-30'
            )
        })

        test('leaves unknown tokens untouched', () => {
            expect(renderFilenameDatePatternExample('{{nope}} {{year}}', date)).toBe(
                '{{nope}} 2026'
            )
        })
    })

    describe('FILENAME_DATE_TOKENS', () => {
        test('every token renders a value matching its own matcher', () => {
            const date = new Date(2026, 6, 30)
            for (const token of FILENAME_DATE_TOKENS) {
                const rendered = token.render(date)
                expect(new RegExp(`^${token.matcher}$`).test(rendered)).toBe(true)
            }
        })
    })
})
