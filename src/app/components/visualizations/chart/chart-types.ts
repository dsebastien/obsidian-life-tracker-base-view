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
