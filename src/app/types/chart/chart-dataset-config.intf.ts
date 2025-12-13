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
