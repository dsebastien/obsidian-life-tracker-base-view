import type { BasesPropertyId } from 'obsidian'
import type { VisualizationDataPoint } from '../visualization/visualization.types'

/**
 * Callback type for getting data points for re-render
 */
export type GetDataPointsCallback = (
    propertyId: BasesPropertyId,
    propertyDisplayName: string
) => VisualizationDataPoint[]
