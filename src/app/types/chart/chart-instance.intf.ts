import type { Chart } from 'chart.js'

/**
 * Chart instance type.
 *
 * Aliased to Chart.js's real `Chart` class so that every downstream access
 * (`.data`, `.options`, `.update()`, `.destroy()`, `.toBase64Image()`, …) is
 * type-checked against the actual API instead of a hand-maintained subset that
 * can silently drift. Chart's default generic parameters keep call sites free of
 * per-chart-type annotations.
 */
export type ChartInstance = Chart
