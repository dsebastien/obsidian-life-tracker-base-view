import { test, expect, describe } from 'bun:test'
import { areAllValuesIntegers, formatMetricValue } from './chart-format.utils'

describe('areAllValuesIntegers', () => {
    test('true for whole numbers and nulls', () => {
        expect(areAllValuesIntegers([1, 2, 3])).toBe(true)
        expect(areAllValuesIntegers([0, null, 5, undefined])).toBe(true)
        expect(areAllValuesIntegers([])).toBe(true)
    })

    test('false when any value has a fractional part', () => {
        expect(areAllValuesIntegers([1, 2.5, 3])).toBe(false)
        expect(areAllValuesIntegers([0.1])).toBe(false)
    })

    test('negative integers count as integers', () => {
        expect(areAllValuesIntegers([-1, -2, 0])).toBe(true)
    })
})

describe('formatMetricValue', () => {
    test('drops decimals for integer-only datasets', () => {
        expect(formatMetricValue(3, true)).toBe('3')
        expect(formatMetricValue(3.0, true)).toBe('3')
    })

    test('keeps up to two decimals otherwise', () => {
        expect(formatMetricValue(3.5, false)).toBe('3.5')
        expect(formatMetricValue(3, false)).toBe('3')
    })

    test('rounds to at most two fraction digits', () => {
        expect(formatMetricValue(3.14159, false)).toBe('3.14')
    })
})
