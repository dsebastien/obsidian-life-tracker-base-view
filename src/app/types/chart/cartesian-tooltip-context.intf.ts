/**
 * Tooltip callback context for cartesian charts (line/bar/area)
 */
export interface CartesianTooltipContext {
    dataset: { label?: string }
    parsed: { y: number | null }
}

/**
 * Tooltip callback context for range charts (issue #81): the raw value is
 * the floating bar's [start, end] tuple.
 */
export interface RangeTooltipContext {
    raw: unknown
}
