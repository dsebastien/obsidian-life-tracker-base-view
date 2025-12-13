/**
 * Tooltip callback context for cartesian charts (line/bar/area)
 */
export interface CartesianTooltipContext {
    dataset: { label?: string }
    parsed: { y: number | null }
}
