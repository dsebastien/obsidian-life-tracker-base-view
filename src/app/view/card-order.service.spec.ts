import { test, expect, describe } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    computeEffectiveOrder,
    orderSignature,
    readManualOrder,
    writeManualOrder
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
