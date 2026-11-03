/**
 * Outlier detection for chart scales (3.4.0).
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
 * Tukey fences (Q1 − 3·IQR, Q3 + 3·IQR) for a series, or null when they do not
 * apply: fewer than 8 values, no spread between the quartiles (a habit series
 * of mostly 0 would otherwise make every 1 an outlier), or nothing actually
 * falls outside them. Nulls and non-finite values are ignored.
 */
export function computeOutlierFences(
    values: readonly (number | null)[],
    factor: number = OUTLIER_FENCE_FACTOR,
    minPoints: number = OUTLIER_MIN_POINTS
): OutlierFences | null {
    const finite = values.filter((v): v is number => v !== null && Number.isFinite(v))
    if (finite.length < minPoints) return null

    const sorted = [...finite].sort((a, b) => a - b)
    const q1 = quantile(sorted, 0.25)
    const q3 = quantile(sorted, 0.75)
    const iqr = q3 - q1
    if (!(iqr > 0)) return null

    const fences = { lower: q1 - factor * iqr, upper: q3 + factor * iqr }
    const excludesSomething = sorted[0]! < fences.lower || sorted[sorted.length - 1]! > fences.upper
    return excludesSomething ? fences : null
}
