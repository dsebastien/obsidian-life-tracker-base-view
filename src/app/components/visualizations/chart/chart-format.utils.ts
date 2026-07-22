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
