import { describe, expect, test } from 'bun:test'
import { normalizeCardTitle, resolveCardTitle } from './card-title.utils'

describe('resolveCardTitle (3.4.0)', () => {
    test('a card title wins', () => {
        expect(resolveCardTitle('Run days', 'Distance (km)')).toBe('Run days')
        expect(resolveCardTitle('  Distance per run (km)  ', 'Distance (km)')).toBe(
            'Distance per run (km)'
        )
    })

    test('no title shows the current property display name', () => {
        expect(resolveCardTitle(undefined, 'Distance (km)')).toBe('Distance (km)')
        expect(resolveCardTitle('', 'Distance (km)')).toBe('Distance (km)')
        expect(resolveCardTitle('   ', 'Distance (km)')).toBe('Distance (km)')
    })

    test('a hand-edited non-string title is ignored', () => {
        expect(resolveCardTitle(42, 'Distance (km)')).toBe('Distance (km)')
        expect(resolveCardTitle(null, 'Distance (km)')).toBe('Distance (km)')
    })
})

describe('normalizeCardTitle', () => {
    test('trims what was typed', () => {
        expect(normalizeCardTitle('  Run days ')).toBe('Run days')
    })

    test('an empty field clears the title', () => {
        expect(normalizeCardTitle('')).toBeUndefined()
        expect(normalizeCardTitle('   ')).toBeUndefined()
    })
})
