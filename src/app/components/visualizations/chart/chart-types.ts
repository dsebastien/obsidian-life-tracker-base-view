import type { ChartJsType } from '../../../types/visualization.types'

/**
 * Chart.js type alias
 */
export type ChartType = ChartJsType

/**
 * Internal chart instance interface
 */
export interface ChartInstance {
    destroy: () => void
    update: (mode?: string) => void
    resize: () => void
    reset: () => void
    data: {
        labels: string[]
        datasets: ChartDatasetConfig[]
    }
    options: {
        animation?: {
            duration?: number
            easing?: string
        }
    }
}

/**
 * Chart.js dataset configuration
 */
export interface ChartDatasetConfig {
    label: string
    data: (number | null)[]
    backgroundColor?: string | string[]
    borderColor?: string
    borderWidth?: number
    tension?: number
    fill?: boolean
}

/**
 * Chart click element type
 */
export interface ChartClickElement {
    index: number
    datasetIndex: number
}

/**
 * Tooltip callback context for pie/doughnut charts
 */
export interface PieTooltipContext {
    label: string
    parsed: number
}

/**
 * Tooltip callback context for cartesian charts (line/bar/area)
 */
export interface CartesianTooltipContext {
    dataset: { label?: string }
    parsed: { y: number | null }
}

/**
 * Tooltip callback context for scatter/bubble charts
 */
export interface PointTooltipContext {
    parsed: { x?: number; y?: number }
    raw?: { r?: number }
}
