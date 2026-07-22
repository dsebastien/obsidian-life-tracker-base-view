import type { NumberRange } from '../types'

/**
 * Result of applying a single-bound edit to a property's number range.
 * `inferred` is set when only one bound was provided and the other was derived,
 * so the caller can surface that to the user.
 */
export interface NumberRangeUpdate {
    range: NumberRange | null
    inferred: { bound: 'Min' | 'Max'; value: number } | null
}

/**
 * Compute the new number range after editing one bound.
 *
 * - both bounds present -> use them as-is
 * - only min -> infer `max = min + 100`
 * - only max -> infer `min = 0`
 * - neither -> `null` (no constraint)
 *
 * An existing `step` is preserved. Pure function so it can be unit-tested apart
 * from the settings UI / immer plumbing.
 */
export function computeNumberRange(
    changed: 'min' | 'max',
    entered: number | null,
    existing: NumberRange | null
): NumberRangeUpdate {
    const step = existing?.step
    const stepPart = step != null ? { step } : {}
    const min = changed === 'min' ? entered : (existing?.min ?? null)
    const max = changed === 'max' ? entered : (existing?.max ?? null)

    if (min !== null && max !== null) {
        return { range: { min, max, ...stepPart }, inferred: null }
    }
    if (min !== null) {
        const inferredMax = min + 100
        return {
            range: { min, max: inferredMax, ...stepPart },
            inferred: { bound: 'Max', value: inferredMax }
        }
    }
    if (max !== null) {
        return { range: { min: 0, max, ...stepPart }, inferred: { bound: 'Min', value: 0 } }
    }
    return { range: null, inferred: null }
}
