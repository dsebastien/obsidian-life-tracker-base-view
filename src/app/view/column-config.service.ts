import type { BasesPropertyId } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import {
    VisualizationType,
    generateVisualizationId,
    type PropertyVisualizationPreset,
    type ColumnConfigMap,
    type LegacyColumnConfigMap,
    type ColumnVisualizationConfig,
    type OverlayVisualizationConfig,
    type OverlayConfigMap,
    type ScaleConfig,
    type ReferenceLineConfig,
    type EffectiveConfigResult
} from '../types'
import { log, type ChartColorScheme } from '../../utils'

/**
 * Config key for storing column configurations in view config
 */
export const COLUMN_CONFIGS_KEY = 'columnConfigs'

/**
 * Config key for storing overlay configurations in view config
 */
export const OVERLAY_CONFIGS_KEY = 'overlayConfigs'

/**
 * Check if a config object is in legacy format (single config per property)
 */
function isLegacyFormat(
    configs: ColumnConfigMap | LegacyColumnConfigMap
): configs is LegacyColumnConfigMap {
    const keys = Object.keys(configs)
    if (keys.length === 0) return false

    const firstKey = keys[0]
    if (!firstKey) return false

    // Use Object.values to get the first value without type issues
    const values = Object.values(configs)
    const firstValue = values[0]
    // Legacy format: value is an object with visualizationType property
    // New format: value is an array
    return firstValue !== undefined && !Array.isArray(firstValue)
}

/**
 * Migrate legacy format to new array format
 */
function migrateToArrayFormat(legacy: LegacyColumnConfigMap): ColumnConfigMap {
    const result: ColumnConfigMap = {}
    for (const [propertyId, config] of Object.entries(legacy)) {
        if (config) {
            result[propertyId as BasesPropertyId] = [
                {
                    ...config,
                    id: generateVisualizationId()
                }
            ]
        }
    }
    return result
}

/**
 * Service for managing column visualization configurations.
 * Handles local overrides and global preset matching.
 * Supports multiple visualizations per property.
 */
export class ColumnConfigService {
    constructor(
        private plugin: LifeTrackerPlugin,
        private getConfigValue: (key: string) => unknown,
        private setConfigValue: (key: string, value: unknown) => void
    ) {}

    /**
     * Get stored column configurations from view config.
     * Automatically migrates legacy format if detected.
     */
    getColumnConfigs(): ColumnConfigMap {
        const raw = this.getConfigValue(COLUMN_CONFIGS_KEY) as
            | ColumnConfigMap
            | LegacyColumnConfigMap
            | undefined

        if (!raw) {
            return {}
        }

        // Check for legacy format and migrate if needed
        if (isLegacyFormat(raw)) {
            log('Migrating column configs from legacy format', 'debug')
            const migrated = migrateToArrayFormat(raw)
            this.setConfigValue(COLUMN_CONFIGS_KEY, migrated)
            return migrated
        }

        return raw
    }

    /**
     * Save a new visualization configuration for a property.
     * If the property has no configs, creates the first one.
     * Use addVisualization() to add additional visualizations.
     */
    saveColumnConfig(
        propertyId: BasesPropertyId,
        visualizationType: VisualizationType,
        displayName: string,
        scale?: ScaleConfig,
        colorScheme?: ChartColorScheme,
        referenceLine?: ReferenceLineConfig
    ): string {
        const configs = this.getColumnConfigs()
        const existingConfigs = configs[propertyId] ?? []

        const id = generateVisualizationId()
        const config: ColumnVisualizationConfig = {
            id,
            propertyId,
            visualizationType,
            displayName,
            configuredAt: Date.now()
        }
        if (scale) {
            config.scale = scale
        }
        if (colorScheme) {
            config.colorScheme = colorScheme
        }
        if (referenceLine) {
            config.referenceLine = referenceLine
        }

        // If no existing configs, create first one. Otherwise replace first one.
        if (existingConfigs.length === 0) {
            configs[propertyId] = [config]
        } else {
            // Replace the first visualization (used when configuring unconfigured property)
            const firstConfig = existingConfigs[0]
            if (firstConfig) {
                config.id = firstConfig.id // Keep the same ID
            }
            configs[propertyId] = [config, ...existingConfigs.slice(1)]
        }

        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
        return config.id
    }

    /**
     * Add a new visualization for a property (copies settings from source)
     */
    addVisualization(propertyId: BasesPropertyId, sourceVisualizationId: string): string | null {
        const configs = this.getColumnConfigs()
        const propertyConfigs = configs[propertyId]

        if (!propertyConfigs || propertyConfigs.length === 0) {
            return null
        }

        // Find source visualization to copy settings from
        const sourceConfig = propertyConfigs.find((c) => c.id === sourceVisualizationId)
        if (!sourceConfig) {
            return null
        }

        // Create new visualization with copied settings
        const newId = generateVisualizationId()
        const newConfig: ColumnVisualizationConfig = {
            ...sourceConfig,
            id: newId,
            configuredAt: Date.now()
        }

        // Insert after the source visualization
        const sourceIndex = propertyConfigs.findIndex((c) => c.id === sourceVisualizationId)
        const newConfigs = [...propertyConfigs]
        newConfigs.splice(sourceIndex + 1, 0, newConfig)
        configs[propertyId] = newConfigs

        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
        return newId
    }

    /**
     * Remove a visualization (only if property has more than one)
     */
    removeVisualization(propertyId: BasesPropertyId, visualizationId: string): boolean {
        const configs = this.getColumnConfigs()
        const propertyConfigs = configs[propertyId]

        if (!propertyConfigs || propertyConfigs.length <= 1) {
            // Cannot remove the last visualization
            return false
        }

        const newConfigs = propertyConfigs.filter((c) => c.id !== visualizationId)
        if (newConfigs.length === propertyConfigs.length) {
            // Visualization not found
            return false
        }

        configs[propertyId] = newConfigs
        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
        return true
    }

    /**
     * Get all visualization configs for a property
     */
    getPropertyConfigs(propertyId: BasesPropertyId): ColumnVisualizationConfig[] {
        const configs = this.getColumnConfigs()
        return configs[propertyId] ?? []
    }

    /**
     * Get a specific visualization config by ID
     */
    getVisualizationConfig(
        propertyId: BasesPropertyId,
        visualizationId: string
    ): ColumnVisualizationConfig | null {
        const propertyConfigs = this.getPropertyConfigs(propertyId)
        return propertyConfigs.find((c) => c.id === visualizationId) ?? null
    }

    /**
     * Get the first column config for a property (for backwards compatibility)
     */
    getColumnConfig(propertyId: BasesPropertyId): ColumnVisualizationConfig | null {
        const propertyConfigs = this.getPropertyConfigs(propertyId)
        return propertyConfigs[0] ?? null
    }

    /**
     * Get count of visualizations for a property
     */
    getVisualizationCount(propertyId: BasesPropertyId): number {
        return this.getPropertyConfigs(propertyId).length
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
     * Get effective configuration for a property (first visualization or preset).
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
                id: generateVisualizationId(),
                propertyId,
                visualizationType: preset.visualizationType,
                displayName,
                configuredAt: 0, // Not persisted
                scale: preset.scale,
                colorScheme: preset.colorScheme
            }
            return { config: configFromPreset, isFromPreset: true }
        }

        return null
    }

    /**
     * Get effective configs for all visualizations of a property.
     * Returns array of effective configs (local overrides or preset-based).
     */
    getEffectiveConfigs(propertyId: BasesPropertyId, displayName: string): EffectiveConfigResult[] {
        const localConfigs = this.getPropertyConfigs(propertyId)

        if (localConfigs.length > 0) {
            // Return all local configs
            return localConfigs.map((config) => ({
                config,
                isFromPreset: false
            }))
        }

        // No local configs, check for preset
        const preset = this.findMatchingPreset(propertyId)
        if (preset) {
            const configFromPreset: ColumnVisualizationConfig = {
                id: generateVisualizationId(),
                propertyId,
                visualizationType: preset.visualizationType,
                displayName,
                configuredAt: 0,
                scale: preset.scale,
                colorScheme: preset.colorScheme
            }
            return [{ config: configFromPreset, isFromPreset: true }]
        }

        return []
    }

    /**
     * Update an existing visualization configuration
     */
    updateVisualizationConfig(
        propertyId: BasesPropertyId,
        visualizationId: string,
        updates: Partial<Omit<ColumnVisualizationConfig, 'id' | 'propertyId'>>
    ): void {
        const configs = this.getColumnConfigs()
        const propertyConfigs = configs[propertyId]

        if (!propertyConfigs) return

        const index = propertyConfigs.findIndex((c) => c.id === visualizationId)
        if (index === -1) return

        const existing = propertyConfigs[index]
        if (!existing) return

        propertyConfigs[index] = {
            ...existing,
            ...updates,
            configuredAt: Date.now()
        }

        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Update an existing column configuration (updates first visualization)
     * @deprecated Use updateVisualizationConfig for specific visualization
     */
    updateColumnConfig(
        propertyId: BasesPropertyId,
        updates: Partial<ColumnVisualizationConfig>
    ): void {
        const configs = this.getColumnConfigs()
        const propertyConfigs = configs[propertyId]

        if (!propertyConfigs || propertyConfigs.length === 0) return

        const existing = propertyConfigs[0]
        if (!existing) return

        propertyConfigs[0] = {
            ...existing,
            ...updates,
            configuredAt: Date.now()
        }

        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Delete all configurations for a property (reset to unconfigured state)
     */
    deleteColumnConfig(propertyId: BasesPropertyId): void {
        const configs = this.getColumnConfigs()
        delete configs[propertyId]
        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Delete a specific visualization's config and reset to preset if it was the only one
     */
    resetVisualizationConfig(propertyId: BasesPropertyId, visualizationId: string): void {
        const configs = this.getColumnConfigs()
        const propertyConfigs = configs[propertyId]

        if (!propertyConfigs) return

        if (propertyConfigs.length === 1) {
            // Only one visualization - delete all configs for property
            delete configs[propertyId]
        } else {
            // Multiple visualizations - just remove this one
            configs[propertyId] = propertyConfigs.filter((c) => c.id !== visualizationId)
        }

        this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Clean up orphaned configs for properties that no longer exist.
     * Call this after detecting property removal to prevent config bloat.
     * @param currentPropertyIds - Set of property IDs currently in the Base
     * @returns Array of deleted property IDs
     */
    cleanupOrphanedConfigs(currentPropertyIds: Set<BasesPropertyId>): BasesPropertyId[] {
        const configs = this.getColumnConfigs()
        const orphanedIds: BasesPropertyId[] = []

        for (const propertyId of Object.keys(configs) as BasesPropertyId[]) {
            if (!currentPropertyIds.has(propertyId)) {
                orphanedIds.push(propertyId)
                delete configs[propertyId]
            }
        }

        if (orphanedIds.length > 0) {
            this.setConfigValue(COLUMN_CONFIGS_KEY, configs)
            log('Cleaned up orphaned configs', 'debug', { orphanedIds })
        }

        // Also cleanup overlay configs that reference removed properties
        this.cleanupOrphanedOverlays(currentPropertyIds)

        return orphanedIds
    }

    // ==================== Overlay Config Methods ====================

    /**
     * Get stored overlay configurations from view config.
     */
    getOverlayConfigs(): OverlayConfigMap {
        const raw = this.getConfigValue(OVERLAY_CONFIGS_KEY) as OverlayConfigMap | undefined
        return raw ?? {}
    }

    /**
     * Get all overlay configs as an array
     */
    getOverlayConfigsArray(): OverlayVisualizationConfig[] {
        const configs = this.getOverlayConfigs()
        return Object.values(configs)
    }

    /**
     * Get a specific overlay config by ID
     */
    getOverlayConfig(overlayId: string): OverlayVisualizationConfig | null {
        const configs = this.getOverlayConfigs()
        return configs[overlayId] ?? null
    }

    /**
     * Create an overlay visualization combining multiple properties
     * @returns The new overlay ID
     */
    createOverlayConfig(
        propertyIds: BasesPropertyId[],
        visualizationType: VisualizationType,
        displayName: string,
        scale?: ScaleConfig,
        colorScheme?: ChartColorScheme
    ): string {
        if (propertyIds.length < 2) {
            log('Cannot create overlay with fewer than 2 properties', 'warn')
            return ''
        }

        const configs = this.getOverlayConfigs()
        const id = generateVisualizationId()

        const config: OverlayVisualizationConfig = {
            id,
            propertyIds,
            visualizationType,
            displayName,
            configuredAt: Date.now()
        }

        if (scale) {
            config.scale = scale
        }
        if (colorScheme) {
            config.colorScheme = colorScheme
        }

        configs[id] = config
        this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)

        log('Created overlay config', 'debug', { id, propertyIds, visualizationType })
        return id
    }

    /**
     * Update an overlay configuration
     */
    updateOverlayConfig(
        overlayId: string,
        updates: Partial<Omit<OverlayVisualizationConfig, 'id'>>
    ): void {
        const configs = this.getOverlayConfigs()
        const existing = configs[overlayId]

        if (!existing) return

        configs[overlayId] = {
            ...existing,
            ...updates,
            configuredAt: Date.now()
        }

        this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
    }

    /**
     * Add a property to an existing overlay
     */
    addPropertyToOverlay(overlayId: string, propertyId: BasesPropertyId): boolean {
        const configs = this.getOverlayConfigs()
        const overlay = configs[overlayId]

        if (!overlay) return false

        // Don't add duplicates
        if (overlay.propertyIds.includes(propertyId)) {
            return false
        }

        overlay.propertyIds.push(propertyId)
        overlay.configuredAt = Date.now()

        this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
        return true
    }

    /**
     * Remove a property from an overlay
     * If only one property would remain, deletes the overlay
     * @returns true if property was removed, false if overlay was deleted or property not found
     */
    removePropertyFromOverlay(overlayId: string, propertyId: BasesPropertyId): boolean {
        const configs = this.getOverlayConfigs()
        const overlay = configs[overlayId]

        if (!overlay) return false

        const index = overlay.propertyIds.indexOf(propertyId)
        if (index === -1) return false

        overlay.propertyIds.splice(index, 1)

        // Delete overlay if fewer than 2 properties remain
        if (overlay.propertyIds.length < 2) {
            delete configs[overlayId]
            this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
            log('Deleted overlay due to insufficient properties', 'debug', { overlayId })
            return false
        }

        overlay.configuredAt = Date.now()
        this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
        return true
    }

    /**
     * Delete an overlay configuration
     */
    deleteOverlayConfig(overlayId: string): void {
        const configs = this.getOverlayConfigs()
        delete configs[overlayId]
        this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
    }

    /**
     * Check if a property should have its individual visualizations hidden.
     * Returns true if the property is in at least one overlay with hideIndividualVisualizations enabled.
     */
    shouldHideIndividualVisualization(propertyId: BasesPropertyId): boolean {
        const overlays = this.getOverlayConfigsArray()
        return overlays.some(
            (overlay) =>
                overlay.hideIndividualVisualizations === true &&
                overlay.propertyIds.includes(propertyId)
        )
    }

    /**
     * Clean up overlays that reference properties that no longer exist.
     * If an overlay loses properties, it's adjusted. If it drops below 2 properties, it's deleted.
     */
    cleanupOrphanedOverlays(currentPropertyIds: Set<BasesPropertyId>): void {
        const configs = this.getOverlayConfigs()
        let changed = false

        for (const [overlayId, overlay] of Object.entries(configs)) {
            // Filter to only properties that still exist
            const validPropertyIds = overlay.propertyIds.filter((id) => currentPropertyIds.has(id))

            if (validPropertyIds.length !== overlay.propertyIds.length) {
                changed = true

                if (validPropertyIds.length < 2) {
                    // Not enough properties - delete the overlay
                    delete configs[overlayId]
                    log('Deleted overlay due to removed properties', 'debug', {
                        overlayId,
                        removed: overlay.propertyIds.filter((id) => !currentPropertyIds.has(id))
                    })
                } else {
                    // Update the overlay with remaining properties
                    overlay.propertyIds = validPropertyIds
                    overlay.configuredAt = Date.now()
                }
            }
        }

        if (changed) {
            this.setConfigValue(OVERLAY_CONFIGS_KEY, configs)
        }
    }
}
