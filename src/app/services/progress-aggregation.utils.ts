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
 * "Close" only exists for an at-least target, where it means the period is
 * still running and most of the way there. An at-most target that is not met
 * has already been blown past — there is nothing "close" about it.
 */
export function progressStatus(actual: number, target: TargetConfig): ProgressStatus {
    if (isTargetMet(actual, target)) {
        return 'met'
    }

    if (target.direction === 'at-most') {
        return 'behind'
    }

    const warnAt = target.warnThreshold ?? DEFAULT_TARGET_WARN_THRESHOLD
    return progressRatio(actual, target) >= warnAt ? 'close' : 'behind'
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
        .map(({ date, values, filePaths }) => {
            const actual = foldPeriod(values, target.metric)
            return {
                date,
                actual,
                met: isTargetMet(actual, target),
                status: progressStatus(actual, target),
                ratio: progressRatio(actual, target),
                filePaths
            }
        })
        .sort((a, b) => compareAsc(a.date, b.date))

    const current = pickCurrentPeriod(periods, target, viewDateRange)

    return {
        propertyId,
        displayName,
        target,
        periods,
        current,
        metCount: periods.filter((period) => period.met).length,
        periodCount: periods.length
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

    const actual = foldPeriod([], target.metric)
    return {
        date: normalizeDate(viewDateRange.maxDate, target.period),
        actual,
        met: isTargetMet(actual, target),
        status: progressStatus(actual, target),
        ratio: progressRatio(actual, target),
        filePaths: []
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
