import { test, expect, describe } from 'bun:test'
import { NUMBER_INPUT_ATTRS, NUMBER_SLIDER_STEP } from './editing.constants'

/**
 * The number editor's HTML5 `pattern` is the exact surface that broke issue
 * #120: the old `[0-9]*` rejected decimals on blur/submit. These tests guard
 * the pattern against regressing to integer-only by exercising it the way the
 * browser does — anchored, whole-string match.
 */
describe('NUMBER_INPUT_ATTRS.pattern', () => {
    // HTML5 pattern validation is implicitly anchored to the whole value.
    const matches = (value: string): boolean =>
        new RegExp(`^(?:${NUMBER_INPUT_ATTRS.pattern})$`).test(value)

    test('accepts integers', () => {
        expect(matches('188')).toBe(true)
        expect(matches('0')).toBe(true)
        expect(matches('2743')).toBe(true)
    })

    test('accepts decimals (the issue #120 case)', () => {
        expect(matches('82.75')).toBe(true)
        expect(matches('7.5')).toBe(true)
        expect(matches('0.01')).toBe(true)
    })

    test('accepts negative integers and decimals', () => {
        expect(matches('-1')).toBe(true)
        expect(matches('-1.5')).toBe(true)
    })

    test('accepts partial input mid-typing', () => {
        // The user is still typing; the field must not be rejected before completion.
        expect(matches('')).toBe(true)
        expect(matches('82.')).toBe(true)
        expect(matches('.5')).toBe(true)
    })

    test('rejects non-numeric content', () => {
        expect(matches('82.75kg')).toBe(false)
        expect(matches('abc')).toBe(false)
        expect(matches('1,5')).toBe(false)
        expect(matches('1e3')).toBe(false)
    })
})

describe('number input metadata', () => {
    test('inputmode requests the decimal keypad on mobile', () => {
        expect(NUMBER_INPUT_ATTRS.inputmode).toBe('decimal')
    })

    test('slider step allows fractional values', () => {
        expect(Number(NUMBER_SLIDER_STEP)).toBeLessThan(1)
        expect(Number(NUMBER_SLIDER_STEP)).toBeGreaterThan(0)
    })
})
