import type { ChartJsType, ScaleConfig, ValueFormat } from '../../../types'
import { axisStep, isDurationFormat } from '../../../../utils'

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
}

export interface YAxisPlan {
    /** Explicit bounds, when the plan sets them */
    min?: number
    max?: number
    /** Fixed tick step, when the plan sets one (duration axes) */
    stepSize?: number
    /** What each series plots, in input order */
    data: (number | null)[][]
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

/**
 * Plan the y-axis. With the number format and no outliers, the plan sets
 * nothing and Chart.js keeps its own auto-fit (unchanged behavior). A
 * duration format gets a fixed tick step from the duration ladder, so ticks
 * land on 5:00, 5:30, 6:00.
 */
export function planYAxis(input: YAxisPlanInput): YAxisPlan {
    const { series, referenceValues, scale, beginAtZero, valueFormat } = input
    const data = series.map((s) => s.data)

    if (!isDurationFormat(valueFormat)) return { data }

    const rangeValues = series
        .filter((s) => s.includeInRange !== false)
        .flatMap((s) => finiteValues(s.data))
    const candidates = [...rangeValues, ...referenceValues]
    if (beginAtZero) candidates.push(0)
    if (candidates.length === 0) return { data }

    const lo = scale?.min ?? Math.min(...candidates)
    const hi = scale?.max ?? Math.max(...candidates)

    return { data, stepSize: axisStep(hi - lo, valueFormat) }
}
