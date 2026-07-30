import { describe, expect, test } from 'bun:test'
import {
    parseEmojiKey,
    isValidEmojiKey,
    resolveValueEmoji,
    formatValueWithEmoji,
    listEmojiEntries,
    findEmojiEntry
} from './emoji-mapping.utils'

describe('parseEmojiKey (issue #22)', () => {
    test('reads a plain number as an exact key', () => {
        expect(parseEmojiKey('3')).toEqual({ kind: 'exact', value: 3 })
        expect(parseEmojiKey('0')).toEqual({ kind: 'exact', value: 0 })
        expect(parseEmojiKey('1.5')).toEqual({ kind: 'exact', value: 1.5 })
    })

    test('a lone negative number stays an exact key, not a half-parsed range', () => {
        expect(parseEmojiKey('-1')).toEqual({ kind: 'exact', value: -1 })
    })

    test('reads a range with either separator', () => {
        expect(parseEmojiKey('1-2')).toEqual({ kind: 'range', min: 1, max: 2 })
        expect(parseEmojiKey('1..2')).toEqual({ kind: 'range', min: 1, max: 2 })
        expect(parseEmojiKey('0-10')).toEqual({ kind: 'range', min: 0, max: 10 })
    })

    test('reads ranges with negative bounds', () => {
        expect(parseEmojiKey('-5--1')).toEqual({ kind: 'range', min: -5, max: -1 })
        expect(parseEmojiKey('-5..-1')).toEqual({ kind: 'range', min: -5, max: -1 })
        expect(parseEmojiKey('-2-3')).toEqual({ kind: 'range', min: -2, max: 3 })
    })

    test('normalizes a reversed range rather than rejecting it', () => {
        expect(parseEmojiKey('5-1')).toEqual({ kind: 'range', min: 1, max: 5 })
    })

    test('tolerates surrounding whitespace', () => {
        expect(parseEmojiKey('  3  ')).toEqual({ kind: 'exact', value: 3 })
        expect(parseEmojiKey('1 - 2')).toEqual({ kind: 'range', min: 1, max: 2 })
    })

    test('rejects a digit string long enough to overflow to Infinity', () => {
        // Number('9'.repeat(400)) is Infinity, which no cell value can equal —
        // offering it as a key would create a button that never matches
        const overflowing = '9'.repeat(400)
        expect(Number(overflowing)).toBe(Infinity)
        expect(parseEmojiKey(overflowing)).toBeNull()
        expect(isValidEmojiKey(overflowing)).toBe(false)
    })

    test('rejects keys that are neither a value nor a range', () => {
        expect(parseEmojiKey('')).toBeNull()
        expect(parseEmojiKey('   ')).toBeNull()
        expect(parseEmojiKey('good')).toBeNull()
        expect(parseEmojiKey('1-')).toBeNull()
        expect(parseEmojiKey('-')).toBeNull()
        expect(parseEmojiKey('1-2-3')).toBeNull()
        expect(parseEmojiKey('NaN')).toBeNull()
    })

    test('isValidEmojiKey mirrors the parser', () => {
        expect(isValidEmojiKey('3')).toBe(true)
        expect(isValidEmojiKey('1-2')).toBe(true)
        expect(isValidEmojiKey('nope')).toBe(false)
    })
})

describe('resolveValueEmoji (issue #22)', () => {
    const exact = { '1': '😞', '3': '😐', '5': '😄' }
    const ranges = { '0-4': '😞', '5-7': '😐', '8-10': '😄' }

    test('matches exact values', () => {
        expect(resolveValueEmoji(1, exact)).toBe('😞')
        expect(resolveValueEmoji(3, exact)).toBe('😐')
        expect(resolveValueEmoji(5, exact)).toBe('😄')
    })

    test('returns null when nothing matches', () => {
        expect(resolveValueEmoji(2, exact)).toBeNull()
        expect(resolveValueEmoji(11, ranges)).toBeNull()
    })

    test('matches ranges inclusively at both bounds', () => {
        expect(resolveValueEmoji(0, ranges)).toBe('😞')
        expect(resolveValueEmoji(4, ranges)).toBe('😞')
        expect(resolveValueEmoji(5, ranges)).toBe('😐')
        expect(resolveValueEmoji(7, ranges)).toBe('😐')
        expect(resolveValueEmoji(8, ranges)).toBe('😄')
        expect(resolveValueEmoji(10, ranges)).toBe('😄')
    })

    test('an exact key beats a range that also contains the value', () => {
        // Order matters: the range is declared first, so this only passes if
        // exact matches genuinely take precedence rather than winning by luck
        const mixed = { '0-10': '🙂', '10': '🎉' }
        expect(resolveValueEmoji(10, mixed)).toBe('🎉')
        expect(resolveValueEmoji(5, mixed)).toBe('🙂')
    })

    test('among overlapping ranges the first configured one wins', () => {
        const overlapping = { '0-5': '🙂', '3-8': '😐' }
        expect(resolveValueEmoji(4, overlapping)).toBe('🙂')
        expect(resolveValueEmoji(7, overlapping)).toBe('😐')
    })

    test('handles fractional and negative values', () => {
        expect(resolveValueEmoji(1.5, { '1-2': '🙂' })).toBe('🙂')
        expect(resolveValueEmoji(-3, { '-5--1': '😞' })).toBe('😞')
    })

    test('returns null for missing values and missing mappings', () => {
        expect(resolveValueEmoji(null, exact)).toBeNull()
        expect(resolveValueEmoji(undefined, exact)).toBeNull()
        expect(resolveValueEmoji(3, null)).toBeNull()
        expect(resolveValueEmoji(3, undefined)).toBeNull()
        expect(resolveValueEmoji(3, {})).toBeNull()
    })

    test('returns null for non-finite values rather than matching a range', () => {
        expect(resolveValueEmoji(NaN, ranges)).toBeNull()
        expect(resolveValueEmoji(Infinity, ranges)).toBeNull()
    })

    test('skips entries with an unparseable key or an empty emoji', () => {
        expect(resolveValueEmoji(3, { 'three': '😐', '3': '' })).toBeNull()
        expect(resolveValueEmoji(3, { 'three': '😐', '3': '😄' })).toBe('😄')
    })
})

describe('formatValueWithEmoji', () => {
    const mapping = { '1': '😞', '5': '😄' }

    test('prefixes the emoji when there is one', () => {
        expect(formatValueWithEmoji(5, mapping, '5.00')).toBe('😄 5.00')
    })

    test('leaves the formatted value alone when there is no match', () => {
        expect(formatValueWithEmoji(3, mapping, '3.00')).toBe('3.00')
        expect(formatValueWithEmoji(3, null, '3.00')).toBe('3.00')
        expect(formatValueWithEmoji(null, mapping, 'No data')).toBe('No data')
    })
})

describe('listEmojiEntries', () => {
    test('lists entries in configured order with the value to record', () => {
        expect(listEmojiEntries({ '1': '😞', '3-5': '🙂' })).toEqual([
            { key: '1', emoji: '😞', value: 1 },
            // A range records its lower bound — the only member we can name
            { key: '3-5', emoji: '🙂', value: 3 }
        ])
    })

    test('skips unusable entries', () => {
        expect(listEmojiEntries({ 'bad': '😞', '2': '', '3': '😄' })).toEqual([
            { key: '3', emoji: '😄', value: 3 }
        ])
    })

    test('returns an empty list for no mapping', () => {
        expect(listEmojiEntries(null)).toEqual([])
        expect(listEmojiEntries(undefined)).toEqual([])
        expect(listEmojiEntries({})).toEqual([])
    })
})

describe('findEmojiEntry — selection precedence (issue #22)', () => {
    test('identifies the entry, not just the emoji, for a value inside a range', () => {
        // The capture modal highlights by key: matching on the range's lower
        // bound alone would leave 2, 3 and 4 with no button highlighted
        const mapping = { '1-5': '😄' }
        for (const value of [1, 2, 3, 4, 5]) {
            expect(findEmojiEntry(value, mapping)).toEqual({ key: '1-5', emoji: '😄', value: 1 })
        }
    })

    test('picks exactly one entry when ranges share a lower bound', () => {
        const mapping = { '1-3': '🙂', '1-9': '😐' }
        expect(findEmojiEntry(1, mapping)?.key).toBe('1-3')
        expect(findEmojiEntry(5, mapping)?.key).toBe('1-9')
    })

    test('agrees with resolveValueEmoji in every case', () => {
        const mapping = { '0-4': '😞', '5': '😐', '6-10': '😄' }
        for (const value of [-1, 0, 2, 4, 5, 6, 10, 11]) {
            expect(findEmojiEntry(value, mapping)?.emoji ?? null).toBe(
                resolveValueEmoji(value, mapping)
            )
        }
    })

    test('returns null for no match, no mapping, or a non-finite value', () => {
        expect(findEmojiEntry(9, { '1-5': '😄' })).toBeNull()
        expect(findEmojiEntry(1, null)).toBeNull()
        expect(findEmojiEntry(NaN, { '1-5': '😄' })).toBeNull()
    })
})
