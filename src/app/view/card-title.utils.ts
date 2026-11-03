/**
 * Title of a configured card (3.4.0).
 *
 * A card shows its own `title` when it has one, so several cards on one
 * property ("Run days", "Distance per run (km)") stay distinguishable; the
 * property's current display name otherwise, as before.
 *
 * `displayName` is deliberately not used: it is written automatically when a
 * card is configured, so every existing card carries one, and showing it would
 * freeze each card on the name its property had back then.
 *
 * `title` comes from a hand-editable `.base` file: anything but a non-empty
 * string reads as absent.
 */
export function resolveCardTitle(title: unknown, propertyDisplayName: string): string {
    const custom = typeof title === 'string' ? title.trim() : ''
    return custom === '' ? propertyDisplayName : custom
}

/**
 * The `title` to store for what the user typed: trimmed, and absent when
 * empty so clearing the field hands the card back to the property name.
 */
export function normalizeCardTitle(input: string): string | undefined {
    const trimmed = input.trim()
    return trimmed === '' ? undefined : trimmed
}
