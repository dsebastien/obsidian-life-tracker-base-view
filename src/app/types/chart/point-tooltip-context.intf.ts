/**
 * Tooltip callback context for scatter/bubble charts.
 * Matches the shape of Chart.js's `TooltipItem<'scatter' | 'bubble'>` for the
 * fields we read in the tooltip callback. `null` is included because Chart.js
 * uses `null` (not `undefined`) for missing parsed values, and `raw` is `unknown`
 * because Chart.js can't know the user's data shape.
 */
export interface PointTooltipContext {
    parsed: { x: number | null; y: number | null }
    raw?: unknown
}
