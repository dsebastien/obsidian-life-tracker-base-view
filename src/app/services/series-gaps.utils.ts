/**
 * Gaps in a time series (issue #185). A line drawn straight across months
 * without data reads as a stable trend that never happened: a moving average
 * of runs connected December to March with a flat segment. Two consecutive
 * points further apart than a threshold break the line, and the moving
 * average is computed per segment, so it never spans a gap either.
 */

import type { ChartConfig, ChartData } from '../types'
import { computeMovingAverage } from './chart-aggregation.utils'

/** One day in milliseconds */
const DAY_MS = 24 * 3600_000

/** A gap is longer than this many times the median gap between points */
export const GAP_MEDIAN_FACTOR = 3

/** ...and never shorter than two weeks, so dense daily logs keep their line */
export const GAP_MIN_MS = 14 * DAY_MS

/** Median of numbers, or undefined when there are none */
function median(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/**
 * Indices of the points that carry a value and a time, in order. Only these
 * are points of the line: a null slot draws nothing (and already breaks it).
 */
function plottedIndices(
    times: readonly (number | undefined)[],
    values: readonly (number | null)[]
): number[] {
    const indices: number[] = []
    values.forEach((value, index) => {
        const time = times[index]
        if (value !== null && Number.isFinite(value) && time !== undefined) indices.push(index)
    })
    return indices
}

/**
 * Longest distance two consecutive points may have before the line breaks:
 * max(3 × the median gap between consecutive points, 14 days). Undefined
 * with fewer than two points.
 */
export function gapThreshold(
    times: readonly (number | undefined)[],
    values: readonly (number | null)[]
): number | undefined {
    const indices = plottedIndices(times, values)
    const gaps: number[] = []
    for (let i = 1; i < indices.length; i++) {
        gaps.push(times[indices[i]!]! - times[indices[i - 1]!]!)
    }
    const typical = median(gaps)
    if (typical === undefined) return undefined
    return Math.max(GAP_MEDIAN_FACTOR * typical, GAP_MIN_MS)
}

/**
 * Where the line breaks: `result[i]` is true when point i is further than the
 * threshold from the previous point with a value. `times` are epoch ms per
 * slot (the period start, or the note's own date), `values` the plotted
 * values. All false when there is nothing to break.
 */
export function findGapBreaks(
    times: readonly (number | undefined)[],
    values: readonly (number | null)[]
): boolean[] {
    const breaks = values.map(() => false)
    const threshold = gapThreshold(times, values)
    if (threshold === undefined) return breaks

    const indices = plottedIndices(times, values)
    for (let i = 1; i < indices.length; i++) {
        const current = indices[i]!
        const previous = indices[i - 1]!
        if (times[current]! - times[previous]! > threshold) breaks[current] = true
    }
    return breaks
}

/**
 * Moving average computed separately on each segment between breaks (issue
 * #185): a window never reaches across a gap. Without breaks this is the
 * plain trailing moving average.
 */
export function computeSegmentedMovingAverage(
    values: readonly (number | null)[],
    period: number,
    breaks: readonly boolean[] | undefined
): (number | null)[] {
    const result: (number | null)[] = []
    let start = 0
    for (let i = 1; i <= values.length; i++) {
        if (i === values.length || breaks?.[i]) {
            result.push(...computeMovingAverage(values.slice(start, i), period))
            start = i
        }
    }
    return result
}

/**
 * Whether the line segment ending at `index` crosses a gap, for Chart.js'
 * scriptable `segment` options
 */
export function isGapSegment(breaks: readonly boolean[] | undefined, index: number): boolean {
    return breaks?.[index] === true
}

/**
 * Gap breaks for a numeric chart, or undefined when its line never breaks:
 * only line and area charts (Chart.js `line`) on a date axis (periods, or one
 * point per note at its date) with the card's "Break line across gaps" on,
 * which it is unless set to false. List data (several datasets) and the
 * note-name axis (no time) keep their line whole.
 */
export function gapBreaksFor(
    chartData: ChartData,
    chartConfig: ChartConfig
): boolean[] | undefined {
    if (chartConfig.chartType !== 'line') return undefined
    if (chartConfig.breakLineAcrossGaps === false) return undefined
    if (chartConfig.xAxisSource === 'note-name') return undefined
    if (chartData.datasets.length !== 1) return undefined

    const times = chartData.xValues ?? chartData.periodTimes
    const source = chartData.datasets[0]
    if (!times || !source) return undefined

    const breaks = findGapBreaks(times, source.data)
    return breaks.some(Boolean) ? breaks : undefined
}
