/**
 * Tooltip value formatting helpers shared by the chart initializers.
 */

/**
 * True when every value is a whole number (or empty). Used to decide whether a
 * dataset represents counts (habits, sessions) that should render without
 * decimals rather than as `3.00`.
 */
export function areAllValuesIntegers(values: readonly unknown[]): boolean {
    return values.every(
        (v) => v === null || v === undefined || (typeof v === 'number' && Number.isInteger(v))
    )
}

/**
 * Format a metric value for a tooltip. Integer-only datasets drop the decimals;
 * others keep up to two. `toLocaleString` also adds locale thousands separators.
 */
export function formatMetricValue(value: number, integersOnly: boolean): string {
    return value.toLocaleString(undefined, {
        maximumFractionDigits: integersOnly ? 0 : 2
    })
}

/** One trailing parenthesized suffix, e.g. ` (Running Session)` */
const TRAILING_SUFFIX_PATTERN = /\s*\([^()]*\)\s*$/

/**
 * Note name as an axis label (3.4.0): without the trailing note-type suffix
 * many vaults append (`2025-06-24 (Running Session)` → `2025-06-24`), so
 * labels stay short enough to sit horizontally. A name that is nothing but a
 * suffix is kept whole. Tooltips keep the full name.
 */
export function stripNoteTypeSuffix(noteName: string): string {
    const stripped = noteName.replace(TRAILING_SUFFIX_PATTERN, '')
    return stripped.trim() === '' ? noteName : stripped
}

/**
 * The window a trend compares against (3.4.0): on the per-note axes the
 * trend compares notes, so it says so ("vs previous 7 notes")
 */
export function trendWindowLabel(count: number, perNote: boolean): string {
    const unit = perNote ? 'note' : 'period'
    return `vs previous ${count} ${count === 1 ? unit : `${unit}s`}`
}

/** Text of the date-per-note chip counting notes left out (3.4.0) */
export function missingDateText(count: number): string {
    return `${count} ${count === 1 ? 'note' : 'notes'} without a date`
}

/**
 * Accessible label of that chip: the count first, so a screen reader hears
 * it, then why those notes are missing
 */
export function missingDateAriaLabel(count: number): string {
    return `${missingDateText(count)}: a note needs a date anchor to be placed on this axis`
}
