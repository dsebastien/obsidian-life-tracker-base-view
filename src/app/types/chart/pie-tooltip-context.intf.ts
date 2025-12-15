/**
 * Tooltip callback context for pie/doughnut/polarArea charts.
 * For pie/doughnut, parsed is a number.
 * For polarArea, parsed is an object { r: number }.
 */
export interface PieTooltipContext {
    label: string
    parsed: number | { r: number }
}
