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
    data: (number | null)[] | { x: number; y: number | null; r?: number }[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    borderWidth?: number
    tension?: number
    fill?: boolean
    /** Dash pattern for the line (used by the moving-average overlay) */
    borderDash?: number[]
    /**
     * Point radius; 0 hides the points (used by the moving-average overlay).
     * Per point when only some points show (isolated by gaps, issue #185)
     */
    pointRadius?: number | number[]
    /** Point radius on hover; kept non-zero so hidden points still highlight */
    pointHoverRadius?: number
    /**
     * Extra hit radius around a point. Dense series hide their markers
     * (`pointRadius: 0`), which would otherwise make tooltips unreachable.
     */
    pointHitRadius?: number
    /** Per-dataset chart type in a mixed chart (outlier markers on bar charts) */
    type?: 'line'
    /** Draw the line between points (off for outlier markers) */
    showLine?: boolean
    /** Point marker shape (outlier markers are triangles) */
    pointStyle?: 'circle' | 'triangle'
    /** Point rotation in degrees, per point (a down triangle is 180) */
    pointRotation?: number | number[]
    pointBackgroundColor?: string
    pointBorderColor?: string
    /** Clipping against the chart area; false lets edge markers show whole */
    clip?: false
    /** Drawing, legend and tooltip order: lower draws on top and lists first */
    order?: number
    /**
     * Index of the dataset whose clamped outliers this marker dataset shows
     * (3.4.0). Absent on every other dataset.
     */
    ltOutlierMarkerFor?: number
}
