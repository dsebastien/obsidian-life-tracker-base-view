import type { VisualizationType } from '../visualization/visualization-type.intf'
import type { ScaleConfig } from '../column/column-config.types'
import type { ChartColorScheme } from '../../../utils/color.utils'

/**
 * Menu action types for card context menu
 */
export type CardMenuAction =
    | { type: 'changeVisualization'; visualizationType: VisualizationType }
    | { type: 'configureScale'; scale: ScaleConfig | undefined }
    | { type: 'configureColorScheme'; colorScheme: ChartColorScheme | undefined }
    | { type: 'configureHeatmapCellSize'; cellSize: number | undefined }
    | { type: 'configureHeatmapShowMonthLabels'; showMonthLabels: boolean | undefined }
    | { type: 'configureHeatmapShowDayLabels'; showDayLabels: boolean | undefined }
    | { type: 'resetConfig' }
    | { type: 'toggleMaximize' }
