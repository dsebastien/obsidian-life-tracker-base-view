/**
 * Outlier detection for chart scales (3.4.0; zero-spread fallback, issue #187).
 *
 * One bad entry (a pace of 49997 s/km among values around 380) used to set a
 * line chart's y-axis to 0–50,000 and flatten every real value into a line at
 * the bottom. The scale is now fitted to the bulk of the data, and values
 * beyond Tukey's "far out" fences are drawn at the edge of the axis instead.
 */

/** Tukey's multiplier for "far out" values: only flagrant outliers */
export const OUTLIER_FENCE_FACTOR = 3

/** Below this many values, quartiles are too unstable to call anything an outlier */
export const OUTLIER_MIN_POINTS = 8

/**
 * Quantile of sorted values, linear interpolation between closest ranks (the
 * common "type 7" definition, as in spreadsheets and NumPy's default).
 */
export function quantile(sorted: readonly number[], q: number): number {
    if (sorted.length === 0) return Number.NaN
    const position = (sorted.length - 1) * q
    const lower = Math.floor(position)
    const upper = Math.ceil(position)
    const lowerValue = sorted[lower]!
    const upperValue = sorted[upper]!
    return lowerValue + (upperValue - lowerValue) * (position - lower)
}

/** Inclusive range outside of which a value is an outlier */
export interface OutlierFences {
    lower: number
    upper: number
}

/**
 * Modified z-score above which a value is an outlier when the quartiles have
 * no spread (issue #187): |x − median| / (1.4826 · MAD) > 3.5, the threshold
 * of Iglewicz and Hoaglin
 */
export const MAD_Z_THRESHOLD = 3.5

/** Scales the median absolute deviation to a standard deviation for normal data */
export const MAD_SCALE = 1.4826

/**
 * Last resort when both the IQR and the MAD are 0 (issue #187): a value more
 * than 10 times the median is an outlier. High values only, and only with a
 * positive median: a 0 in a series of mostly the same value is a real value
 * (a missed day), not a typo
 */
export const OUTLIER_RATIO_LIMIT = 10

/**
 * Fences for a series whose quartiles are equal (IQR = 0), or null when none
 * apply. Median absolute deviation first; when it is 0 too, an upper fence
 * at 10 × the median (median > 0 only, no lower fence).
 *
 * Equal quartiles put more than half the values on the median, which makes
 * the MAD 0 as well: in practice the ratio rule decides. The MAD step is
 * kept so the rule stays correct if the quartile definition ever changes.
 * Input must be sorted ascending.
 */
export function zeroSpreadFences(sorted: readonly number[]): OutlierFences | null {
    const median = quantile(sorted, 0.5)
    const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b)
    const mad = quantile(deviations, 0.5)
    if (mad > 0) {
        const reach = MAD_Z_THRESHOLD * MAD_SCALE * mad
        return { lower: median - reach, upper: median + reach }
    }
    if (median > 0) {
        return { lower: Number.NEGATIVE_INFINITY, upper: median * OUTLIER_RATIO_LIMIT }
    }
    return null
}

/**
 * Outlier fences for a series, or null when they do not apply: fewer than 8
 * values, only 0s and 1s (a checkbox or yes/no habit has no outliers), or
 * nothing actually falls outside them. Nulls and non-finite values are
 * ignored.
 *
 * - Tukey's far-out fences, Q1 − 3·IQR and Q3 + 3·IQR, when the quartiles
 *   have a spread
 * - IQR = 0 (issue #187: meditation minutes 10, 10, 10 … and one typo of
 *   1000): median ± 3.5 · 1.4826 · MAD; when the MAD is 0 too, values above
 *   10 × a positive median; no fences otherwise
 */
export function computeOutlierFences(
    values: readonly (number | null)[],
    factor: number = OUTLIER_FENCE_FACTOR,
    minPoints: number = OUTLIER_MIN_POINTS
): OutlierFences | null {
    const finite = values.filter((v): v is number => v !== null && Number.isFinite(v))
    if (finite.length < minPoints) return null
    if (finite.every((v) => v === 0 || v === 1)) return null

    const sorted = [...finite].sort((a, b) => a - b)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1
    const fences =
        iqr > 0 ? { lower: q1 - factor * iqr, upper: q3 + factor * iqr } : zeroSpreadFences(sorted)
    if (!fences) return null

    const excludesSomething = sorted[0]! < fences.lower || sorted[sorted.length - 1]! > fences.upper
    return excludesSomething ? fences : null
}

/**
 * The series with its outliers replaced by null (issue #186), for the moving
 * average and the trend when a card leaves outliers out of them. Same fences
 * as the y-axis fitting, so the values left out are exactly the ones drawn at
 * the axis edge. A series without fences comes back unchanged (a copy).
 */
export function withoutOutliers(values: readonly (number | null)[]): (number | null)[] {
    const fences = computeOutlierFences(values)
    if (!fences) return [...values]
    return values.map((v) =>
        v !== null && Number.isFinite(v) && (v < fences.lower || v > fences.upper) ? null : v
    )
}
