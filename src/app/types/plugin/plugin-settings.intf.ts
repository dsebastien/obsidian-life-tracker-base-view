import type { VisualizationType } from '../visualization/visualization-type.intf'
import type {
    ScaleConfig,
    ReferenceLineConfig,
    AggregationMethod
} from '../column/column-config.types'
import type { PropertyDefinition } from '../property/property-definition.types'
import type { ChartColorScheme } from '../../../utils/color.utils'
import type { WeekStartDay } from '../../../utils/date.utils'

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
    /** Optional color scheme for chart types */
    colorScheme?: ChartColorScheme
    /** Reference line configuration for cartesian charts */
    referenceLine?: ReferenceLineConfig
    /** How to combine multiple values within a time period (cartesian/bubble charts) */
    aggregationMethod?: AggregationMethod
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

    /**
     * Property definitions for capture/editing
     * Defines trackable properties with types, defaults, and constraints
     */
    propertyDefinitions: PropertyDefinition[]

    /**
     * Show confetti animation when completing property capture
     * Adds a fun celebration when all properties are saved
     */
    showConfettiOnCapture: boolean

    /**
     * First day of the week for week grouping and heatmap columns.
     * 0 = Sunday, 1 = Monday. Defaults to Monday (issue #99).
     */
    weekStartsOn: WeekStartDay
}

export const DEFAULT_SETTINGS: PluginSettings = {
    visualizationPresets: [],
    animationDuration: 3000,
    propertyDefinitions: [],
    showConfettiOnCapture: true,
    weekStartsOn: 1
}
