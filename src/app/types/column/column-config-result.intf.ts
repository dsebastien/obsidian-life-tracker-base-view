import type { VisualizationType } from '../visualization/visualization-type.intf'
import type { ScaleConfig } from './column-config.types'

/**
 * Configuration result from the column config card
 */
export interface ColumnConfigResult {
    visualizationType: VisualizationType
    scale?: ScaleConfig
}
