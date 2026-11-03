import type { ChartData } from '../../../types'

/**
 * Geometry of the date-per-note x-axis (3.4.0): a linear scale over epoch-ms
 * values. Pure, so it can be tested without Chart.js.
 */

/** Half a day: the margin of a bar chart, or of a zero-width axis */
export const HALF_DAY_MS = 12 * 3600_000

/** Share of the span left empty at each end of a line chart, so edge points are not cut */
export const TIME_AXIS_EDGE_PADDING = 0.02

/** Bar width limits on a time axis, in pixels */
export const TIME_AXIS_MIN_BAR_THICKNESS = 3
export const TIME_AXIS_MAX_BAR_THICKNESS = 16

/** Smallest and largest value, with a loop: a spread would overflow the stack on long series */
export function extent(values: readonly number[]): { min: number; max: number } | undefined {
    if (values.length === 0) return undefined
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const value of values) {
        if (value < min) min = value
        if (value > max) max = value
    }
    return { min, max }
}

/**
 * First and last x of a time-proportional axis, or undefined on a category
 * axis (no `xValues`)
 */
export function timeAxisRange(chartData: ChartData): { min: number; max: number } | undefined {
    return chartData.xValues ? extent(chartData.xValues) : undefined
}

/**
 * Bounds of a time-proportional x-axis. Bars get a fixed half day at each end,
 * so the first and last bars are whole without Chart.js' `offset`, which on a
 * linear scale squeezes the data toward the middle. Lines get 2% of the span,
 * or half a day when every note shares one instant (a zero-width axis).
 */
export function timeAxisBounds(
    xValues: readonly number[],
    isBar: boolean = false
): { min: number; max: number } {
    const range = extent(xValues) ?? { min: 0, max: 0 }
    const span = range.max - range.min
    const padding = isBar || !(span > 0) ? HALF_DAY_MS : span * TIME_AXIS_EDGE_PADDING
    return { min: range.min - padding, max: range.max + padding }
}

/**
 * Bar width on a time axis, in pixels: 80% of the smallest pixel gap between
 * two notes (same-day notes are already spread within their day), clamped to
 * 3–16 px. Chart.js would otherwise size every bar from the smallest gap and
 * draw hairlines, with no minimum of its own.
 */
export function timeAxisBarThickness(
    xValues: readonly number[],
    axisWidthPx: number,
    axisMin: number,
    axisMax: number
): number {
    const span = axisMax - axisMin
    if (!(span > 0) || !(axisWidthPx > 0)) return TIME_AXIS_MIN_BAR_THICKNESS

    const sorted = [...xValues].sort((a, b) => a - b)
    let smallestGap = Number.POSITIVE_INFINITY
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i]! - sorted[i - 1]!
        if (gap > 0 && gap < smallestGap) smallestGap = gap
    }
    if (!Number.isFinite(smallestGap)) return TIME_AXIS_MAX_BAR_THICKNESS

    const thickness = (smallestGap / span) * axisWidthPx * 0.8
    return Math.min(
        TIME_AXIS_MAX_BAR_THICKNESS,
        Math.max(TIME_AXIS_MIN_BAR_THICKNESS, Math.floor(thickness))
    )
}

/**
 * How hover and click pick points. The period axes use `index` mode: one
 * tooltip lists every series at the hovered period. On the time axis two notes
 * can sit a few pixels apart, and `index` mode resolves to the first of them,
 * so the second could never be hovered or opened: `nearest` in both directions
 * reaches each note.
 */
export function cartesianInteraction(isTimeAxis: boolean): {
    mode: 'index' | 'nearest'
    intersect: false
    axis?: 'xy'
} {
    return isTimeAxis
        ? { mode: 'nearest', axis: 'xy', intersect: false }
        : { mode: 'index', intersect: false }
}
