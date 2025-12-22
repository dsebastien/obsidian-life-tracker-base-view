import type { BasesPropertyId } from 'obsidian'
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
    | { type: 'addVisualization' }
    | { type: 'removeVisualization' }
    // Overlay chart actions
    | { type: 'openCreateOverlay' } // Opens the property selection modal
    | {
          type: 'createOverlay'
          propertyIds: BasesPropertyId[]
          visualizationType: VisualizationType
          displayName: string
      }
    | { type: 'editOverlayProperties'; overlayId: string; propertyIds: BasesPropertyId[] }
    | { type: 'deleteOverlay'; overlayId: string }
