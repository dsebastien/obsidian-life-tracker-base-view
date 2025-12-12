import type { VisualizationType } from '../domain/visualization-type.enum'
import type { ScaleConfig } from './column-config.types'

/**
 * Global preset for a property name pattern
 * Applied automatically when a property matches the pattern
 */
export interface PropertyVisualizationPreset {
    /** Unique ID for this preset */
    id: string
    /** Property name pattern (exact match, case-insensitive) */
    propertyNamePattern: string
    /** Visualization type to use */
    visualizationType: VisualizationType
    /** Optional scale configuration */
    scale?: ScaleConfig
}

export interface PluginSettings {
    /**
     * Global visualization presets by property name
     * Applied automatically when a property name matches
     */
    visualizationPresets: PropertyVisualizationPreset[]

    /**
     * Animation duration in milliseconds
     * Controls how long visualization animations take to complete
     */
    animationDuration: number
}

export const DEFAULT_SETTINGS: PluginSettings = {
    visualizationPresets: [],
    animationDuration: 3000
}
