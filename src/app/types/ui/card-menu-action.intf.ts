import type { BasesPropertyId } from 'obsidian'
import type { VisualizationType } from '../visualization/visualization-type.intf'
import type {
    ScaleConfig,
    ReferenceLineConfig,
    AggregationMethod,
    StoredColorScheme
} from '../column/column-config.types'

/**
 * Menu action types for card context menu
 */
export type CardMenuAction =
    | { type: 'changeVisualization'; visualizationType: VisualizationType }
    | { type: 'configureScale'; scale: ScaleConfig | undefined }
    | { type: 'configureColorScheme'; colorScheme: StoredColorScheme | undefined }
    | { type: 'configureReferenceLine'; referenceLine: ReferenceLineConfig }
    | { type: 'configureAggregationMethod'; aggregationMethod: AggregationMethod | undefined }
    | { type: 'configureMovingAverage'; movingAveragePeriod: number | undefined }
    | { type: 'configureHeatmapCellSize'; cellSize: number | undefined }
    | { type: 'configureHeatmapShowMonthLabels'; showMonthLabels: boolean | undefined }
    | { type: 'configureHeatmapShowDayLabels'; showDayLabels: boolean | undefined }
    | { type: 'resetConfig' }
    | { type: 'toggleMaximize' }
    /** Pin/unpin the card so it stays at the top of the grid (issue #123) */
    | { type: 'togglePin' }
    | { type: 'exportImage' }
    | { type: 'exportCsv' }
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
