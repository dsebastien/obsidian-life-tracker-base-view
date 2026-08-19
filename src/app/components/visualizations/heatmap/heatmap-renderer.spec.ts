import { describe, expect, test } from 'bun:test'
import { applyCellColor, planMonthLabelWeeks, MIN_MONTH_LABEL_SPACING_PX } from './heatmap-renderer'
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

describe('planMonthLabelWeeks (issue #157)', () => {
    /** Build consecutive week-start dates from a starting day. */
    function buildWeeks(start: string, count: number): Date[] {
        const first = new Date(start)
        return Array.from(
            { length: count },
            (_, i) => new Date(first.getTime() + i * 7 * 24 * 60 * 60 * 1000)
        )
    }

    test('labels the first week of each month when there is room', () => {
        // 11px cells + 2px gap = 13px/slot; months are 4-5 weeks apart
        // (52-65px), well above the minimum spacing
        const weeks = buildWeeks('2026-01-05', 18) // Jan → Apr
        const labeled = planMonthLabelWeeks(weeks, 11, 2)

        expect(labeled.size).toBe(5) // Jan, Feb, Mar, Apr, May — one per month
        expect(labeled.has(0)).toBe(true)
    })

    test('skips a label that would collide with the previous one', () => {
        // Tiny cells: 4px + 1px gap = 5px/slot. A month change 4 weeks after
        // the previous label has only 20px of room — below the minimum
        const weeks = buildWeeks('2026-06-29', 10) // Jun w/ Jul immediately after
        const labeled = planMonthLabelWeeks(weeks, 4, 1)

        expect(labeled.has(0)).toBe(true) // Jun labeled
        expect(labeled.has(1)).toBe(false) // Jul suppressed: 1 slot = 5px of room
    })

    test('a skipped month stays unlabeled instead of being labeled mid-month', () => {
        const weeks = buildWeeks('2026-06-29', 12) // Jun, Jul from week 1, Aug later
        const labeled = planMonthLabelWeeks(weeks, 4, 1)

        // Jul is skipped entirely; the next label is Aug's first week (week 5:
        // 2026-08-03), which has 5 slots = 25px... still below 32px, so also
        // skipped; Sep (week 10, 2026-09-07) has 50px from week 0 and renders
        expect([...labeled]).toEqual([0, 10])
    })

    test('the first month is always labeled', () => {
        const weeks = buildWeeks('2026-03-02', 3)
        const labeled = planMonthLabelWeeks(weeks, 1, 0)
        expect(labeled.has(0)).toBe(true)
    })

    test('normal GitHub-sized cells never suppress monthly labels', () => {
        // Default 11px cells with 2px gap: 4 weeks = 52px >= minimum
        expect(4 * (11 + 2)).toBeGreaterThanOrEqual(MIN_MONTH_LABEL_SPACING_PX)
    })
})
