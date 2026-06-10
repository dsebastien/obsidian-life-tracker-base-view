import { test, expect, describe } from 'bun:test'
import { toCsv, sanitizeFilename } from './export.utils'

describe('toCsv (issue #102)', () => {
    test('serializes headers and rows', () => {
        const csv = toCsv(
            ['Date', 'Value'],
            [
                ['2025-01-01', 5],
                ['2025-01-02', 7.5]
            ]
        )
        expect(csv).toBe('Date,Value\n2025-01-01,5\n2025-01-02,7.5')
    })

    test('null values become empty fields', () => {
        const csv = toCsv(['Date', 'Value'], [['2025-01-01', null]])
        expect(csv).toBe('Date,Value\n2025-01-01,')
    })

    test('quotes fields containing commas, quotes or newlines', () => {
        const csv = toCsv(['Label'], [['hello, world'], ['say "hi"'], ['line\nbreak']])
        expect(csv).toBe('Label\n"hello, world"\n"say ""hi"""\n"line\nbreak"')
    })
})

describe('sanitizeFilename (issue #102)', () => {
    test('strips invalid filename characters', () => {
        expect(sanitizeFilename('mood: 1/10 *daily*')).toBe('mood 110 daily')
    })

    test('collapses whitespace and trims', () => {
        expect(sanitizeFilename('  sleep   hours  ')).toBe('sleep hours')
    })

    test('falls back when nothing remains', () => {
        expect(sanitizeFilename('///')).toBe('export')
    })
})
