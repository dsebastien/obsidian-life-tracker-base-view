import type { ChartDatasetConfig } from './chart-dataset-config.intf'

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
