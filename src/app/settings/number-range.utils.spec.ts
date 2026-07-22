import { test, expect, describe } from 'bun:test'
import { computeNumberRange } from './number-range.utils'

describe('computeNumberRange', () => {
    test('both bounds present: used as-is, no inference', () => {
        const r = computeNumberRange('max', 10, { min: 1, max: 5 })
        expect(r.range).toEqual({ min: 1, max: 10 })
        expect(r.inferred).toBeNull()
    })

    test('only min: infers max = min + 100', () => {
        const r = computeNumberRange('min', 5, null)
        expect(r.range).toEqual({ min: 5, max: 105 })
        expect(r.inferred).toEqual({ bound: 'Max', value: 105 })
    })

    test('only max: infers min = 0', () => {
        const r = computeNumberRange('max', 20, null)
        expect(r.range).toEqual({ min: 0, max: 20 })
        expect(r.inferred).toEqual({ bound: 'Min', value: 0 })
    })

    test('clearing the only bound yields no constraint', () => {
        const r = computeNumberRange('min', null, { min: 5, max: 105 })
        // min cleared, max still 105 -> keeps min:0 inference
        expect(r.range).toEqual({ min: 0, max: 105 })
    })

    test('clearing both bounds yields null range', () => {
        const r = computeNumberRange('max', null, { min: 5, max: 105 })
        // max cleared, min still 5 -> infers max again
        expect(r.range).toEqual({ min: 5, max: 105 })
        // and clearing min when max already absent:
        const cleared = computeNumberRange('min', null, null)
        expect(cleared.range).toBeNull()
        expect(cleared.inferred).toBeNull()
    })

    test('preserves an existing step', () => {
        const r = computeNumberRange('max', 10, { min: 0, max: 5, step: 0.5 })
        expect(r.range).toEqual({ min: 0, max: 10, step: 0.5 })
    })

    test('inferred bound also preserves step', () => {
        const r = computeNumberRange('min', 2, { min: 1, max: 5, step: 1 })
        // max not "changed" but existing max present -> both bounds, keep step
        expect(r.range).toEqual({ min: 2, max: 5, step: 1 })
    })
})
