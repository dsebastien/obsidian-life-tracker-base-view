import { describe, expect, test } from 'bun:test'
import {
    readPolarity,
    resolveTrendSentiment,
    describeTrendSentiment,
    polarityHeatmapPreset
} from './polarity.utils'
import { HEATMAP_PRESETS } from './color.utils'

describe('readPolarity', () => {
    test('passes the two real polarities through', () => {
        expect(readPolarity('higher-is-better')).toBe('higher-is-better')
        expect(readPolarity('lower-is-better')).toBe('lower-is-better')
    })

    test('treats missing as neutral (definitions from older versions)', () => {
        expect(readPolarity(undefined)).toBe('neutral')
        expect(readPolarity('neutral')).toBe('neutral')
    })

    test('treats an unrecognized stored value as neutral', () => {
        // Settings come from disk and can hold anything
        expect(readPolarity('sideways' as never)).toBe('neutral')
    })
})

describe('resolveTrendSentiment (issue #21)', () => {
    test('rising is good when higher is better, bad when lower is better', () => {
        expect(resolveTrendSentiment('up', 'higher-is-better')).toBe('good')
        expect(resolveTrendSentiment('up', 'lower-is-better')).toBe('bad')
    })

    test('falling is bad when higher is better, good when lower is better', () => {
        expect(resolveTrendSentiment('down', 'higher-is-better')).toBe('bad')
        expect(resolveTrendSentiment('down', 'lower-is-better')).toBe('good')
    })

    test('a neutral property is never judged', () => {
        expect(resolveTrendSentiment('up', 'neutral')).toBe('neutral')
        expect(resolveTrendSentiment('down', 'neutral')).toBe('neutral')
        expect(resolveTrendSentiment('up', undefined)).toBe('neutral')
        expect(resolveTrendSentiment('down', undefined)).toBe('neutral')
    })

    test('a flat trend is neutral whatever the polarity', () => {
        expect(resolveTrendSentiment('flat', 'higher-is-better')).toBe('neutral')
        expect(resolveTrendSentiment('flat', 'lower-is-better')).toBe('neutral')
        expect(resolveTrendSentiment('flat', 'neutral')).toBe('neutral')
    })
})

describe('describeTrendSentiment', () => {
    test('uses judgement words once a polarity is set', () => {
        expect(describeTrendSentiment('up', 'higher-is-better')).toBe('improving')
        expect(describeTrendSentiment('up', 'lower-is-better')).toBe('worsening')
        expect(describeTrendSentiment('down', 'lower-is-better')).toBe('improving')
        expect(describeTrendSentiment('down', 'higher-is-better')).toBe('worsening')
    })

    test('falls back to plain direction words for neutral properties', () => {
        expect(describeTrendSentiment('up', 'neutral')).toBe('rising')
        expect(describeTrendSentiment('down', undefined)).toBe('falling')
        expect(describeTrendSentiment('flat', 'neutral')).toBe('steady')
    })

    test('a flat trend stays steady even with a polarity set', () => {
        expect(describeTrendSentiment('flat', 'higher-is-better')).toBe('steady')
        expect(describeTrendSentiment('flat', 'lower-is-better')).toBe('steady')
    })
})

describe('polarityHeatmapPreset', () => {
    test('green when more is better, red when more is worse', () => {
        expect(polarityHeatmapPreset('higher-is-better')).toBe('green')
        expect(polarityHeatmapPreset('lower-is-better')).toBe('red')
    })

    test('returns null for neutral, so the plugin-wide default applies', () => {
        expect(polarityHeatmapPreset('neutral')).toBeNull()
        expect(polarityHeatmapPreset(undefined)).toBeNull()
    })

    test('every returned name resolves to a real preset', () => {
        for (const polarity of ['higher-is-better', 'lower-is-better'] as const) {
            const name = polarityHeatmapPreset(polarity)
            expect(name).not.toBeNull()
            expect(HEATMAP_PRESETS[name!]).toBeDefined()
        }
    })
})
