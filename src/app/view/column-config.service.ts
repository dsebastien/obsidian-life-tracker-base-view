import type { BasesPropertyId } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { PropertyVisualizationPreset } from '../types/plugin-settings.intf'
import type {
    ColumnConfigMap,
    ColumnVisualizationConfig,
    ScaleConfig
} from '../types/column-config.types'
import { VisualizationType } from '../domain/visualization-type.enum'
import { log } from '../../utils/log'

/**
 * Config key for storing column configurations in view config
 */
export const COLUMN_CONFIGS_KEY = 'columnConfigs'

/**
 * Result of getting effective configuration for a property
 */
export interface EffectiveConfigResult {
    config: ColumnVisualizationConfig
    isFromPreset: boolean
}

/**
 * Service for managing column visualization configurations.
 * Handles local overrides and global preset matching.
 */
export class ColumnConfigService {
    constructor(
        private plugin: LifeTrackerPlugin,
        private getConfigValue: (key: string) => unknown,
        private setConfigValue: (key: string, value: unknown) => void
    ) {}

    /**
     * Get stored column configurations from view config
     */
    getColumnConfigs(): ColumnConfigMap {
        return (this.getConfigValue(COLUMN_CONFIGS_KEY) as ColumnConfigMap) ?? {}
    }

    /**
     * Save column configuration for a property
     */
    saveColumnConfig(
        propertyId: BasesPropertyId,
        visualizationType: VisualizationType,
        displayName: string,
        scale?: ScaleConfig
    ): void {
        const configs = this.getColumnConfigs()
        const config: ColumnVisualizationConfig = {
            propertyId,
            visualizationType,
            displayName,
            configuredAt: Date.now()
        }
        if (scale) {
            config.scale = scale
        }
        configs[propertyId] = config
        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Get column config for a property (if exists as local override)
     */
    getColumnConfig(propertyId: BasesPropertyId): ColumnVisualizationConfig | null {
        const configs = this.getColumnConfigs()
        return configs[propertyId] ?? null
    }

    /**
     * Find a matching global preset for a property
     * Matches against the raw property name (e.g., 'energy_level_evening')
     */
    findMatchingPreset(propertyId: BasesPropertyId): PropertyVisualizationPreset | null {
        const presets = this.plugin.settings.visualizationPresets
        if (presets.length === 0) return null

        // Extract raw property name from ID (e.g., 'note.energy_level_evening' -> 'energy_level_evening')
        const rawPropertyName = propertyId.includes('.')
            ? propertyId.substring(propertyId.indexOf('.') + 1)
            : propertyId

        const lowerRawName = rawPropertyName.toLowerCase()

        log('Finding preset', 'debug', {
            propertyId,
            rawPropertyName,
            presetPatterns: presets.map((p) => p.propertyNamePattern)
        })

        for (const preset of presets) {
            const patternLower = preset.propertyNamePattern.toLowerCase()

            if (patternLower === lowerRawName) {
                log('Preset matched', 'debug', {
                    pattern: preset.propertyNamePattern,
                    matchedTo: propertyId
                })
                return preset
            }
        }

        return null
    }

    /**
     * Get effective configuration for a property
     * Priority: local override > global preset > null (unconfigured)
     */
    getEffectiveConfig(
        propertyId: BasesPropertyId,
        displayName: string
    ): EffectiveConfigResult | null {
        // Check for local override first
        const localConfig = this.getColumnConfig(propertyId)
        if (localConfig) {
            return { config: localConfig, isFromPreset: false }
        }

        // Check for matching global preset
        const preset = this.findMatchingPreset(propertyId)
        if (preset) {
            // Create a config from the preset
            const configFromPreset: ColumnVisualizationConfig = {
                propertyId,
                visualizationType: preset.visualizationType,
                displayName,
                configuredAt: 0, // Not persisted
                scale: preset.scale
            }
            return { config: configFromPreset, isFromPreset: true }
        }

        return null
    }

    /**
     * Update an existing column configuration (local override)
     */
    updateColumnConfig(
        propertyId: BasesPropertyId,
        updates: Partial<ColumnVisualizationConfig>
    ): void {
        const configs = this.getColumnConfigs()
        const existing = configs[propertyId]
        if (existing) {
            configs[propertyId] = {
                ...existing,
                ...updates,
                configuredAt: Date.now()
            }
            this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
        }
    }

    /**
     * Delete a column configuration (reset to unconfigured state)
     */
    deleteColumnConfig(propertyId: BasesPropertyId): void {
        const configs = this.getColumnConfigs()
        delete configs[propertyId]
        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }
}
