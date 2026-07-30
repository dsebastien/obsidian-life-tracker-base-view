import type { NumberRange } from '../../types'
import { clampToRange } from '../../../utils'

/**
 * Fallback step for the −/+ quick buttons when the property defines no step
 * (counter-style properties: glasses of water, pushups — issue #125).
 */
export const DEFAULT_NUMBER_STEP = 1

/** Round away binary-float noise from repeated fractional steps (0.1 + 0.2). */
function roundStep(value: number): number {
    return Math.round(value * 1e6) / 1e6
}

/**
 * Step size the −/+ buttons apply: the property's own step when it defines a
 * positive one, otherwise 1.
 */
export function stepSizeFor(range: NumberRange | null): number {
    return range?.step != null && range.step > 0 ? range.step : DEFAULT_NUMBER_STEP
}

/**
 * Value one step away from `current`, clamped to the property's range.
 *
 * From an empty field (`current === null`) the first tap lands on the range
 * minimum when the property is bounded — so a 1-5 mood becomes 1, not 2 — and
 * on the step size for unbounded counters, except that a decrement from empty
 * stops at 0 rather than going negative.
 */
export function computeSteppedValue(
    current: number | null,
    direction: -1 | 1,
    range: NumberRange | null
): number {
    const stepSize = stepSizeFor(range)

    let next: number
    if (current === null) {
        next = range ? range.min : direction === 1 ? stepSize : 0
    } else {
        next = roundStep(current + direction * stepSize)
    }

    return clampToRange(next, range) ?? next
}
