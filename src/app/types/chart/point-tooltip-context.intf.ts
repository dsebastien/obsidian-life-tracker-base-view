/**
 * Tooltip callback context for scatter/bubble charts
 */
export interface PointTooltipContext {
    parsed: { x?: number; y?: number }
    raw?: { r?: number }
}
