import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { getVisualizationConfig } from './visualization-config.helper'
import {
    VisualizationType,
    type ChartConfig,
    type ColumnVisualizationConfig,
    type HeatmapConfig,
    type StoredColorScheme
} from '../types'
import { HEATMAP_PRESETS } from '../../utils'

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
