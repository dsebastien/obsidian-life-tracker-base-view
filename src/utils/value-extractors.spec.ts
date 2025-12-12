import { describe, expect, test } from 'bun:test'
import {
    extractNumber,
    extractDate,
    extractList,
    isDateLike,
    normalizeValue,
    getColorLevel
} from './value-extractors'

// Mock Value type for testing
class MockValue {
    constructor(private value: string) {}
    toString(): string {
        return this.value
    }
}

describe('value-extractors', () => {
    describe('extractNumber', () => {
        test('returns null for null input', () => {
            expect(extractNumber(null)).toBeNull()
        })

        test('extracts integer', () => {
            expect(extractNumber(new MockValue('42') as never)).toBe(42)
        })

        test('extracts float', () => {
            expect(extractNumber(new MockValue('3.14') as never)).toBe(3.14)
        })

        test('extracts negative number', () => {
            expect(extractNumber(new MockValue('-10') as never)).toBe(-10)
        })

        test('returns 1 for "true"', () => {
            expect(extractNumber(new MockValue('true') as never)).toBe(1)
            expect(extractNumber(new MockValue('TRUE') as never)).toBe(1)
        })

        test('returns 1 for "yes"', () => {
            expect(extractNumber(new MockValue('yes') as never)).toBe(1)
            expect(extractNumber(new MockValue('YES') as never)).toBe(1)
        })

        test('returns 0 for "false"', () => {
            expect(extractNumber(new MockValue('false') as never)).toBe(0)
            expect(extractNumber(new MockValue('FALSE') as never)).toBe(0)
        })

        test('returns 0 for "no"', () => {
            expect(extractNumber(new MockValue('no') as never)).toBe(0)
            expect(extractNumber(new MockValue('NO') as never)).toBe(0)
        })

        test('returns null for non-numeric string', () => {
            expect(extractNumber(new MockValue('hello') as never)).toBeNull()
            expect(extractNumber(new MockValue('abc123') as never)).toBeNull()
        })

        test('extracts number from string with leading number', () => {
            expect(extractNumber(new MockValue('123abc') as never)).toBe(123)
        })
    })

    describe('extractDate', () => {
        test('returns null for null input', () => {
            expect(extractDate(null)).toBeNull()
        })

        test('extracts ISO date YYYY-MM-DD', () => {
            const result = extractDate(new MockValue('2024-01-15') as never)
            expect(result).not.toBeNull()
            expect(result!.getFullYear()).toBe(2024)
            expect(result!.getMonth()).toBe(0)
            expect(result!.getDate()).toBe(15)
        })

        test('extracts ISO datetime', () => {
            const result = extractDate(new MockValue('2024-01-15T10:30:00') as never)
            expect(result).not.toBeNull()
            expect(result!.getFullYear()).toBe(2024)
        })

        test('returns null for invalid date', () => {
            expect(extractDate(new MockValue('not-a-date') as never)).toBeNull()
            expect(extractDate(new MockValue('hello') as never)).toBeNull()
        })

        test('returns null for empty string', () => {
            expect(extractDate(new MockValue('') as never)).toBeNull()
        })
    })

    describe('extractList', () => {
        test('returns empty array for null input', () => {
            expect(extractList(null)).toEqual([])
        })

        test('extracts array-like string with double quotes', () => {
            const result = extractList(new MockValue('["a", "b", "c"]') as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('extracts array-like string with single quotes', () => {
            const result = extractList(new MockValue("['a', 'b', 'c']") as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('extracts array-like string without quotes', () => {
            const result = extractList(new MockValue('[a, b, c]') as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('extracts comma-separated values', () => {
            const result = extractList(new MockValue('a, b, c') as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('trims whitespace from items', () => {
            const result = extractList(new MockValue('  a  ,  b  ,  c  ') as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('returns single item as array', () => {
            const result = extractList(new MockValue('single') as never)
            expect(result).toEqual(['single'])
        })

        test('filters out empty items', () => {
            const result = extractList(new MockValue('a, , b, , c') as never)
            expect(result).toEqual(['a', 'b', 'c'])
        })

        test('returns empty array for empty string', () => {
            const result = extractList(new MockValue('') as never)
            expect(result).toEqual([])
        })

        test('returns empty array for whitespace only', () => {
            const result = extractList(new MockValue('   ') as never)
            expect(result).toEqual([])
        })
    })

    describe('isDateLike', () => {
        test('returns false for null input', () => {
            expect(isDateLike(null)).toBe(false)
        })

        test('returns true for ISO date format', () => {
            expect(isDateLike(new MockValue('2024-01-15') as never)).toBe(true)
            expect(isDateLike(new MockValue('2024-12-31') as never)).toBe(true)
        })

        test('returns true for ISO datetime format', () => {
            expect(isDateLike(new MockValue('2024-01-15T10:30:00') as never)).toBe(true)
        })

        test('returns false for non-date strings', () => {
            expect(isDateLike(new MockValue('hello') as never)).toBe(false)
            expect(isDateLike(new MockValue('not a date') as never)).toBe(false)
        })

        test('returns false for numbers', () => {
            expect(isDateLike(new MockValue('12345') as never)).toBe(false)
        })

        test('returns false for empty string', () => {
            expect(isDateLike(new MockValue('') as never)).toBe(false)
        })
    })

    describe('normalizeValue', () => {
        test('normalizes value in range', () => {
            expect(normalizeValue(50, 0, 100)).toBe(0.5)
            expect(normalizeValue(25, 0, 100)).toBe(0.25)
            expect(normalizeValue(75, 0, 100)).toBe(0.75)
        })

        test('returns 0 for min value', () => {
            expect(normalizeValue(0, 0, 100)).toBe(0)
        })

        test('returns 1 for max value', () => {
            expect(normalizeValue(100, 0, 100)).toBe(1)
        })

        test('clamps values below min to 0', () => {
            expect(normalizeValue(-10, 0, 100)).toBe(0)
        })

        test('clamps values above max to 1', () => {
            expect(normalizeValue(150, 0, 100)).toBe(1)
        })

        test('returns 0.5 when min equals max', () => {
            expect(normalizeValue(50, 50, 50)).toBe(0.5)
        })

        test('handles negative ranges', () => {
            expect(normalizeValue(0, -100, 100)).toBe(0.5)
            expect(normalizeValue(-100, -100, 100)).toBe(0)
            expect(normalizeValue(100, -100, 100)).toBe(1)
        })
    })

    describe('getColorLevel', () => {
        test('returns 0 for values <= 0', () => {
            expect(getColorLevel(0)).toBe(0)
            expect(getColorLevel(-0.5)).toBe(0)
        })

        test('returns 1 for values <= 0.25', () => {
            expect(getColorLevel(0.1)).toBe(1)
            expect(getColorLevel(0.25)).toBe(1)
        })

        test('returns 2 for values <= 0.5', () => {
            expect(getColorLevel(0.3)).toBe(2)
            expect(getColorLevel(0.5)).toBe(2)
        })

        test('returns 3 for values <= 0.75', () => {
            expect(getColorLevel(0.6)).toBe(3)
            expect(getColorLevel(0.75)).toBe(3)
        })

        test('returns 4 for values > 0.75', () => {
            expect(getColorLevel(0.8)).toBe(4)
            expect(getColorLevel(1)).toBe(4)
            expect(getColorLevel(1.5)).toBe(4)
        })
    })
})
