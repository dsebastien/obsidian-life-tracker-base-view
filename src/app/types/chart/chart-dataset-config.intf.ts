/**
 * Chart.js dataset configuration.
 *
 * `data` is widened beyond the cartesian `(number | null)[]` shape because pie/doughnut
 * charts share this type and scatter/bubble datasets store `{ x, y, r? }` points instead.
 * `backgroundColor` / `borderColor` are widened to `string | string[]` because Chart.js
 * accepts arrays to colour individual slices/bars (even though our local cartesian usage
 * is a single colour).
 */
export interface ChartDatasetConfig {
    label: string
    data: (number | null)[] | { x: number; y: number; r?: number }[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
    tension?: number
    fill?: boolean
    /** Dash pattern for the line (used by the moving-average overlay) */
    borderDash?: number[]
    /** Point radius; 0 hides the points (used by the moving-average overlay) */
    pointRadius?: number
}
