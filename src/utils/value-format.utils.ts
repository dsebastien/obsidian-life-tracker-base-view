import type { ValueFormat } from '../app/types/column/column-config.types'

/**
 * Display formatting for card values (3.4.0): plain numbers or durations.
 *
 * A duration format only changes how a value reads, never the value itself:
 * every computation (aggregation, trend, records, CSV export) keeps working on
 * the raw number.
 */

/** Two-digit zero padding for the minute and second parts of a duration */
function pad2(value: number): string {
    return value < 10 ? `0${value}` : String(value)
}

/**
 * Whether a format reads values as durations
 */
export function isDurationFormat(format: ValueFormat | undefined): boolean {
    return format === 'duration-mm-ss' || format === 'duration-h-mm'
}

/**
 * Format a number of seconds as `m:ss`, or `h:mm:ss` from one hour on.
 * 330 → `5:30`, 387.4 → `6:27`, 3725 → `1:02:05`. Rounded to the second.
 * The caller guarantees a finite, non-negative value.
 */
export function formatSecondsAsDuration(totalSeconds: number): string {
    const rounded = Math.round(totalSeconds)
    const hours = Math.floor(rounded / 3600)
    const minutes = Math.floor((rounded % 3600) / 60)
    const seconds = rounded % 60
    return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`
}

/**
 * Format a number of minutes as `h:mm`. 95 → `1:35`, 45 → `0:45`. Rounded to
 * the minute. The caller guarantees a finite, non-negative value.
 */
export function formatMinutesAsDuration(totalMinutes: number): string {
    const rounded = Math.round(totalMinutes)
    const hours = Math.floor(rounded / 60)
    const minutes = rounded % 60
    return `${hours}:${pad2(minutes)}`
}

/**
 * Default number rendering: up to two decimals, locale separators
 */
export function formatPlainNumber(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Format a value per the card's format. Negative or non-finite values cannot
 * be read as a duration and fall back to the number format, as does any value
 * under the `number` format. `formatNumber` lets each caller keep its own
 * number rendering (integers without decimals, fixed decimals, …), so the
 * `number` format changes nothing anywhere.
 */
export function formatValue(
    value: number,
    format: ValueFormat | undefined,
    formatNumber: (value: number) => string = formatPlainNumber
): string {
    if (Number.isFinite(value) && value >= 0) {
        if (format === 'duration-mm-ss') return formatSecondsAsDuration(value)
        if (format === 'duration-h-mm') return formatMinutesAsDuration(value)
    }
    return formatNumber(value)
}

/**
 * Tick steps for a duration axis, in the format's own unit, smallest first:
 * so a pace axis reads 5:00, 5:30, 6:00 rather than 5:00, 5:33, 6:07.
 */
const SECOND_STEPS = [
    1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400
]
const MINUTE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440]

/** Most intervals a duration axis gets: enough to read, few enough to fit a card */
export const DURATION_MAX_INTERVALS = 6

/**
 * The tick step for a duration axis spanning `range` (in the format's unit):
 * the smallest step of the ladder that covers the range in at most
 * `maxIntervals` intervals. Beyond the ladder, whole days (or 24 h) multiples.
 */
export function durationTickStep(
    range: number,
    format: ValueFormat,
    maxIntervals: number = DURATION_MAX_INTERVALS
): number {
    const steps = format === 'duration-h-mm' ? MINUTE_STEPS : SECOND_STEPS
    const largest = steps[steps.length - 1]!
    if (!(range > 0)) {
        // A flat series: a step that reads naturally around a single value
        return format === 'duration-h-mm' ? 15 : 30
    }
    for (const step of steps) {
        if (range / step <= maxIntervals) return step
    }
    return largest * Math.ceil(range / (largest * maxIntervals))
}

/**
 * "Nice" step (1, 2, 5 × 10ⁿ) covering `range` in at most `maxIntervals`
 * intervals, matching the look of Chart.js' own linear ticks.
 */
export function niceNumberStep(
    range: number,
    maxIntervals: number = DURATION_MAX_INTERVALS
): number {
    if (!(range > 0)) return 1
    const rough = range / maxIntervals
    const exponent = Math.pow(10, Math.floor(Math.log10(rough)))
    const fraction = rough / exponent
    const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
    return nice * exponent
}

/**
 * Axis step for a range under a value format: the duration ladder for
 * durations, nice numbers otherwise.
 */
export function axisStep(
    range: number,
    format: ValueFormat | undefined,
    maxIntervals: number = DURATION_MAX_INTERVALS
): number {
    return format && isDurationFormat(format)
        ? durationTickStep(range, format, maxIntervals)
        : niceNumberStep(range, maxIntervals)
}
