import { describe, expect, test } from 'bun:test'
import type { NumberRange } from '../../types'
import { computeSteppedValue, stepSizeFor, DEFAULT_NUMBER_STEP } from './number-step.utils'

const range = (min: number, max: number, step?: number): NumberRange =>
    step === undefined ? { min, max } : { min, max, step }

describe('stepSizeFor (issue #125)', () => {
    test('falls back to 1 without a range or step', () => {
        expect(stepSizeFor(null)).toBe(DEFAULT_NUMBER_STEP)
        expect(stepSizeFor(range(0, 10))).toBe(1)
    })

    test('uses the property step when positive', () => {
        expect(stepSizeFor(range(0, 10, 0.5))).toBe(0.5)
        expect(stepSizeFor(range(0, 10, 5))).toBe(5)
    })

    test('ignores a zero or negative step', () => {
        expect(stepSizeFor(range(0, 10, 0))).toBe(1)
        expect(stepSizeFor(range(0, 10, -2))).toBe(1)
    })
})

describe('computeSteppedValue (issue #125)', () => {
    describe('counters (no range)', () => {
        test('increments and decrements by one', () => {
            expect(computeSteppedValue(3, 1, null)).toBe(4)
            expect(computeSteppedValue(3, -1, null)).toBe(2)
        })

        test('first increment from empty gives one step', () => {
            expect(computeSteppedValue(null, 1, null)).toBe(1)
        })

        test('first decrement from empty stops at zero instead of going negative', () => {
            expect(computeSteppedValue(null, -1, null)).toBe(0)
        })

        test('allows going negative once a value exists', () => {
            expect(computeSteppedValue(0, -1, null)).toBe(-1)
        })
    })

    describe('bounded properties', () => {
        test('first tap in either direction lands on the minimum', () => {
            expect(computeSteppedValue(null, 1, range(1, 5))).toBe(1)
            expect(computeSteppedValue(null, -1, range(1, 5))).toBe(1)
        })

        test('clamps at the maximum', () => {
            expect(computeSteppedValue(5, 1, range(1, 5))).toBe(5)
            expect(computeSteppedValue(4, 1, range(1, 5))).toBe(5)
        })

        test('clamps at the minimum', () => {
            expect(computeSteppedValue(1, -1, range(1, 5))).toBe(1)
        })

        test('a value outside the range is pulled back inside', () => {
            expect(computeSteppedValue(99, 1, range(1, 5))).toBe(5)
            expect(computeSteppedValue(-99, -1, range(1, 5))).toBe(1)
        })
    })

    describe('fractional steps', () => {
        test('uses the configured step', () => {
            expect(computeSteppedValue(2, 1, range(0, 10, 0.5))).toBe(2.5)
            expect(computeSteppedValue(2, -1, range(0, 10, 0.5))).toBe(1.5)
        })

        test('does not accumulate binary-float noise', () => {
            expect(computeSteppedValue(0.1, 1, range(0, 10, 0.2))).toBe(0.3)
            expect(computeSteppedValue(82.75, 1, range(0, 200, 0.05))).toBe(82.8)
        })
    })
})
