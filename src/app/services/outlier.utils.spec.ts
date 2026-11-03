import { describe, expect, test } from 'bun:test'
import {
    MAD_SCALE,
    MAD_Z_THRESHOLD,
    computeOutlierFences,
    quantile,
    withoutOutliers,
    zeroSpreadFences
} from './outlier.utils'

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

    test('a mostly-0 habit series never fences', () => {
        // Median 0: every 1 would otherwise be an outlier
        expect(computeOutlierFences([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1])).toBeNull()
    })

    test('moderately high values are kept (factor 3, not 1.5)', () => {
        // Q1 = 379.5, Q3 = 390.5: 415 is above Q3 + 1.5·IQR (407), within Q3 + 3·IQR (423.5)
        expect(computeOutlierFences([...paces, 415])).toBeNull()
    })
})

describe('computeOutlierFences with no spread between the quartiles (issue #187)', () => {
    /** Meditation minutes: 10 almost every day */
    const tens = [10, 10, 10, 10, 10, 10, 10, 10, 10]

    test('a typo far from a constant series is caught by the ratio rule', () => {
        const fences = computeOutlierFences([...tens, 1000])
        expect(fences).toEqual({ lower: 1, upper: 100 })
    })

    test('a value below a tenth of the median is caught too', () => {
        const fences = computeOutlierFences([...tens, 0.5])
        expect(fences).not.toBeNull()
        expect(0.5).toBeLessThan(fences!.lower)
    })

    test('values within 10× of the median are kept', () => {
        expect(computeOutlierFences([...tens, 99, 2])).toBeNull()
    })

    test('a median of 0 gives no ratio fences', () => {
        expect(computeOutlierFences([0, 0, 0, 0, 0, 0, 0, 0, 0, 500])).toBeNull()
    })

    test('a negative median gives no ratio fences', () => {
        expect(computeOutlierFences([-5, -5, -5, -5, -5, -5, -5, -5, -5, 500])).toBeNull()
    })

    test('still needs at least 8 values', () => {
        expect(computeOutlierFences([10, 10, 10, 10, 10, 10, 1000])).toBeNull()
    })

    test('MAD fences: median ± 3.5 · 1.4826 · MAD when the MAD is positive', () => {
        // Median 3, deviations [0, 1, 2, 7, 8], MAD 2
        const fences = zeroSpreadFences([1, 2, 3, 10, 11])
        const reach = MAD_Z_THRESHOLD * MAD_SCALE * 2
        expect(fences!.lower).toBeCloseTo(3 - reach)
        expect(fences!.upper).toBeCloseTo(3 + reach)
    })

    test('MAD 0 falls back to the ratio to the median', () => {
        expect(zeroSpreadFences([4, 4, 4, 4, 4, 9])).toEqual({ lower: 0.4, upper: 40 })
    })

    test('MAD 0 and median 0: no fences', () => {
        expect(zeroSpreadFences([0, 0, 0, 0, 3])).toBeNull()
    })
})

describe('withoutOutliers (issue #186)', () => {
    test('replaces values beyond the fences with null, keeps the rest', () => {
        const values = [...paces, 49997]
        const result = withoutOutliers(values)
        expect(result.slice(0, paces.length)).toEqual(paces)
        expect(result[paces.length]).toBeNull()
    })

    test('keeps nulls in place', () => {
        const values = [372, null, 380, 385, 390, 377, 395, 388, 383, 49997]
        expect(withoutOutliers(values)).toEqual([
            372,
            null,
            380,
            385,
            390,
            377,
            395,
            388,
            383,
            null
        ])
    })

    test('a series without outliers comes back unchanged, as a copy', () => {
        const result = withoutOutliers(paces)
        expect(result).toEqual(paces)
        expect(result).not.toBe(paces)
    })

    test('uses the zero-spread fallback too (issue #187)', () => {
        expect(withoutOutliers([10, 10, 10, 10, 10, 10, 10, 10, 1000])).toEqual([
            10,
            10,
            10,
            10,
            10,
            10,
            10,
            10,
            null
        ])
    })
})
