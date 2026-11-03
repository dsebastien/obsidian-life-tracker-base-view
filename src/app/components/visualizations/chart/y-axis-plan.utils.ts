import type { ChartJsType, OutlierMode, ScaleConfig, ValueFormat } from '../../../types'
import { axisStep, isDurationFormat, maxOf, minOf } from '../../../../utils'
import { computeOutlierFences, type OutlierFences } from '../../../services/outlier.utils'

/**
 * Y-axis planning for cartesian charts (3.4.0): which range and tick step the
 * axis uses, and what each series actually plots.
 *
 * Kept free of Chart.js so it can be tested on its own; the chart initializer
 * turns the plan into scale options.
 */

/** One series the y-axis has to accommodate */
export interface YAxisSeries {
    data: (number | null)[]
    /**
     * Whether the series counts toward the axis range. The moving average does
     * not: it averages the other series, so it never needs room of its own.
     */
    includeInRange?: boolean
    /**
     * Whether outliers of this series may be left out of the range and drawn
     * at the axis edge. Off for derived series (moving average, running
     * total) and 0/1 presence data.
     */
    fitToBulk?: boolean
}

export interface YAxisPlanInput {
    series: YAxisSeries[]
    /** Every value a reference line or target line reaches */
    referenceValues: number[]
    /** Explicit scale from the card config; always wins */
    scale?: ScaleConfig
    /** Whether the axis must include 0 */
    beginAtZero: boolean
    valueFormat?: ValueFormat
    /** Absent reads as 'fit' */
    outlierMode?: OutlierMode
}

/** A value plotted at the axis edge because it lies beyond it */
export interface ClampedPoint {
    index: number
    /** The real value, for the tooltip */
    value: number
    /** Which edge it was drawn at */
    side: 'above' | 'below'
}

export interface YAxisPlan {
    /** Explicit bounds, when the plan sets them */
    min?: number
    max?: number
    /** Fixed tick step, when the plan sets one (duration axes) */
    stepSize?: number
    /** What each series plots, in input order (outliers clamped to the edge) */
    data: (number | null)[][]
    /** Per series, the points drawn at the axis edge */
    clamped: ClampedPoint[][]
}

/** Finite numbers of a series */
function finiteValues(data: (number | null)[]): number[] {
    return data.filter((v): v is number => v !== null && Number.isFinite(v))
}

/**
 * Whether the y-axis starts at zero. Bars always do: a bar drawn from a
 * non-zero baseline lies about its length. Lines and areas with a duration
 * format fit their data instead — a pace of 5:00–7:00 drawn from 0:00 flattens
 * every change. Number-format lines keep starting at zero, as before. An
 * explicit scale minimum overrides all of this through `min`.
 */
export function yAxisBeginsAtZero(
    chartType: ChartJsType,
    valueFormat: ValueFormat | undefined,
    scale: ScaleConfig | undefined
): boolean {
    if (chartType !== 'bar' && isDurationFormat(valueFormat)) return false
    return !scale?.min
}

/** Snap a bound to a whole number of steps, without float noise (0.30000000000000004) */
function roundToStep(value: number, step: number): number {
    return Number((Math.round(value / step) * step).toPrecision(12))
}

/**
 * Plan the y-axis.
 *
 * Outliers (3.4.0): with no explicit scale and the outlier mode on `fit`, each
 * fitted series is checked against Tukey's far-out fences. When any series
 * has values beyond them, the axis covers only the bulk (plus reference
 * values and 0 when the axis starts at zero), rounded out to a nice step, and
 * values beyond the axis are drawn at its edge and reported in `clamped`.
 *
 * Otherwise the number format sets nothing and Chart.js keeps its own
 * auto-fit (unchanged behavior), while a duration format gets a fixed tick
 * step from the duration ladder, so ticks land on 5:00, 5:30, 6:00.
 */
export function planYAxis(input: YAxisPlanInput): YAxisPlan {
    const { series, referenceValues, scale, beginAtZero, valueFormat } = input
    const data = series.map((s) => s.data)
    const clamped: ClampedPoint[][] = series.map(() => [])

    const explicitScale = scale?.min != null || scale?.max != null
    if (!explicitScale && input.outlierMode !== 'show-all') {
        const fitted = fitToBulk(input)
        if (fitted) return fitted
    }

    if (!isDurationFormat(valueFormat)) return { data, clamped }

    const rangeValues = series
        .filter((s) => s.includeInRange !== false)
        .flatMap((s) => finiteValues(s.data))
    const candidates = [...rangeValues, ...referenceValues]
    if (beginAtZero) candidates.push(0)
    if (candidates.length === 0) return { data, clamped }

    // Folds, not spreads: a spread overflows the stack on long series
    const lo = scale?.min ?? minOf(candidates) ?? 0
    const hi = scale?.max ?? maxOf(candidates) ?? 0

    return { data, clamped, stepSize: axisStep(hi - lo, valueFormat) }
}

/**
 * The bulk-fitted plan, or null when no series has an outlier to leave out
 */
function fitToBulk(input: YAxisPlanInput): YAxisPlan | null {
    const { series, referenceValues, beginAtZero, valueFormat } = input

    const fences: (OutlierFences | null)[] = series.map((s) =>
        s.fitToBulk ? computeOutlierFences(s.data) : null
    )
    if (fences.every((f) => f === null)) return null

    // The range: in-fence values of every series that counts toward it
    const candidates: number[] = []
    series.forEach((s, i) => {
        if (s.includeInRange === false) return
        const f = fences[i]
        for (const value of finiteValues(s.data)) {
            if (!f || (value >= f.lower && value <= f.upper)) candidates.push(value)
        }
    })
    candidates.push(...referenceValues)
    if (beginAtZero) candidates.push(0)
    if (candidates.length === 0) return null

    const lo = minOf(candidates) ?? 0
    const hi = maxOf(candidates) ?? 0
    const step = axisStep(hi - lo, valueFormat)
    const min = roundToStep(Math.floor(lo / step) * step, step)
    let max = roundToStep(Math.ceil(hi / step) * step, step)
    if (max <= min) max = roundToStep(min + step, step)

    // Clamp what lies beyond the axis, for fitted series only: a moving
    // average stays real and is clipped by the chart area instead
    const clamped: ClampedPoint[][] = series.map(() => [])
    const data = series.map((s, i) => {
        if (!s.fitToBulk) return s.data
        return s.data.map((value, index) => {
            if (value === null || !Number.isFinite(value)) return value
            if (value > max) {
                clamped[i]!.push({ index, value, side: 'above' })
                return max
            }
            if (value < min) {
                clamped[i]!.push({ index, value, side: 'below' })
                return min
            }
            return value
        })
    })

    return { min, max, stepSize: step, data, clamped }
}
