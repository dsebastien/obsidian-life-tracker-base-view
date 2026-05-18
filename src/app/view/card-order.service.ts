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
 */

export interface CardOrderInputs {
    propertyIds: BasesPropertyId[]
    overlayIds: string[]
    manualOrder: OrderedCardItem[] | null
}

export function computeEffectiveOrder(inputs: CardOrderInputs): OrderedCardItem[] {
    const { propertyIds, overlayIds, manualOrder } = inputs

    const naturalOrder: OrderedCardItem[] = [
        ...propertyIds.map<OrderedCardItem>((id) => ({ kind: 'property', id })),
        ...overlayIds.map<OrderedCardItem>((id) => ({ kind: 'overlay', id }))
    ]

    if (!manualOrder || manualOrder.length === 0) {
        return naturalOrder
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

    return result
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
