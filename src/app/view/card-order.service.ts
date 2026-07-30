import type { BasesPropertyId } from 'obsidian'
import {
    deserializeOrder,
    serializeOrder,
    serializeOrderItem,
    type OrderedCardItem,
    type SerializedManualOrder
} from './card-order.types'

/**
 * Pure logic for reconciling a user-defined manual card order with the
 * properties and overlays that currently exist in the view.
 *
 * Rules (matches the behavior described in the business rules doc):
 * - If no manual order is stored, return the natural order:
 *   properties from `BasesViewConfig.getOrder()` first (Obsidian-defined),
 *   followed by overlays in their stored order.
 * - If a manual order exists:
 *   1. Drop entries from the manual order whose target no longer exists.
 *   2. Append any items not yet in the manual order at the end, in their
 *      natural order. This means newly added properties/overlays are
 *      discoverable (they show up) without forcing the user to redo the
 *      whole ordering.
 * - Pinned cards are hoisted to the front afterwards (issue #123), keeping
 *   their relative order, so they stay visible whatever the order underneath.
 */

export interface CardOrderInputs {
    propertyIds: BasesPropertyId[]
    overlayIds: string[]
    manualOrder: OrderedCardItem[] | null
    /** Cards pinned to the top of the grid (issue #123) */
    pinnedCards?: OrderedCardItem[]
}

export function computeEffectiveOrder(inputs: CardOrderInputs): OrderedCardItem[] {
    const { propertyIds, overlayIds, manualOrder, pinnedCards } = inputs

    const naturalOrder: OrderedCardItem[] = [
        ...propertyIds.map<OrderedCardItem>((id) => ({ kind: 'property', id })),
        ...overlayIds.map<OrderedCardItem>((id) => ({ kind: 'overlay', id }))
    ]

    if (!manualOrder || manualOrder.length === 0) {
        return applyPins(naturalOrder, pinnedCards)
    }

    const validPropertyIds = new Set<string>(propertyIds)
    const validOverlayIds = new Set<string>(overlayIds)
    const seen = new Set<string>()
    const result: OrderedCardItem[] = []

    for (const item of manualOrder) {
        const exists =
            item.kind === 'property' ? validPropertyIds.has(item.id) : validOverlayIds.has(item.id)
        if (!exists) continue
        const key = serializeOrderItem(item)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(item)
    }

    for (const item of naturalOrder) {
        const key = serializeOrderItem(item)
        if (seen.has(key)) continue
        seen.add(key)
        result.push(item)
    }

    return applyPins(result, pinnedCards)
}

/**
 * Move pinned cards to the front, preserving their relative order within the
 * given order. Pins for cards that no longer exist are ignored.
 */
function applyPins(
    order: OrderedCardItem[],
    pinnedCards: OrderedCardItem[] | undefined
): OrderedCardItem[] {
    if (!pinnedCards || pinnedCards.length === 0) {
        return order
    }

    const pinnedKeys = new Set(pinnedCards.map(serializeOrderItem))
    const pinned: OrderedCardItem[] = []
    const rest: OrderedCardItem[] = []

    for (const item of order) {
        if (pinnedKeys.has(serializeOrderItem(item))) {
            pinned.push(item)
        } else {
            rest.push(item)
        }
    }

    return [...pinned, ...rest]
}

/**
 * Whether a card is pinned
 */
export function isCardPinned(pinnedCards: OrderedCardItem[], item: OrderedCardItem): boolean {
    const key = serializeOrderItem(item)
    return pinnedCards.some((pinned) => serializeOrderItem(pinned) === key)
}

/**
 * Toggle a card's pinned state, returning the new pinned list
 */
export function togglePinnedCard(
    pinnedCards: OrderedCardItem[],
    item: OrderedCardItem
): OrderedCardItem[] {
    const key = serializeOrderItem(item)
    if (pinnedCards.some((pinned) => serializeOrderItem(pinned) === key)) {
        return pinnedCards.filter((pinned) => serializeOrderItem(pinned) !== key)
    }
    return [...pinnedCards, item]
}

/**
 * Read the persisted pinned cards (empty array when none are stored)
 */
export function readPinnedCards(raw: unknown): OrderedCardItem[] {
    return deserializeOrder(raw)
}

/**
 * Serialize the pinned cards for persistence
 */
export function writePinnedCards(pinnedCards: OrderedCardItem[]): SerializedManualOrder {
    return serializeOrder(pinnedCards)
}

/**
 * Stable string signature of an order, used for quick equality checks
 * (e.g., to decide whether the DOM needs reordering on the next render).
 */
export function orderSignature(order: OrderedCardItem[]): string {
    return serializeOrder(order).join('|')
}

export function readManualOrder(raw: unknown): OrderedCardItem[] | null {
    if (raw === undefined || raw === null) return null
    const parsed = deserializeOrder(raw)
    return parsed.length > 0 ? parsed : null
}

export function writeManualOrder(order: OrderedCardItem[]): SerializedManualOrder {
    return serializeOrder(order)
}
