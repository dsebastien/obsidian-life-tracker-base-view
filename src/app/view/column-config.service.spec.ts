import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import type { ColumnConfigMap, LegacyColumnConfigMap, PropertyVisualizationPreset } from '../types'
import { VisualizationType } from '../types'
import { ColumnConfigService, COLUMN_CONFIGS_KEY } from './column-config.service'
import type { LifeTrackerPlugin } from '../plugin'

const PROP_A = 'note.energy' as BasesPropertyId
const PROP_B = 'note.sleep' as BasesPropertyId

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal LifeTrackerPlugin mock (only what ColumnConfigService needs).
 */
function makePlugin(presets: PropertyVisualizationPreset[] = []): LifeTrackerPlugin {
    return {
        settings: { visualizationPresets: presets }
    } as unknown as LifeTrackerPlugin
}

/**
 * Create a ColumnConfigService backed by an in-memory store.
 * Returns the service AND a getter so tests can inspect the raw stored values.
 */
function makeService(
    initial: Record<string, unknown> = {},
    presets: PropertyVisualizationPreset[] = []
): { service: ColumnConfigService; store: Record<string, unknown> } {
    const store: Record<string, unknown> = { ...initial }

    const getConfigValue = (key: string): unknown => store[key]
    const setConfigValue = (key: string, value: unknown): void => {
        store[key] = value
    }

    const service = new ColumnConfigService(makePlugin(presets), getConfigValue, setConfigValue)
    return { service, store }
}

/**
 * Build a minimal legacy config map (V1 format: single object per property).
 */
function makeLegacyConfig(): LegacyColumnConfigMap {
    return {
        [PROP_A]: {
            propertyId: PROP_A,
            visualizationType: VisualizationType.Heatmap,
            displayName: 'Energy',
            configuredAt: 1000
        }
    } as unknown as LegacyColumnConfigMap
}

/**
 * Build a modern (V2) config map (array per property).
 */
function makeModernConfig(id = 'viz-1'): ColumnConfigMap {
    return {
        [PROP_A]: [
            {
                id,
                propertyId: PROP_A,
                visualizationType: VisualizationType.LineChart,
                displayName: 'Energy',
                configuredAt: 2000
            }
        ]
    } as unknown as ColumnConfigMap
}

// ─── Legacy format detection & migration ──────────────────────────────────────

describe('ColumnConfigService — legacy format migration', () => {
    test('isLegacyFormat: single-object config is detected as legacy and migrated', () => {
        const { service, store } = makeService({
            [COLUMN_CONFIGS_KEY]: makeLegacyConfig()
        })

        const result = service.getColumnConfigs()

        // After migration the value should be an array
        expect(Array.isArray(result[PROP_A])).toBe(true)
        expect(result[PROP_A]).toHaveLength(1)
        expect(result[PROP_A]![0]!.visualizationType).toBe(VisualizationType.Heatmap)

        // Migration should have written back to the store
        const stored = store[COLUMN_CONFIGS_KEY] as ColumnConfigMap
        expect(Array.isArray(stored[PROP_A])).toBe(true)
    })

    test('migration assigns a new id to the migrated visualization', () => {
        const { service } = makeService({ [COLUMN_CONFIGS_KEY]: makeLegacyConfig() })

        const result = service.getColumnConfigs()
        const config = result[PROP_A]![0]
        expect(config).toBeDefined()
        expect(typeof config!.id).toBe('string')
        expect(config!.id.length).toBeGreaterThan(0)
    })

    test('modern format is returned as-is without touching the store', () => {
        const modernCfg = makeModernConfig('existing-id')
        const { service, store } = makeService({ [COLUMN_CONFIGS_KEY]: modernCfg })

        // Track whether setConfigValue is called by checking store mutation
        const storeBefore = JSON.stringify(store)
        const result = service.getColumnConfigs()
        const storeAfter = JSON.stringify(store)

        expect(result[PROP_A]![0]!.id).toBe('existing-id')
        expect(storeBefore).toBe(storeAfter) // No writes for already-migrated data
    })

    test('empty store returns empty config map', () => {
        const { service } = makeService({})
        expect(service.getColumnConfigs()).toEqual({})
    })

    test('store with empty object returns empty config map without migrating', () => {
        const { service } = makeService({ [COLUMN_CONFIGS_KEY]: {} })
        expect(service.getColumnConfigs()).toEqual({})
    })
})

// ─── saveColumnConfig / getColumnConfig ───────────────────────────────────────

describe('ColumnConfigService — saveColumnConfig / getColumnConfig', () => {
    test('creates a new config for a property that has none', () => {
        const { service } = makeService()
        const id = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')

        const config = service.getColumnConfig(PROP_A)
        expect(config).not.toBeNull()
        expect(config!.id).toBe(id)
        expect(config!.visualizationType).toBe(VisualizationType.Heatmap)
    })

    test('saving over an existing config keeps the same id (first slot replacement)', () => {
        const { service } = makeService()
        const firstId = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        service.saveColumnConfig(PROP_A, VisualizationType.LineChart, 'Energy updated')

        const config = service.getColumnConfig(PROP_A)
        expect(config!.id).toBe(firstId)
        expect(config!.visualizationType).toBe(VisualizationType.LineChart)
    })

    test('getColumnConfig returns null for unknown property', () => {
        const { service } = makeService()
        expect(service.getColumnConfig(PROP_B)).toBeNull()
    })
})

// ─── addVisualization / removeVisualization ───────────────────────────────────

describe('ColumnConfigService — addVisualization / removeVisualization', () => {
    test('addVisualization inserts a copy after the source', () => {
        const { service } = makeService()
        const id1 = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        const id2 = service.addVisualization(PROP_A, id1)

        expect(id2).not.toBeNull()
        const configs = service.getPropertyConfigs(PROP_A)
        expect(configs).toHaveLength(2)
        expect(configs[0]!.id).toBe(id1)
        expect(configs[1]!.id).toBe(id2 ?? '')
    })

    test('addVisualization returns null when property has no configs', () => {
        const { service } = makeService()
        expect(service.addVisualization(PROP_B, 'nonexistent')).toBeNull()
    })

    test('removeVisualization removes a specific visualization', () => {
        const { service } = makeService()
        const id1 = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        const id2 = service.addVisualization(PROP_A, id1)!
        const removed = service.removeVisualization(PROP_A, id2)

        expect(removed).toBe(true)
        expect(service.getPropertyConfigs(PROP_A)).toHaveLength(1)
    })

    test('removeVisualization returns false when only one visualization remains', () => {
        const { service } = makeService()
        const id1 = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        const removed = service.removeVisualization(PROP_A, id1)

        expect(removed).toBe(false)
        expect(service.getPropertyConfigs(PROP_A)).toHaveLength(1)
    })
})

// ─── deleteColumnConfig / getVisualizationCount ───────────────────────────────

describe('ColumnConfigService — deleteColumnConfig', () => {
    test('deletes all configs for a property', () => {
        const { service } = makeService()
        service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        service.deleteColumnConfig(PROP_A)
        expect(service.getPropertyConfigs(PROP_A)).toHaveLength(0)
        expect(service.getVisualizationCount(PROP_A)).toBe(0)
    })

    test('deleting a non-existent property is a no-op', () => {
        const { service } = makeService()
        expect(() => service.deleteColumnConfig(PROP_B)).not.toThrow()
    })
})

// ─── findMatchingPreset ───────────────────────────────────────────────────────

describe('ColumnConfigService — findMatchingPreset', () => {
    const preset: PropertyVisualizationPreset = {
        id: 'preset-1',
        propertyNamePattern: 'energy',
        visualizationType: VisualizationType.Heatmap,
        displayName: 'Energy preset'
    } as unknown as PropertyVisualizationPreset

    test('returns matching preset by raw property name (case-insensitive)', () => {
        const { service } = makeService({}, [preset])
        // note.energy → rawPropertyName = energy
        const result = service.findMatchingPreset('note.energy' as BasesPropertyId)
        expect(result).not.toBeNull()
        expect(result!.id).toBe('preset-1')
    })

    test('match is case-insensitive', () => {
        const { service } = makeService({}, [preset])
        const result = service.findMatchingPreset('note.Energy' as BasesPropertyId)
        expect(result).not.toBeNull()
    })

    test('returns null when no preset matches', () => {
        const { service } = makeService({}, [preset])
        const result = service.findMatchingPreset('note.sleep' as BasesPropertyId)
        expect(result).toBeNull()
    })

    test('returns null when presets array is empty', () => {
        const { service } = makeService({}, [])
        expect(service.findMatchingPreset('note.energy' as BasesPropertyId)).toBeNull()
    })
})

// ─── getEffectiveConfig priority ─────────────────────────────────────────────

describe('ColumnConfigService — getEffectiveConfig priority', () => {
    const preset: PropertyVisualizationPreset = {
        id: 'preset-1',
        propertyNamePattern: 'energy',
        visualizationType: VisualizationType.Heatmap,
        displayName: 'Energy preset'
    } as unknown as PropertyVisualizationPreset

    test('local override takes precedence over global preset', () => {
        const { service } = makeService({}, [preset])
        service.saveColumnConfig(PROP_A, VisualizationType.LineChart, 'Local energy')

        const result = service.getEffectiveConfig(PROP_A, 'Energy')
        expect(result).not.toBeNull()
        expect(result!.isFromPreset).toBe(false)
        expect(result!.config.visualizationType).toBe(VisualizationType.LineChart)
    })

    test('preset is used when no local override exists', () => {
        const { service } = makeService({}, [preset])
        const result = service.getEffectiveConfig(PROP_A, 'Energy')
        expect(result).not.toBeNull()
        expect(result!.isFromPreset).toBe(true)
        expect(result!.config.visualizationType).toBe(VisualizationType.Heatmap)
    })

    test('returns null when no local config and no matching preset', () => {
        const { service } = makeService({}, [])
        expect(service.getEffectiveConfig(PROP_B, 'Sleep')).toBeNull()
    })
})

// ─── updateVisualizationConfig ────────────────────────────────────────────────

describe('ColumnConfigService — updateVisualizationConfig', () => {
    test('applies partial updates to an existing visualization', () => {
        const { service } = makeService()
        const id = service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')

        service.updateVisualizationConfig(PROP_A, id, {
            visualizationType: VisualizationType.LineChart,
            displayName: 'Energy (line)'
        })

        const config = service.getVisualizationConfig(PROP_A, id)
        expect(config!.visualizationType).toBe(VisualizationType.LineChart)
        expect(config!.displayName).toBe('Energy (line)')
    })

    test('is a no-op for unknown property', () => {
        const { service } = makeService()
        expect(() =>
            service.updateVisualizationConfig(PROP_B, 'nonexistent', {
                displayName: 'Nope'
            })
        ).not.toThrow()
    })
})

// ─── cleanupOrphanedConfigs ───────────────────────────────────────────────────

describe('ColumnConfigService — cleanupOrphanedConfigs', () => {
    test('removes configs for properties not in currentPropertyIds', () => {
        const { service } = makeService()
        service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        service.saveColumnConfig(PROP_B, VisualizationType.LineChart, 'Sleep')

        const orphaned = service.cleanupOrphanedConfigs(new Set([PROP_B]))
        expect(orphaned).toContain(PROP_A)
        expect(service.getPropertyConfigs(PROP_A)).toHaveLength(0)
        expect(service.getPropertyConfigs(PROP_B)).toHaveLength(1)
    })

    test('returns empty array when no orphans exist', () => {
        const { service } = makeService()
        service.saveColumnConfig(PROP_A, VisualizationType.Heatmap, 'Energy')
        const orphaned = service.cleanupOrphanedConfigs(new Set([PROP_A, PROP_B]))
        expect(orphaned).toHaveLength(0)
    })
})
