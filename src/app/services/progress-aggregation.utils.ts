import { compareAsc } from 'date-fns'
import {
    DEFAULT_TARGET_WARN_THRESHOLD,
    TimeGranularity,
    type ProgressData,
    type ProgressPeriod,
    type ProgressStatus,
    type TargetConfig,
    type VisualizationDataPoint,
    type VisualizationDateRange
} from '../types'
import type { BasesPropertyId } from 'obsidian'
import { getTimeKey, normalizeDate } from './date-grouping.utils'
import { computeDatedStreaks } from './heatmap-streak.utils'

/**
 * Progress toward a goal target (issues #6 and #126).
 *
 * The data points a visualization receives are already filtered and dated; the
 * job here is to fold them into one number per period, compare that number to
 * the target, and report both the period the user is currently in and how
 * often the target was met across the range.
 */

/**
 * Fold the values of one period into the single number the target compares to
 */
function foldPeriod(values: number[], metric: TargetConfig['metric']): number {
    switch (metric) {
        case 'count':
            // Zero is deliberately excluded: a daily note recording
            // `push_ups: 0` says the exercise was *not* done, and counting it
            // would make "3 days a week" trivially true for anyone who logs
            // every day
            return values.filter((value) => value !== 0).length

        case 'sum':
            return values.reduce((total, value) => total + value, 0)

        case 'average':
            return values.length > 0
                ? values.reduce((total, value) => total + value, 0) / values.length
                : 0

        case 'latest':
            // Values arrive in chronological order (see below)
            return values.length > 0 ? (values[values.length - 1] ?? 0) : 0

        default:
            return 0
    }
}

/**
 * Metrics whose empty period means "unknown" rather than zero.
 *
 * Doing nothing all week really is a count of 0 and a sum of 0, but it is not
 * an average of 0 and certainly not a weight of 0 kg.
 */
const UNKNOWN_WHEN_EMPTY: ReadonlySet<TargetConfig['metric']> = new Set(['average', 'latest'])

/**
 * Whether a period with no recorded values can still be measured
 */
export function isMeasurableWhenEmpty(metric: TargetConfig['metric']): boolean {
    return !UNKNOWN_WHEN_EMPTY.has(metric)
}

/**
 * Whether a period's value meets the target
 */
export function isTargetMet(actual: number, target: TargetConfig): boolean {
    return target.direction === 'at-most' ? actual <= target.value : actual >= target.value
}

/**
 * How far along a period is, as a fraction of the target clamped to 0-1.
 *
 * For an at-most target the fraction still grows with the value — it is a fuel
 * gauge running toward a ceiling, so a full ring means the budget is spent.
 */
export function progressRatio(actual: number, target: TargetConfig): number {
    if (target.value === 0) {
        return isTargetMet(actual, target) ? 1 : 0
    }
    const ratio = actual / target.value
    if (!Number.isFinite(ratio)) return 0
    return Math.min(Math.max(ratio, 0), 1)
}

/**
 * Classify a period for coloring: met, close to the target, or behind.
 *
 * The colour ramp follows the target's *direction*, which is what says whether
 * filling the ring is a good thing:
 *
 * - `at-least` is a goal to reach, so the ring runs red → yellow → green as it
 *   fills.
 * - `at-most` is a budget to stay under, so it runs green → yellow → red: the
 *   warning belongs *before* the ceiling is crossed, not after.
 *
 * "Close" needs a meaningful zero to measure against, so it is limited to the
 * metrics that accumulate from nothing. Being at 79 of an 80 kg ceiling is not
 * "99% of the way through a budget" — the scale simply does not start at 0.
 */
export function progressStatus(
    actual: number,
    target: TargetConfig,
    hasData = true
): ProgressStatus {
    if (!hasData && !isMeasurableWhenEmpty(target.metric)) {
        return 'no-data'
    }

    const met = isTargetMet(actual, target)
    const warnAt = target.warnThreshold ?? DEFAULT_TARGET_WARN_THRESHOLD
    const nearTarget = accumulatesFromZero(target.metric) && progressRatio(actual, target) >= warnAt

    if (target.direction === 'at-most') {
        // Over the ceiling is a miss; under it but close is the warning
        if (!met) return 'behind'
        return nearTarget ? 'close' : 'met'
    }

    if (met) return 'met'
    return nearTarget ? 'close' : 'behind'
}

/**
 * Whether a metric counts up from a meaningful zero, which is what makes
 * "fraction of the target" a fair reading of how far along a period is
 */
export function accumulatesFromZero(metric: TargetConfig['metric']): boolean {
    return metric === 'count' || metric === 'sum'
}

/**
 * Fold data points into per-period progress against a target.
 *
 * `viewDateRange` is used only to decide which period is "current": the view
 * may cover periods with no data at all, and a week where nothing was logged
 * is still a week the target was missed (issue #153 applies here too).
 */
export function aggregateForProgress(
    dataPoints: VisualizationDataPoint[],
    propertyId: BasesPropertyId,
    displayName: string,
    target: TargetConfig,
    viewDateRange?: VisualizationDateRange | null
): ProgressData {
    const dated = dataPoints
        .filter((point) => point.dateAnchor !== null)
        .sort((a, b) => compareAsc(a.dateAnchor!.date, b.dateAnchor!.date))

    const buckets = new Map<string, { date: Date; values: number[]; filePaths: string[] }>()

    for (const point of dated) {
        const date = point.dateAnchor!.date
        const key = getTimeKey(date, target.period)

        let bucket = buckets.get(key)
        if (!bucket) {
            bucket = { date: normalizeDate(date, target.period), values: [], filePaths: [] }
            buckets.set(key, bucket)
        }

        if (point.numericValue !== null) {
            bucket.values.push(point.numericValue)
        } else if (point.booleanValue !== null) {
            bucket.values.push(point.booleanValue ? 1 : 0)
        }
        bucket.filePaths.push(point.filePath)
    }

    const periods: ProgressPeriod[] = [...buckets.values()]
        .map(({ date, values, filePaths }) => buildPeriod(date, values, target, filePaths))
        .sort((a, b) => compareAsc(a.date, b.date))

    const current = pickCurrentPeriod(periods, target, viewDateRange)

    return {
        propertyId,
        displayName,
        target,
        periods,
        current,
        metCount: periods.filter((period) => period.met).length,
        periodCount: periods.length,
        // A streak counts periods that *met* the target, not periods with any
        // data: two squats in a week is not a week of the habit (issue #100)
        streaks: computeDatedStreaks(
            periods.filter((period) => period.met).map((period) => period.date),
            target.period
        )
    }
}

/**
 * The period the ring shows: the one the view's last day falls in.
 *
 * When the view ends on a period that has no entries at all, an empty period is
 * synthesized rather than silently falling back to the last period with data —
 * a week with nothing logged is a week at zero, not a week to hide.
 */
function pickCurrentPeriod(
    periods: ProgressPeriod[],
    target: TargetConfig,
    viewDateRange?: VisualizationDateRange | null
): ProgressPeriod | null {
    if (!viewDateRange) {
        return periods[periods.length - 1] ?? null
    }

    const currentKey = getTimeKey(viewDateRange.maxDate, target.period)
    const match = periods.find((period) => getTimeKey(period.date, target.period) === currentKey)
    if (match) {
        return match
    }

    return buildPeriod(normalizeDate(viewDateRange.maxDate, target.period), [], target, [])
}

/**
 * Measure one period's values against the target
 */
function buildPeriod(
    date: Date,
    values: number[],
    target: TargetConfig,
    filePaths: string[]
): ProgressPeriod {
    const hasData = values.length > 0
    const actual = foldPeriod(values, target.metric)
    const status = progressStatus(actual, target, hasData)

    return {
        date,
        actual,
        hasData,
        met: status !== 'no-data' && isTargetMet(actual, target),
        status,
        ratio: status === 'no-data' ? 0 : progressRatio(actual, target),
        filePaths
    }
}

/** Plural-aware name of a target period, for labels like "3 of 8 weeks met" */
export function periodLabel(period: TimeGranularity, count: number): string {
    const singular: Record<TimeGranularity, string> = {
        [TimeGranularity.Daily]: 'day',
        [TimeGranularity.Weekly]: 'week',
        [TimeGranularity.Monthly]: 'month',
        [TimeGranularity.Quarterly]: 'quarter',
        [TimeGranularity.Yearly]: 'year'
    }
    const name = singular[period] ?? 'period'
    return count === 1 ? name : `${name}s`
}
