import { describe, expect, test } from 'bun:test'
import { computeOutlierFences, quantile } from './outlier.utils'

/** Ten paces around 6:20, in seconds */
const paces = [372, 380, 385, 390, 377, 395, 388, 383, 379, 391]

describe('quantile', () => {
    test('interpolates between closest ranks', () => {
        expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75)
        expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
        expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25)
        expect(quantile([5], 0.75)).toBe(5)
    })

    test('empty input is NaN', () => {
        expect(quantile([], 0.5)).toBeNaN()
    })
})

describe('computeOutlierFences (3.4.0)', () => {
    test('a flagrant value is outside the fences', () => {
        const fences = computeOutlierFences([...paces, 49997])
        expect(fences).not.toBeNull()
        expect(fences!.upper).toBeLessThan(49997)
        expect(fences!.upper).toBeGreaterThan(395)
        expect(fences!.lower).toBeLessThan(372)
    })

    test('a low outlier is caught too', () => {
        const fences = computeOutlierFences([...paces, 3])
        expect(fences).not.toBeNull()
        expect(fences!.lower).toBeGreaterThan(3)
    })

    test('nothing excluded means no fences', () => {
        expect(computeOutlierFences(paces)).toBeNull()
    })

    test('fewer than 8 values never fence', () => {
        expect(computeOutlierFences([380, 385, 390, 377, 395, 388, 49997])).toBeNull()
    })

    test('nulls do not count as values', () => {
        expect(computeOutlierFences([380, null, 385, null, 390, 377, 395, 388, 49997])).toBeNull()
    })

    test('no spread between the quartiles never fences', () => {
        // A habit logged as 0 most days: every 1 would otherwise be an outlier
        expect(computeOutlierFences([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1])).toBeNull()
    })

    test('moderately high values are kept (factor 3, not 1.5)', () => {
        // Q1 = 379.5, Q3 = 390.5: 415 is above Q3 + 1.5·IQR (407), within Q3 + 3·IQR (423.5)
        expect(computeOutlierFences([...paces, 415])).toBeNull()
    })
})
