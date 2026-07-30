import { describe, expect, test } from 'bun:test'
import {
    HEATMAP_PRESETS,
    getHeatmapColor,
    getColorLevelForValue,
    DEFAULT_CHART_COLORS,
    CHART_COLORS_HEX,
    getChartColor,
    getColorWithAlpha,
    generateGradient,
    applyHeatmapColorScheme,
    resolveHeatmapCellColor,
    isDiscreteHeatmapScheme,
    normalizeHeatmapColorScheme,
    createDefaultDiscreteScheme,
    nextDiscreteEntryColor,
    asChartColorScheme,
    getChartColorScheme,
    COLORBLIND_SAFE_PALETTE,
    HEATMAP_COLOR_SCHEME_OPTIONS
} from './color.utils'
import type { DiscreteHeatmapColorScheme, HeatmapColorScheme } from '../app/types'

/**
 * Creates a mock HTMLElement with style.setProperty tracking for testing
 */
function createMockElement(): HTMLElement & { appliedStyles: Map<string, string> } {
    const appliedStyles = new Map<string, string>()
    return {
        appliedStyles,
        style: {
            setProperty: (name: string, value: string) => {
                appliedStyles.set(name, value)
            }
        }
    } as unknown as HTMLElement & { appliedStyles: Map<string, string> }
}

describe('color-utils', () => {
    describe('HEATMAP_PRESETS', () => {
        test('includes green preset with correct structure', () => {
            const green = HEATMAP_PRESETS['green']
            expect(green).toBeDefined()
            expect(green!.empty).toBe('var(--background-modifier-border)')
            expect(green!.levels.length).toBe(5)
        })

        test('includes blue preset', () => {
            expect(HEATMAP_PRESETS['blue']).toBeDefined()
            expect(HEATMAP_PRESETS['blue']!.levels.length).toBe(5)
        })

        test('includes purple preset', () => {
            expect(HEATMAP_PRESETS['purple']).toBeDefined()
        })

        test('includes orange preset', () => {
            expect(HEATMAP_PRESETS['orange']).toBeDefined()
        })

        test('includes red preset', () => {
            expect(HEATMAP_PRESETS['red']).toBeDefined()
        })
    })

    describe('getHeatmapColor', () => {
        const greenScheme = HEATMAP_PRESETS['green']!

        test('returns empty color for level 0', () => {
            expect(getHeatmapColor(0, greenScheme)).toBe(greenScheme.empty)
        })

        test('returns correct color for level 1', () => {
            expect(getHeatmapColor(1, greenScheme)).toBe(greenScheme.levels[1])
        })

        test('returns correct color for level 2', () => {
            expect(getHeatmapColor(2, greenScheme)).toBe(greenScheme.levels[2])
        })

        test('returns correct color for level 3', () => {
            expect(getHeatmapColor(3, greenScheme)).toBe(greenScheme.levels[3])
        })

        test('returns correct color for level 4', () => {
            expect(getHeatmapColor(4, greenScheme)).toBe(greenScheme.levels[4])
        })
    })

    describe('getColorLevelForValue', () => {
        test('returns 0 for null value', () => {
            expect(getColorLevelForValue(null, 0, 100)).toBe(0)
        })

        test('returns 0 for value 0 on a 0-based scale (zero means absence)', () => {
            expect(getColorLevelForValue(0, 0, 100)).toBe(0)
            expect(getColorLevelForValue(0, 0, 5)).toBe(0)
        })

        test('returns 1 for values <= 25% on a 0-based scale', () => {
            expect(getColorLevelForValue(25, 0, 100)).toBe(1)
            expect(getColorLevelForValue(10, 0, 100)).toBe(1)
            expect(getColorLevelForValue(1, 0, 5)).toBe(1)
        })

        test('returns 2 for values <= 50%', () => {
            expect(getColorLevelForValue(50, 0, 100)).toBe(2)
            expect(getColorLevelForValue(40, 0, 100)).toBe(2)
        })

        test('returns 3 for values <= 75%', () => {
            expect(getColorLevelForValue(75, 0, 100)).toBe(3)
            expect(getColorLevelForValue(60, 0, 100)).toBe(3)
        })

        test('returns 4 for values > 75%', () => {
            expect(getColorLevelForValue(100, 0, 100)).toBe(4)
            expect(getColorLevelForValue(80, 0, 100)).toBe(4)
        })

        test('handles equal min and max', () => {
            expect(getColorLevelForValue(50, 50, 50)).toBe(4)
            // value=0, min=0 falls under the "zero-on-zero-scale" rule
            expect(getColorLevelForValue(0, 0, 0)).toBe(0)
        })

        test('handles negative ranges', () => {
            expect(getColorLevelForValue(0, -100, 100)).toBe(2)
            expect(getColorLevelForValue(-100, -100, 100)).toBe(1)
            expect(getColorLevelForValue(100, -100, 100)).toBe(4)
        })

        test('cells at min are visible when min > 0 (e.g. year ranges)', () => {
            expect(getColorLevelForValue(2025, 2025, 2026)).toBe(1)
            expect(getColorLevelForValue(2026, 2025, 2026)).toBe(4)
        })

        test('issue #87: scale starting at 0 renders 0 as empty, 1 as level 1', () => {
            // Reporter: blue scheme, scale 0-5, entries of 0 or 1 should
            // render differently — 0 = empty, 1 = first colored level.
            expect(getColorLevelForValue(0, 0, 5)).toBe(0)
            expect(getColorLevelForValue(1, 0, 5)).toBe(1)
        })

        test('value 0 with non-zero min still maps to a colored level', () => {
            // Negative-range case: 0 is in the middle of the scale, not absence.
            expect(getColorLevelForValue(0, -100, 100)).toBe(2)
        })
    })

    describe('DEFAULT_CHART_COLORS', () => {
        test('has 8 colors', () => {
            expect(DEFAULT_CHART_COLORS.length).toBe(8)
        })

        test('uses CSS variables', () => {
            DEFAULT_CHART_COLORS.forEach((color) => {
                expect(color.startsWith('var(--')).toBe(true)
            })
        })
    })

    describe('CHART_COLORS_HEX', () => {
        test('has 8 colors', () => {
            expect(CHART_COLORS_HEX.length).toBe(8)
        })

        test('uses hex format', () => {
            CHART_COLORS_HEX.forEach((color) => {
                expect(color.startsWith('#')).toBe(true)
                expect(color.length).toBe(7)
            })
        })
    })

    describe('getChartColor', () => {
        test('returns CSS variable by default', () => {
            const color = getChartColor(0)
            expect(color.startsWith('var(--')).toBe(true)
        })

        test('returns hex color when useHex is true', () => {
            const color = getChartColor(0, true)
            expect(color.startsWith('#')).toBe(true)
        })

        test('cycles through colors', () => {
            const first = getChartColor(0, true)
            const ninth = getChartColor(8, true)
            expect(first).toBe(ninth)
        })

        test('returns different colors for different indices', () => {
            const color0 = getChartColor(0, true)
            const color1 = getChartColor(1, true)
            expect(color0).not.toBe(color1)
        })
    })

    describe('getColorWithAlpha', () => {
        test('returns CSS variable unchanged', () => {
            const color = 'var(--color-blue)'
            expect(getColorWithAlpha(color, 0.5)).toBe(color)
        })

        test('converts hex color to rgba', () => {
            const result = getColorWithAlpha('#ff0000', 0.5)
            expect(result).toBe('rgba(255, 0, 0, 0.5)')
        })

        test('handles hex color with different alpha values', () => {
            expect(getColorWithAlpha('#00ff00', 0)).toBe('rgba(0, 255, 0, 0)')
            expect(getColorWithAlpha('#00ff00', 1)).toBe('rgba(0, 255, 0, 1)')
            expect(getColorWithAlpha('#00ff00', 0.75)).toBe('rgba(0, 255, 0, 0.75)')
        })

        test('converts rgb color to rgba', () => {
            const result = getColorWithAlpha('rgb(255, 0, 0)', 0.5)
            expect(result).toBe('rgba(255, 0, 0, 0.5)')
        })

        test('converts rgba color (replaces alpha)', () => {
            const result = getColorWithAlpha('rgba(255, 0, 0, 1)', 0.5)
            expect(result).toBe('rgba(255, 0, 0, 0.5)')
        })

        test('returns unknown format unchanged', () => {
            const color = 'hsl(0, 100%, 50%)'
            expect(getColorWithAlpha(color, 0.5)).toBe(color)
        })
    })

    describe('generateGradient', () => {
        test('generates correct number of steps', () => {
            const result = generateGradient('#000000', '#ffffff', 5)
            expect(result.length).toBe(5)
        })

        test('starts with first color', () => {
            const result = generateGradient('#000000', '#ffffff', 5)
            expect(result[0]).toBe('#000000')
        })

        test('ends with second color', () => {
            const result = generateGradient('#000000', '#ffffff', 5)
            expect(result[4]).toBe('#ffffff')
        })

        test('generates gradient from black to white', () => {
            const result = generateGradient('#000000', '#ffffff', 3)
            expect(result[0]).toBe('#000000')
            expect(result[1]).toBe('#808080') // Middle gray
            expect(result[2]).toBe('#ffffff')
        })

        test('handles single step', () => {
            // Edge case: dividing by 0 when steps = 1
            const result = generateGradient('#000000', '#ffffff', 1)
            expect(result.length).toBe(1)
        })

        test('handles two steps', () => {
            const result = generateGradient('#ff0000', '#0000ff', 2)
            expect(result.length).toBe(2)
            expect(result[0]).toBe('#ff0000')
            expect(result[1]).toBe('#0000ff')
        })
    })

    describe('applyHeatmapColorScheme', () => {
        test('applies green color scheme CSS variables', () => {
            const mockEl = createMockElement()
            const greenScheme = HEATMAP_PRESETS['green']!

            applyHeatmapColorScheme(mockEl, greenScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-empty')).toBe(greenScheme.empty)
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-0')).toBe(greenScheme.levels[0])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe(greenScheme.levels[1])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-2')).toBe(greenScheme.levels[2])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-3')).toBe(greenScheme.levels[3])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe(greenScheme.levels[4])
        })

        test('applies blue color scheme CSS variables', () => {
            const mockEl = createMockElement()
            const blueScheme = HEATMAP_PRESETS['blue']!

            applyHeatmapColorScheme(mockEl, blueScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-empty')).toBe(blueScheme.empty)
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe(blueScheme.levels[1])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe(blueScheme.levels[4])
        })

        test('applies purple color scheme CSS variables', () => {
            const mockEl = createMockElement()
            const purpleScheme = HEATMAP_PRESETS['purple']!

            applyHeatmapColorScheme(mockEl, purpleScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe(purpleScheme.levels[1])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe(purpleScheme.levels[4])
        })

        test('applies orange color scheme CSS variables', () => {
            const mockEl = createMockElement()
            const orangeScheme = HEATMAP_PRESETS['orange']!

            applyHeatmapColorScheme(mockEl, orangeScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe(orangeScheme.levels[1])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe(orangeScheme.levels[4])
        })

        test('applies red color scheme CSS variables', () => {
            const mockEl = createMockElement()
            const redScheme = HEATMAP_PRESETS['red']!

            applyHeatmapColorScheme(mockEl, redScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe(redScheme.levels[1])
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe(redScheme.levels[4])
        })

        test('different color schemes produce different CSS values', () => {
            const greenEl = createMockElement()
            const blueEl = createMockElement()
            const redEl = createMockElement()

            applyHeatmapColorScheme(greenEl, HEATMAP_PRESETS['green']!)
            applyHeatmapColorScheme(blueEl, HEATMAP_PRESETS['blue']!)
            applyHeatmapColorScheme(redEl, HEATMAP_PRESETS['red']!)

            // Verify different schemes produce different level-4 colors
            const greenLevel4 = greenEl.appliedStyles.get('--lt-heatmap-level-4')
            const blueLevel4 = blueEl.appliedStyles.get('--lt-heatmap-level-4')
            const redLevel4 = redEl.appliedStyles.get('--lt-heatmap-level-4')

            expect(greenLevel4).not.toBe(blueLevel4)
            expect(greenLevel4).not.toBe(redLevel4)
            expect(blueLevel4).not.toBe(redLevel4)
        })

        test('sets all 6 CSS variables', () => {
            const mockEl = createMockElement()
            applyHeatmapColorScheme(mockEl, HEATMAP_PRESETS['green']!)

            expect(mockEl.appliedStyles.size).toBe(6)
        })

        test('handles custom color scheme', () => {
            const mockEl = createMockElement()
            const customScheme: HeatmapColorScheme = {
                kind: 'gradient',
                empty: '#000000',
                levels: ['#111111', '#222222', '#333333', '#444444', '#555555']
            }

            applyHeatmapColorScheme(mockEl, customScheme)

            expect(mockEl.appliedStyles.get('--lt-heatmap-empty')).toBe('#000000')
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-0')).toBe('#111111')
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-1')).toBe('#222222')
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-2')).toBe('#333333')
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-3')).toBe('#444444')
            expect(mockEl.appliedStyles.get('--lt-heatmap-level-4')).toBe('#555555')
        })
    })
})

describe('resolveHeatmapCellColor (issue #82)', () => {
    const discrete: DiscreteHeatmapColorScheme = {
        kind: 'discrete',
        empty: '#eeeeee',
        mapping: { '1': '#0072b2', '3': '#f0e442', '5': '#d55e00' },
        fallback: '#999999'
    }

    test('maps a known value to its color, ignoring min/max', () => {
        expect(resolveHeatmapCellColor(3, discrete, 0, 100)).toBe('#f0e442')
        // Same value, wildly different range: discrete mode does not normalize
        expect(resolveHeatmapCellColor(3, discrete, -50, 4)).toBe('#f0e442')
    })

    test('uses the fallback for a value with no entry', () => {
        expect(resolveHeatmapCellColor(2, discrete, 1, 5)).toBe('#999999')
    })

    test('uses the empty color when no fallback is set', () => {
        const noFallback: DiscreteHeatmapColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2' }
        }
        expect(resolveHeatmapCellColor(2, noFallback, 1, 5)).toBe('#eeeeee')
    })

    test('returns the empty color for null in either mode', () => {
        expect(resolveHeatmapCellColor(null, discrete, 1, 5)).toBe('#eeeeee')
        expect(resolveHeatmapCellColor(null, HEATMAP_PRESETS['green']!, 1, 5)).toBe(
            HEATMAP_PRESETS['green']!.empty
        )
    })

    test('handles negative and fractional keys', () => {
        const scheme: DiscreteHeatmapColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '-1': '#111111', '0.5': '#222222' }
        }
        expect(resolveHeatmapCellColor(-1, scheme, -1, 1)).toBe('#111111')
        expect(resolveHeatmapCellColor(0.5, scheme, -1, 1)).toBe('#222222')
    })

    test('an emptied mapping colors every cell with the empty color', () => {
        // Reachable from the editor: remove every row, then apply
        const scheme: DiscreteHeatmapColorScheme = {
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: {}
        }
        expect(resolveHeatmapCellColor(1, scheme, 1, 5)).toBe('#eeeeee')
    })

    test('gradient mode still delegates to the level logic', () => {
        const green = HEATMAP_PRESETS['green']!
        for (const value of [1, 25, 50, 75, 100]) {
            expect(resolveHeatmapCellColor(value, green, 0, 100)).toBe(
                getHeatmapColor(getColorLevelForValue(value, 0, 100), green)
            )
        }
    })

    test('isDiscreteHeatmapScheme discriminates the union', () => {
        expect(isDiscreteHeatmapScheme(discrete)).toBe(true)
        expect(isDiscreteHeatmapScheme(HEATMAP_PRESETS['green']!)).toBe(false)
    })
})

describe('normalizeHeatmapColorScheme', () => {
    test('returns null for preset names and other non-objects', () => {
        expect(normalizeHeatmapColorScheme('green')).toBeNull()
        expect(normalizeHeatmapColorScheme(undefined)).toBeNull()
        expect(normalizeHeatmapColorScheme(null)).toBeNull()
        expect(normalizeHeatmapColorScheme(42)).toBeNull()
        expect(normalizeHeatmapColorScheme([])).toBeNull()
    })

    test('upgrades a pre-#82 { empty, levels } object to a gradient scheme', () => {
        const legacy = {
            empty: '#000000',
            levels: ['#1', '#2', '#3', '#4', '#5']
        }
        expect(normalizeHeatmapColorScheme(legacy)).toEqual({
            kind: 'gradient',
            empty: '#000000',
            levels: ['#1', '#2', '#3', '#4', '#5']
        })
    })

    test('passes a modern gradient scheme through unchanged', () => {
        const scheme = HEATMAP_PRESETS['viridis']!
        expect(normalizeHeatmapColorScheme(scheme)).toEqual(scheme)
    })

    test('rejects gradients without exactly five string levels', () => {
        expect(normalizeHeatmapColorScheme({ empty: '#000', levels: ['#1', '#2'] })).toBeNull()
        expect(
            normalizeHeatmapColorScheme({ empty: '#000', levels: ['#1', '#2', '#3', '#4', 5] })
        ).toBeNull()
        expect(normalizeHeatmapColorScheme({ empty: '#000' })).toBeNull()
    })

    test('reads a discrete scheme, dropping non-string mapping values', () => {
        const result = normalizeHeatmapColorScheme({
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2', '2': 42, '3': '', '4': '#d55e00' },
            fallback: '#999999'
        })

        expect(result).toEqual({
            kind: 'discrete',
            empty: '#eeeeee',
            mapping: { '1': '#0072b2', '4': '#d55e00' },
            fallback: '#999999'
        })
    })

    test('rejects a discrete scheme with an unusable mapping', () => {
        expect(normalizeHeatmapColorScheme({ kind: 'discrete', mapping: 'nope' })).toBeNull()
        expect(normalizeHeatmapColorScheme({ kind: 'discrete', mapping: [] })).toBeNull()
    })

    test('omits fallback when it is not a string', () => {
        const result = normalizeHeatmapColorScheme({
            kind: 'discrete',
            mapping: { '1': '#0072b2' },
            fallback: 7
        })
        expect(result).not.toBeNull()
        expect(result && 'fallback' in result).toBe(false)
    })
})

describe('colorblind-friendly palettes (issue #136)', () => {
    test('createDefaultDiscreteScheme seeds values 1..5 from the safe ramp', () => {
        const scheme = createDefaultDiscreteScheme()

        expect(scheme.kind).toBe('discrete')
        expect(Object.keys(scheme.mapping)).toEqual(['1', '2', '3', '4', '5'])
        // Every seeded color is distinct, so a 1..5 scale is readable at a glance
        expect(new Set(Object.values(scheme.mapping)).size).toBe(5)
    })

    test('the default ramp avoids the red/green axis most deficiencies collapse', () => {
        const colors = Object.values(createDefaultDiscreteScheme().mapping)
        // Every seeded color comes from the vetted palette
        for (const color of colors) {
            expect(COLORBLIND_SAFE_PALETTE).toContain(color)
        }
    })

    test('nextDiscreteEntryColor walks the palette and wraps around', () => {
        expect(nextDiscreteEntryColor(0)).toBe(COLORBLIND_SAFE_PALETTE[0]!)
        expect(nextDiscreteEntryColor(3)).toBe(COLORBLIND_SAFE_PALETTE[3]!)
        expect(nextDiscreteEntryColor(COLORBLIND_SAFE_PALETTE.length)).toBe(
            COLORBLIND_SAFE_PALETTE[0]!
        )
    })

    test('the colorblind chart scheme exposes the Okabe-Ito palette', () => {
        expect(getChartColorScheme('colorblind')).toEqual([...COLORBLIND_SAFE_PALETTE])
    })

    test('viridis and cividis are offered as heatmap gradients', () => {
        const values = HEATMAP_COLOR_SCHEME_OPTIONS.map((option) => option.value)
        expect(values).toContain('viridis')
        expect(values).toContain('cividis')
        // Every offered option resolves to a real preset
        for (const value of values) {
            expect(HEATMAP_PRESETS[value]).toBeDefined()
        }
    })
})

describe('asChartColorScheme', () => {
    test('accepts known chart scheme names', () => {
        expect(asChartColorScheme('blue')).toBe('blue')
        expect(asChartColorScheme('colorblind')).toBe('colorblind')
    })

    test('rejects heatmap-only names so charts fall back to the default palette', () => {
        expect(asChartColorScheme('viridis')).toBeUndefined()
        expect(asChartColorScheme('cividis')).toBeUndefined()
    })

    test('rejects an inline heatmap scheme object', () => {
        expect(asChartColorScheme(createDefaultDiscreteScheme())).toBeUndefined()
        expect(asChartColorScheme(HEATMAP_PRESETS['green']!)).toBeUndefined()
    })

    test('rejects unknown values', () => {
        expect(asChartColorScheme(undefined)).toBeUndefined()
        expect(asChartColorScheme('chartreuse')).toBeUndefined()
    })
})
