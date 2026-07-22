import type { BasesPropertyId } from 'obsidian'

/**
 * Overlays are independent visualizations identified by their own UUID rather
 * than a Base property. To flow through the shared card / maximize / visualization
 * plumbing — which is keyed by `BasesPropertyId` — an overlay id deliberately
 * occupies the property-id slot.
 *
 * This wrapper centralizes and documents that intentional reuse so the brand is
 * bent in exactly one place, explicitly, instead of via scattered
 * `as BasesPropertyId` casts on raw UUID strings.
 *
 * See Business Rules → "Overlay charts": overlays use their overlay ID as the
 * `data-property-id`, allowing them to be maximized independently.
 */
export function overlayIdToPropertyId(overlayId: string): BasesPropertyId {
    return overlayId as BasesPropertyId
}
