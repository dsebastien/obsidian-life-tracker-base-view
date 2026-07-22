import { test, expect, describe } from 'bun:test'
import { minOf, maxOf } from './number.utils'

describe('minOf / maxOf', () => {
    test('return the extremes of a normal array', () => {
        expect(minOf([3, 1, 2])).toBe(1)
        expect(maxOf([3, 1, 2])).toBe(3)
    })

    test('handle negatives and a single element', () => {
        expect(minOf([-5, -1, -10])).toBe(-10)
        expect(maxOf([-5, -1, -10])).toBe(-1)
        expect(minOf([42])).toBe(42)
        expect(maxOf([42])).toBe(42)
    })

    test('return undefined for an empty array', () => {
        expect(minOf([])).toBeUndefined()
        expect(maxOf([])).toBeUndefined()
    })

    test('do not overflow the stack on very large arrays', () => {
        // Math.min(...arr) throws "Maximum call stack size exceeded" around here;
        // the reduce-based fold must not.
        const big = Array.from({ length: 500_000 }, (_, i) => i)
        expect(maxOf(big)).toBe(499_999)
        expect(minOf(big)).toBe(0)
    })
})
