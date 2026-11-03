import type { BasesPropertyId } from 'obsidian'

/**
 * Title of a configured card (3.4.0).
 *
 * A card shows its own `displayName` when it has one, so several cards on one
 * property ("Run days", "Distance per run (km)") stay distinguishable. The
 * property's display name is used otherwise, as before.
 *
 * `displayName` is also written automatically when a card is configured (the
 * property's display name at that moment). A value that is just the raw
 * property name (`distance_kilometers`, `note.distance_kilometers`) carries no
 * intent, so it gives way to the current display name: a display name set in
 * the Base later still shows up on those cards.
 */
export function resolveCardTitle(
    configuredName: string | undefined,
    propertyDisplayName: string,
    propertyId: BasesPropertyId
): string {
    const custom = configuredName?.trim() ?? ''
    if (custom === '') return propertyDisplayName

    const rawName = propertyId.slice(propertyId.indexOf('.') + 1)
    const lowered = custom.toLowerCase()
    if (lowered === propertyId.toLowerCase() || lowered === rawName.toLowerCase()) {
        return propertyDisplayName
    }

    return custom
}
