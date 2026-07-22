import type { BatchFilterMode, PropertyDefinition } from '../types'

/**
 * A property value counts as "filled" when it is not undefined, null, or an
 * empty string. (Lists/objects are considered filled when present.)
 */
function isFilled(value: unknown): boolean {
    return value !== undefined && value !== null && value !== ''
}

/**
 * Determine whether a note counts as "complete" under a hide/skip filter mode.
 * Shared by the grid view (which hides complete notes) and the capture modal
 * (which skips complete notes when navigating).
 *
 * - `never`: never complete (nothing is hidden/skipped)
 * - `required`: complete when every required definition has a value
 * - `all`: complete when every definition has a value
 *
 * Returns `false` when there are no relevant definitions, so notes with nothing
 * to fill are never treated as complete.
 */
export function isNoteComplete(
    mode: BatchFilterMode,
    definitions: PropertyDefinition[],
    getValue: (name: string) => unknown
): boolean {
    if (mode === 'never') return false

    const relevant = mode === 'required' ? definitions.filter((def) => def.required) : definitions
    if (relevant.length === 0) return false

    return relevant.every((def) => isFilled(getValue(def.name)))
}

/**
 * Index of the first property worth landing on in the capture carousel: the first
 * unfilled *required* property, else the first unfilled property of any kind, else
 * `0` when everything is already filled (so the carousel still opens at the start).
 */
export function findFirstUnfilledIndex(
    definitions: readonly PropertyDefinition[],
    isNameFilled: (name: string) => boolean
): number {
    const firstUnfilledRequired = definitions.findIndex(
        (def) => def.required && !isNameFilled(def.name)
    )
    if (firstUnfilledRequired !== -1) return firstUnfilledRequired

    const firstUnfilled = definitions.findIndex((def) => !isNameFilled(def.name))
    return firstUnfilled === -1 ? 0 : firstUnfilled
}
