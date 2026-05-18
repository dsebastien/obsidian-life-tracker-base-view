import type { BasesPropertyId } from 'obsidian'

/**
 * Config key under which the per-view manual card order is persisted in the
 * Bases view config. Each Base / Base view has its own config object, so the
 * order is naturally scoped to the view the user reordered.
 */
export const MANUAL_ORDER_KEY = 'manualOrder'

/**
 * A single item in the rendered grid: either a configured/unconfigured
 * property card or an overlay card.
 */
export type OrderedCardItem =
    | { kind: 'property'; id: BasesPropertyId }
    | { kind: 'overlay'; id: string }

/**
 * Serialized form persisted in view config: a flat string[] where each
 * element is `prop:<propertyId>` or `overlay:<overlayId>`. Keeping it as
 * plain strings (instead of objects) keeps the JSON small and forward-
 * compatible if we add more kinds later.
 */
export type SerializedManualOrder = string[]

const PROPERTY_PREFIX = 'prop:'
const OVERLAY_PREFIX = 'overlay:'

export function serializeOrderItem(item: OrderedCardItem): string {
    return item.kind === 'property' ? `${PROPERTY_PREFIX}${item.id}` : `${OVERLAY_PREFIX}${item.id}`
}

export function deserializeOrderItem(serialized: string): OrderedCardItem | null {
    if (serialized.startsWith(PROPERTY_PREFIX)) {
        const id = serialized.slice(PROPERTY_PREFIX.length) as BasesPropertyId
        return { kind: 'property', id }
    }
    if (serialized.startsWith(OVERLAY_PREFIX)) {
        const id = serialized.slice(OVERLAY_PREFIX.length)
        return { kind: 'overlay', id }
    }
    return null
}

export function serializeOrder(order: OrderedCardItem[]): SerializedManualOrder {
    return order.map(serializeOrderItem)
}

export function deserializeOrder(raw: unknown): OrderedCardItem[] {
    if (!Array.isArray(raw)) return []
    const result: OrderedCardItem[] = []
    for (const entry of raw) {
        if (typeof entry !== 'string') continue
        const item = deserializeOrderItem(entry)
        if (item) result.push(item)
    }
    return result
}
