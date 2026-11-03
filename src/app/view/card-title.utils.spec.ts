import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { resolveCardTitle } from './card-title.utils'

const id = 'note.distance_kilometers' as BasesPropertyId

describe('resolveCardTitle (3.4.0)', () => {
    test('a configured name wins', () => {
        expect(resolveCardTitle('Run days', 'Distance (km)', id)).toBe('Run days')
        expect(resolveCardTitle('  Distance per run (km)  ', 'Distance (km)', id)).toBe(
            'Distance per run (km)'
        )
    })

    test('an empty or missing name falls back to the property display name', () => {
        expect(resolveCardTitle(undefined, 'Distance (km)', id)).toBe('Distance (km)')
        expect(resolveCardTitle('', 'Distance (km)', id)).toBe('Distance (km)')
        expect(resolveCardTitle('   ', 'Distance (km)', id)).toBe('Distance (km)')
    })

    test('the raw property name gives way to the display name', () => {
        expect(resolveCardTitle('distance_kilometers', 'Distance (km)', id)).toBe('Distance (km)')
        expect(resolveCardTitle('note.distance_kilometers', 'Distance (km)', id)).toBe(
            'Distance (km)'
        )
        expect(resolveCardTitle('Distance_Kilometers', 'Distance (km)', id)).toBe('Distance (km)')
    })

    test('the cached display name itself reads the same', () => {
        expect(resolveCardTitle('Distance (km)', 'Distance (km)', id)).toBe('Distance (km)')
    })

    test('formula and file properties', () => {
        const formula = 'formula.weekly_average' as BasesPropertyId
        expect(resolveCardTitle('weekly_average', 'Weekly average', formula)).toBe('Weekly average')
        expect(resolveCardTitle('7-day mean', 'Weekly average', formula)).toBe('7-day mean')
    })
})
