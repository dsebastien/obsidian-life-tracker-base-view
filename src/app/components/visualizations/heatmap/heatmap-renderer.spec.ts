import { describe, expect, test } from 'bun:test'
import { applyCellColor } from './heatmap-renderer'
import { HEATMAP_PRESETS } from '../../../../utils'
import type { DiscreteHeatmapColorScheme } from '../../../types'

interface MockCell extends HTMLElement {
    classes: string[]
    styles: Map<string, string>
}

/**
 * Minimal stand-in for a rendered cell: `applyCellColor` only ever touches
 * `classList.add` and `style.setProperty`.
 */
function createMockCell(): MockCell {
    const classes: string[] = []
    const styles = new Map<string, string>()
    return {
        classes,
        styles,
        classList: {
            add: (cls: string) => {
                classes.push(cls)
            }
        },
        style: {
            setProperty: (name: string, value: string) => {
                styles.set(name, value)
            }
        }
    } as unknown as MockCell
}

const discrete: DiscreteHeatmapColorScheme = {
    kind: 'discrete',
    empty: '#eeeeee',
    mapping: { '1': '#0072b2', '3': '#f0e442', '5': '#d55e00' },
    fallback: '#999999'
}

describe('applyCellColor (issue #82)', () => {
    test('gradient schemes add a level class and set no inline color', () => {
        const cell = createMockCell()
        applyCellColor(cell, 100, HEATMAP_PRESETS['green']!, 0, 100)

        expect(cell.classes).toEqual(['lt-heatmap-cell--level-4'])
        expect(cell.styles.size).toBe(0)
    })

    test('gradient schemes map an empty cell to level 0', () => {
        const cell = createMockCell()
        applyCellColor(cell, null, HEATMAP_PRESETS['green']!, 0, 100)

        expect(cell.classes).toEqual(['lt-heatmap-cell--level-0'])
    })

    test('discrete schemes set an inline background and add no level class', () => {
        const cell = createMockCell()
        applyCellColor(cell, 3, discrete, 1, 5)

        expect(cell.classes).toEqual([])
        expect(cell.styles.get('background-color')).toBe('#f0e442')
    })

    test('discrete schemes use the fallback for unmapped values', () => {
        const cell = createMockCell()
        applyCellColor(cell, 4, discrete, 1, 5)

        expect(cell.styles.get('background-color')).toBe('#999999')
    })

    test('discrete schemes use the empty color for cells without data', () => {
        const cell = createMockCell()
        applyCellColor(cell, null, discrete, 1, 5)

        expect(cell.styles.get('background-color')).toBe('#eeeeee')
    })

    test('discrete colors do not depend on the surrounding range', () => {
        const narrow = createMockCell()
        const wide = createMockCell()

        applyCellColor(narrow, 5, discrete, 5, 5)
        applyCellColor(wide, 5, discrete, -100, 1000)

        expect(narrow.styles.get('background-color')).toBe('#d55e00')
        expect(wide.styles.get('background-color')).toBe('#d55e00')
    })
})
