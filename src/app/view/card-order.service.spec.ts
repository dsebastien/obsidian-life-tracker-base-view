import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    computeEffectiveOrder,
    isCardPinned,
    orderSignature,
    readManualOrder,
    readPinnedCards,
    togglePinnedCard,
    writeManualOrder,
    writePinnedCards
} from './card-order.service'
import type { OrderedCardItem } from './card-order.types'

const prop = (id: string): OrderedCardItem => ({
    kind: 'property',
    id: id as BasesPropertyId
})
const overlay = (id: string): OrderedCardItem => ({ kind: 'overlay', id })

describe('computeEffectiveOrder', () => {
    test('returns natural order (properties then overlays) when no manual order set', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy'] as BasesPropertyId[],
            overlayIds: ['o1', 'o2'],
            manualOrder: null
        })

        expect(result).toEqual([
            prop('note.sleep'),
            prop('note.energy'),
            overlay('o1'),
            overlay('o2')
        ])
    })

    test('returns natural order when manual order is empty', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep'] as BasesPropertyId[],
            overlayIds: ['o1'],
            manualOrder: []
        })

        expect(result).toEqual([prop('note.sleep'), overlay('o1')])
    })

    test('respects manual order when all items still exist', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy'] as BasesPropertyId[],
            overlayIds: ['o1'],
            manualOrder: [overlay('o1'), prop('note.energy'), prop('note.sleep')]
        })

        expect(result).toEqual([overlay('o1'), prop('note.energy'), prop('note.sleep')])
    })

    test('drops manual entries whose target no longer exists', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep'] as BasesPropertyId[],
            overlayIds: ['o1'],
            manualOrder: [
                prop('note.removed'),
                overlay('o-removed'),
                overlay('o1'),
                prop('note.sleep')
            ]
        })

        expect(result).toEqual([overlay('o1'), prop('note.sleep')])
    })

    test('appends new properties/overlays at the end in natural order', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy', 'note.mood'] as BasesPropertyId[],
            overlayIds: ['o1', 'o2'],
            // manual order only references one property and one overlay
            manualOrder: [overlay('o1'), prop('note.energy')]
        })

        expect(result).toEqual([
            overlay('o1'),
            prop('note.energy'),
            prop('note.sleep'),
            prop('note.mood'),
            overlay('o2')
        ])
    })

    test('deduplicates duplicate entries in manual order', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep'] as BasesPropertyId[],
            overlayIds: ['o1'],
            manualOrder: [prop('note.sleep'), prop('note.sleep'), overlay('o1'), overlay('o1')]
        })

        expect(result).toEqual([prop('note.sleep'), overlay('o1')])
    })
})

describe('orderSignature', () => {
    test('produces identical signatures for equal orders', () => {
        const a = orderSignature([prop('note.sleep'), overlay('o1')])
        const b = orderSignature([prop('note.sleep'), overlay('o1')])
        expect(a).toBe(b)
    })

    test('produces different signatures when order changes', () => {
        const a = orderSignature([prop('note.sleep'), overlay('o1')])
        const b = orderSignature([overlay('o1'), prop('note.sleep')])
        expect(a).not.toBe(b)
    })
})

describe('readManualOrder / writeManualOrder roundtrip', () => {
    test('roundtrips a non-empty order', () => {
        const original = [overlay('o1'), prop('note.energy'), prop('note.sleep')]
        const serialized = writeManualOrder(original)
        const parsed = readManualOrder(serialized)
        expect(parsed).toEqual(original)
    })

    test('returns null for undefined or null raw', () => {
        expect(readManualOrder(undefined)).toBeNull()
        expect(readManualOrder(null)).toBeNull()
    })

    test('returns null for empty array', () => {
        expect(readManualOrder([])).toBeNull()
    })

    test('ignores garbage entries', () => {
        const parsed = readManualOrder(['prop:note.sleep', 42, 'bogus', 'overlay:o1', null])
        expect(parsed).toEqual([prop('note.sleep'), overlay('o1')])
    })
})

describe('pinned cards (issue #123)', () => {
    test('hoists pinned cards to the front of the natural order', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy', 'note.mood'] as BasesPropertyId[],
            overlayIds: ['o1'],
            manualOrder: null,
            pinnedCards: [prop('note.mood'), overlay('o1')]
        })

        expect(result).toEqual([
            prop('note.mood'),
            overlay('o1'),
            prop('note.sleep'),
            prop('note.energy')
        ])
    })

    test('hoists pinned cards above a manual order', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy', 'note.mood'] as BasesPropertyId[],
            overlayIds: [],
            manualOrder: [prop('note.energy'), prop('note.sleep'), prop('note.mood')],
            pinnedCards: [prop('note.mood')]
        })

        expect(result).toEqual([prop('note.mood'), prop('note.energy'), prop('note.sleep')])
    })

    test('keeps the relative order of several pinned cards', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.a', 'note.b', 'note.c'] as BasesPropertyId[],
            overlayIds: [],
            manualOrder: null,
            // Pin order does not matter: their order in the grid wins
            pinnedCards: [prop('note.c'), prop('note.a')]
        })

        expect(result).toEqual([prop('note.a'), prop('note.c'), prop('note.b')])
    })

    test('ignores pins for cards that no longer exist', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep'] as BasesPropertyId[],
            overlayIds: [],
            manualOrder: null,
            pinnedCards: [prop('note.gone'), overlay('o-gone')]
        })

        expect(result).toEqual([prop('note.sleep')])
    })

    test('leaves the order untouched when nothing is pinned', () => {
        const result = computeEffectiveOrder({
            propertyIds: ['note.sleep', 'note.energy'] as BasesPropertyId[],
            overlayIds: [],
            manualOrder: null,
            pinnedCards: []
        })

        expect(result).toEqual([prop('note.sleep'), prop('note.energy')])
    })

    test('isCardPinned matches by kind and id', () => {
        const pinned = [prop('note.sleep'), overlay('o1')]
        expect(isCardPinned(pinned, prop('note.sleep'))).toBe(true)
        expect(isCardPinned(pinned, overlay('o1'))).toBe(true)
        expect(isCardPinned(pinned, prop('o1'))).toBe(false)
        expect(isCardPinned(pinned, prop('note.energy'))).toBe(false)
        expect(isCardPinned([], prop('note.sleep'))).toBe(false)
    })

    test('togglePinnedCard adds then removes a card', () => {
        const added = togglePinnedCard([], prop('note.sleep'))
        expect(added).toEqual([prop('note.sleep')])

        const removed = togglePinnedCard(added, prop('note.sleep'))
        expect(removed).toEqual([])
    })

    test('togglePinnedCard leaves other pins alone', () => {
        const result = togglePinnedCard([prop('note.sleep'), overlay('o1')], overlay('o1'))
        expect(result).toEqual([prop('note.sleep')])
    })

    test('readPinnedCards / writePinnedCards roundtrip, empty for missing config', () => {
        const original = [prop('note.sleep'), overlay('o1')]
        expect(readPinnedCards(writePinnedCards(original))).toEqual(original)
        expect(readPinnedCards(undefined)).toEqual([])
        expect(readPinnedCards(null)).toEqual([])
        expect(readPinnedCards('nonsense')).toEqual([])
    })
})
