import { describe, expect, test } from 'bun:test'
import {
    DEFAULT_HEATMAP_COLORS,
    DARK_HEATMAP_COLORS,
    HEATMAP_PRESETS,
    getHeatmapColor,
    getColorLevelForValue,
    DEFAULT_CHART_COLORS,
    CHART_COLORS_HEX,
    getChartColor,
    getColorWithAlpha,
    generateGradient
} from './color-utils'

describe('color-utils', () => {
    describe('DEFAULT_HEATMAP_COLORS', () => {
        test('has empty color', () => {
            expect(DEFAULT_HEATMAP_COLORS.empty).toBe('var(--background-modifier-border)')
        })

        test('has 5 level colors', () => {
            expect(DEFAULT_HEATMAP_COLORS.levels.length).toBe(5)
        })
    })

    describe('DARK_HEATMAP_COLORS', () => {
        test('has empty color', () => {
            expect(DARK_HEATMAP_COLORS.empty).toBe('var(--background-modifier-border)')
        })

        test('has 5 level colors', () => {
            expect(DARK_HEATMAP_COLORS.levels.length).toBe(5)
        })
    })

    describe('HEATMAP_PRESETS', () => {
        test('includes green preset', () => {
            expect(HEATMAP_PRESETS['green']).toBeDefined()
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
        test('returns empty color for level 0', () => {
            expect(getHeatmapColor(0, DEFAULT_HEATMAP_COLORS)).toBe(DEFAULT_HEATMAP_COLORS.empty)
        })

        test('returns correct color for level 1', () => {
            expect(getHeatmapColor(1, DEFAULT_HEATMAP_COLORS)).toBe(
                DEFAULT_HEATMAP_COLORS.levels[1]
            )
        })

        test('returns correct color for level 2', () => {
            expect(getHeatmapColor(2, DEFAULT_HEATMAP_COLORS)).toBe(
                DEFAULT_HEATMAP_COLORS.levels[2]
            )
        })

        test('returns correct color for level 3', () => {
            expect(getHeatmapColor(3, DEFAULT_HEATMAP_COLORS)).toBe(
                DEFAULT_HEATMAP_COLORS.levels[3]
            )
        })

        test('returns correct color for level 4', () => {
            expect(getHeatmapColor(4, DEFAULT_HEATMAP_COLORS)).toBe(
                DEFAULT_HEATMAP_COLORS.levels[4]
            )
        })
    })

    describe('getColorLevelForValue', () => {
        test('returns 0 for null value', () => {
            expect(getColorLevelForValue(null, 0, 100)).toBe(0)
        })

        test('returns 0 for value at min', () => {
            expect(getColorLevelForValue(0, 0, 100)).toBe(0)
        })

        test('returns 1 for values <= 25%', () => {
            expect(getColorLevelForValue(25, 0, 100)).toBe(1)
            expect(getColorLevelForValue(10, 0, 100)).toBe(1)
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

        test('handles equal min and max with positive value', () => {
            expect(getColorLevelForValue(50, 50, 50)).toBe(4)
        })

        test('handles equal min and max with zero value', () => {
            expect(getColorLevelForValue(0, 0, 0)).toBe(0)
        })

        test('handles negative ranges', () => {
            expect(getColorLevelForValue(0, -100, 100)).toBe(2)
            expect(getColorLevelForValue(-100, -100, 100)).toBe(0)
            expect(getColorLevelForValue(100, -100, 100)).toBe(4)
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
})
