import { test, expect, describe } from 'bun:test'
import { isNoteComplete, findFirstUnfilledIndex } from './note-completion.utils'
import { createDefaultPropertyDefinition } from '../types'
import type { PropertyDefinition } from '../types'

function def(name: string, required = false): PropertyDefinition {
    return { ...createDefaultPropertyDefinition(name, 0), name, required }
}

describe('isNoteComplete', () => {
    const defs = [def('a', true), def('b', false)]

    test('never mode is never complete', () => {
        expect(isNoteComplete('never', defs, () => undefined)).toBe(false)
    })

    test('required mode: complete when required props filled', () => {
        expect(isNoteComplete('required', defs, (n) => (n === 'a' ? 1 : undefined))).toBe(true)
        expect(isNoteComplete('required', defs, () => undefined)).toBe(false)
    })

    test('all mode: complete only when every prop filled', () => {
        expect(isNoteComplete('all', defs, (n) => (n === 'a' ? 1 : undefined))).toBe(false)
        expect(isNoteComplete('all', defs, () => 1)).toBe(true)
    })

    test('empty string / null count as unfilled', () => {
        expect(isNoteComplete('all', defs, () => '')).toBe(false)
        expect(isNoteComplete('all', defs, () => null)).toBe(false)
    })

    test('no relevant definitions is not complete', () => {
        expect(isNoteComplete('required', [def('a', false)], () => undefined)).toBe(false)
    })
})

describe('findFirstUnfilledIndex', () => {
    const defs = [def('a', false), def('b', true), def('c', true), def('d', false)]

    test('prefers the first unfilled required property', () => {
        // a filled, b (required) unfilled -> index 1
        expect(findFirstUnfilledIndex(defs, (n) => n === 'a')).toBe(1)
    })

    test('skips filled required, lands on next unfilled required', () => {
        // a, b filled; c (required) unfilled -> index 2
        expect(findFirstUnfilledIndex(defs, (n) => n === 'a' || n === 'b')).toBe(2)
    })

    test('falls back to first unfilled non-required when no required left', () => {
        // all required filled, a filled, d unfilled -> index 3
        expect(findFirstUnfilledIndex(defs, (n) => n !== 'd')).toBe(3)
    })

    test('returns 0 when everything is filled', () => {
        expect(findFirstUnfilledIndex(defs, () => true)).toBe(0)
    })

    test('returns 0 for empty definition list', () => {
        expect(findFirstUnfilledIndex([], () => false)).toBe(0)
    })
})
