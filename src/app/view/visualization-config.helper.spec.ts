import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { getVisualizationConfig } from './visualization-config.helper'
import {
    VisualizationType,
    createDefaultPropertyDefinition,
    type ChartConfig,
    type ColumnVisualizationConfig,
    type HeatmapConfig,
    type PropertyDefinition,
    type StoredColorScheme,
    type ValuePolarity
} from '../types'
import { HEATMAP_PRESETS, HEATMAP_SCHEME_AUTO } from '../../utils'

/** Build a view-config getter backed by a plain object */
function configGetter(values: Record<string, unknown> = {}): (key: string) => unknown {
    return (key: string) => values[key]
}

function columnConfig(colorScheme?: StoredColorScheme): ColumnVisualizationConfig {
    const config: ColumnVisualizationConfig = {
        id: 'viz-1',
        propertyId: 'note.mood' as BasesPropertyId,
        visualizationType: VisualizationType.Heatmap,
        displayName: 'Mood',
        configuredAt: 0
    }
    if (colorScheme !== undefined) {
        config.colorScheme = colorScheme
    }
    return config
}

function heatmapConfigFor(
    colorScheme: StoredColorScheme | undefined,
    viewConfig: Record<string, unknown> = {}
): HeatmapConfig {
    return getVisualizationConfig(
        VisualizationType.Heatmap,
        columnConfig(colorScheme),
        configGetter(viewConfig)
    ) as HeatmapConfig
}

describe('getVisualizationConfig - heatmap color scheme (issue #82)', () => {
    test('falls back to the green preset when nothing is configured', () => {
        expect(heatmapConfigFor(undefined).colorScheme).toEqual(HEATMAP_PRESETS['green']!)
    })

    test('uses the view-wide scheme name when there is no per-card override', () => {
        expect(heatmapConfigFor(undefined, { heatmapColorScheme: 'blue' }).colorScheme).toEqual(
            HEATMAP_PRESETS['blue']!
        )
    })

    test('a per-card preset name wins over the view-wide one', () => {
        expect(heatmapConfigFor('viridis', { heatmapColorScheme: 'blue' }).colorScheme).toEqual(
            HEATMAP_PRESETS['viridis']!
        )
    })

    test('an unknown preset name falls back to green rather than crashing', () => {
        expect(heatmapConfigFor('chartreuse' as StoredColorScheme).colorScheme).toEqual(
            HEATMAP_PRESETS['green']!
        )
    })

    test('an inline custom mapping is used as-is, ignoring the view-wide name', () => {
        const custom: StoredColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2', '5': '#d55e00' },
            fallback: '#999999'
        }

        expect(heatmapConfigFor(custom, { heatmapColorScheme: 'blue' }).colorScheme).toEqual(custom)
    })

    test('a malformed inline scheme falls back to a preset instead of rendering nothing', () => {
        // e.g. a hand-edited .base file with a truncated mapping object
        const broken = { kind: 'gradient', levels: ['#111'] } as unknown as StoredColorScheme

        expect(heatmapConfigFor(broken, { heatmapColorScheme: 'red' }).colorScheme).toEqual(
            HEATMAP_PRESETS['red']!
        )
    })
})

describe('getVisualizationConfig - chart color scheme narrowing (issue #82)', () => {
    function chartConfigFor(colorScheme: StoredColorScheme | undefined): ChartConfig {
        return getVisualizationConfig(
            VisualizationType.LineChart,
            { ...columnConfig(colorScheme), visualizationType: VisualizationType.LineChart },
            configGetter()
        ) as ChartConfig
    }

    test('passes a valid chart scheme name through', () => {
        expect(chartConfigFor('colorblind').colorScheme).toBe('colorblind')
    })

    test('drops a heatmap-only preset name so the chart uses its default palette', () => {
        expect(chartConfigFor('viridis').colorScheme).toBeUndefined()
    })

    test('drops an inline heatmap scheme object', () => {
        const custom: StoredColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2' }
        }
        expect(chartConfigFor(custom).colorScheme).toBeUndefined()
    })
})

describe('getVisualizationConfig - polarity and emojis (issues #21, #22)', () => {
    function definitionWith(
        polarity: ValuePolarity | undefined,
        valueEmojis: Record<string, string> | null = null
    ): PropertyDefinition {
        const definition = createDefaultPropertyDefinition('def-1', 0)
        definition.name = 'mood'
        definition.type = 'number'
        definition.polarity = polarity
        definition.valueEmojis = valueEmojis
        return definition
    }

    function configWith(
        definition: PropertyDefinition | null,
        viewConfig: Record<string, unknown> = {},
        colorScheme?: StoredColorScheme
    ): HeatmapConfig {
        return getVisualizationConfig(
            VisualizationType.Heatmap,
            columnConfig(colorScheme),
            configGetter(viewConfig),
            definition
        ) as HeatmapConfig
    }

    test('carries polarity and the emoji map onto the visualization config', () => {
        const config = configWith(definitionWith('higher-is-better', { '1': '😞' }))

        expect(config.polarity).toBe('higher-is-better')
        expect(config.valueEmojis).toEqual({ '1': '😞' })
    })

    test('a property with no definition gets neutral semantics', () => {
        const config = configWith(null)

        expect(config.polarity).toBeUndefined()
        expect(config.valueEmojis).toBeNull()
    })

    test('higher-is-better defaults the heatmap to green, lower-is-better to red', () => {
        expect(configWith(definitionWith('higher-is-better')).colorScheme).toEqual(
            HEATMAP_PRESETS['green']!
        )
        expect(configWith(definitionWith('lower-is-better')).colorScheme).toEqual(
            HEATMAP_PRESETS['red']!
        )
    })

    test('neutral keeps the plugin-wide green default', () => {
        expect(configWith(definitionWith('neutral')).colorScheme).toEqual(HEATMAP_PRESETS['green']!)
        expect(configWith(definitionWith(undefined)).colorScheme).toEqual(HEATMAP_PRESETS['green']!)
    })

    test('the view-wide "auto" value hands over to polarity', () => {
        // `auto` is that setting's own default and means "nothing chosen".
        // Reading it as a preset name would make polarity unreachable.
        const config = configWith(definitionWith('lower-is-better'), {
            heatmapColorScheme: HEATMAP_SCHEME_AUTO
        })
        expect(config.colorScheme).toEqual(HEATMAP_PRESETS['red']!)
    })

    test('"auto" with a neutral property falls through to green', () => {
        const config = configWith(definitionWith('neutral'), {
            heatmapColorScheme: HEATMAP_SCHEME_AUTO
        })
        expect(config.colorScheme).toEqual(HEATMAP_PRESETS['green']!)
    })

    test('polarity is only a default: an explicit view-wide scheme still wins', () => {
        const config = configWith(definitionWith('lower-is-better'), {
            heatmapColorScheme: 'blue'
        })
        expect(config.colorScheme).toEqual(HEATMAP_PRESETS['blue']!)
    })

    test('polarity is only a default: an explicit per-card scheme still wins', () => {
        const config = configWith(definitionWith('lower-is-better'), {}, 'viridis')
        expect(config.colorScheme).toEqual(HEATMAP_PRESETS['viridis']!)
    })

    test('polarity never overrides a custom mapping', () => {
        const custom: StoredColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2' }
        }
        const config = configWith(definitionWith('lower-is-better'), {}, custom)
        expect(config.colorScheme).toEqual(custom)
    })
})
