import type { VisualizationType } from '../visualization/visualization-type.intf'
import type { ScaleConfig } from '../column/column-config.types'

/**
 * Menu action types for card context menu
 */
export type CardMenuAction =
    | { type: 'changeVisualization'; visualizationType: VisualizationType }
    | { type: 'configureScale'; scale: ScaleConfig | undefined }
    | { type: 'resetConfig' }
    | { type: 'toggleMaximize' }
