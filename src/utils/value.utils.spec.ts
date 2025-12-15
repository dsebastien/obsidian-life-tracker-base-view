import { describe, expect, test } from 'bun:test'
import { extractNumber, extractBoolean, extractDate, extractList, isDateLike } from './value.utils'

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

        test('returns null for "true" (boolean handled by extractBoolean)', () => {
            expect(extractNumber(new MockValue('true') as never)).toBeNull()
            expect(extractNumber(new MockValue('TRUE') as never)).toBeNull()
        })

        test('returns null for "yes" (boolean handled by extractBoolean)', () => {
            expect(extractNumber(new MockValue('yes') as never)).toBeNull()
            expect(extractNumber(new MockValue('YES') as never)).toBeNull()
        })

        test('returns null for "false" (boolean handled by extractBoolean)', () => {
            expect(extractNumber(new MockValue('false') as never)).toBeNull()
            expect(extractNumber(new MockValue('FALSE') as never)).toBeNull()
        })

        test('returns null for "no" (boolean handled by extractBoolean)', () => {
            expect(extractNumber(new MockValue('no') as never)).toBeNull()
            expect(extractNumber(new MockValue('NO') as never)).toBeNull()
        })

        test('returns null for non-numeric string', () => {
            expect(extractNumber(new MockValue('hello') as never)).toBeNull()
            expect(extractNumber(new MockValue('abc123') as never)).toBeNull()
        })

        test('extracts number from string with leading number', () => {
            expect(extractNumber(new MockValue('123abc') as never)).toBe(123)
        })

        test('returns null for actual boolean type', () => {
            expect(extractNumber(true)).toBeNull()
            expect(extractNumber(false)).toBeNull()
        })

        test('returns number for actual number type', () => {
            expect(extractNumber(42)).toBe(42)
            expect(extractNumber(3.14)).toBe(3.14)
            expect(extractNumber(-10)).toBe(-10)
        })

        test('returns null for NaN', () => {
            expect(extractNumber(NaN)).toBeNull()
        })
    })

    describe('extractBoolean', () => {
        test('returns null for null input', () => {
            expect(extractBoolean(null)).toBeNull()
        })

        test('returns null for undefined input', () => {
            expect(extractBoolean(undefined)).toBeNull()
        })

        test('returns true for boolean true', () => {
            expect(extractBoolean(true)).toBe(true)
        })

        test('returns false for boolean false', () => {
            expect(extractBoolean(false)).toBe(false)
        })

        test('returns true for "true" string', () => {
            expect(extractBoolean(new MockValue('true') as never)).toBe(true)
            expect(extractBoolean(new MockValue('TRUE') as never)).toBe(true)
            expect(extractBoolean(new MockValue('True') as never)).toBe(true)
        })

        test('returns true for "yes" string', () => {
            expect(extractBoolean(new MockValue('yes') as never)).toBe(true)
            expect(extractBoolean(new MockValue('YES') as never)).toBe(true)
            expect(extractBoolean(new MockValue('Yes') as never)).toBe(true)
        })

        test('returns false for "false" string', () => {
            expect(extractBoolean(new MockValue('false') as never)).toBe(false)
            expect(extractBoolean(new MockValue('FALSE') as never)).toBe(false)
            expect(extractBoolean(new MockValue('False') as never)).toBe(false)
        })

        test('returns false for "no" string', () => {
            expect(extractBoolean(new MockValue('no') as never)).toBe(false)
            expect(extractBoolean(new MockValue('NO') as never)).toBe(false)
            expect(extractBoolean(new MockValue('No') as never)).toBe(false)
        })

        test('returns null for non-boolean string', () => {
            expect(extractBoolean(new MockValue('hello') as never)).toBeNull()
            expect(extractBoolean(new MockValue('maybe') as never)).toBeNull()
        })

        test('returns null for numbers (handled by extractNumber)', () => {
            expect(extractBoolean(42)).toBeNull()
            expect(extractBoolean(0)).toBeNull()
            expect(extractBoolean(1)).toBeNull()
        })

        test('returns null for empty string', () => {
            expect(extractBoolean(new MockValue('') as never)).toBeNull()
        })

        test('returns null for "null" string', () => {
            expect(extractBoolean(new MockValue('null') as never)).toBeNull()
        })

        test('returns null for "undefined" string', () => {
            expect(extractBoolean(new MockValue('undefined') as never)).toBeNull()
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

        test('extracts European DD/MM/YYYY format', () => {
            const result = extractDate(new MockValue('15/01/2024') as never)
            expect(result).not.toBeNull()
            expect(result!.getFullYear()).toBe(2024)
            expect(result!.getMonth()).toBe(0)
            expect(result!.getDate()).toBe(15)
        })

        test('extracts DD-MM-YYYY format', () => {
            const result = extractDate(new MockValue('15-01-2024') as never)
            expect(result).not.toBeNull()
            expect(result!.getFullYear()).toBe(2024)
            expect(result!.getMonth()).toBe(0)
            expect(result!.getDate()).toBe(15)
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

        test('returns true for European DD/MM/YYYY format', () => {
            expect(isDateLike(new MockValue('15/01/2024') as never)).toBe(true)
            expect(isDateLike(new MockValue('31/12/2024') as never)).toBe(true)
        })

        test('returns true for DD-MM-YYYY format', () => {
            expect(isDateLike(new MockValue('15-01-2024') as never)).toBe(true)
        })

        test('returns true for DD.MM.YYYY format', () => {
            expect(isDateLike(new MockValue('15.01.2024') as never)).toBe(true)
        })

        test('returns true for YYYY/MM/DD format', () => {
            expect(isDateLike(new MockValue('2024/01/15') as never)).toBe(true)
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
})
