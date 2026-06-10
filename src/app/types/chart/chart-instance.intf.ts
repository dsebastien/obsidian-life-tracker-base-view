import type { ChartDatasetConfig } from './chart-dataset-config.intf'

/**
 * Internal chart instance interface
 */
export interface ChartInstance {
    destroy: () => void
    update: (mode?: string) => void
    resize: () => void
    reset: () => void
    /** Base64 data URL of the canvas in its current state (PNG by default) */
    toBase64Image: (type?: string, quality?: number) => string
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
