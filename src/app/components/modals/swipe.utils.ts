/**
 * Swipe gesture recognition for the capture modal's property carousel
 * (issue #140).
 *
 * A gesture counts as a swipe when it travels far enough horizontally, stays
 * mostly horizontal (so vertical scrolling never navigates), and completes
 * quickly enough to read as a flick rather than a slow drag.
 */

export const SWIPE_MIN_DISTANCE_PX = 60
export const SWIPE_MAX_DURATION_MS = 800
/** Horizontal travel must exceed vertical travel by this factor. */
export const SWIPE_DIRECTION_RATIO = 1.5

/**
 * Direction a gesture navigates: `forward` for a swipe left (next property),
 * `backward` for a swipe right, `null` when the gesture is not a swipe.
 */
export type SwipeDirection = 'forward' | 'backward' | null

export function detectSwipeDirection(
    deltaX: number,
    deltaY: number,
    elapsedMs: number
): SwipeDirection {
    if (elapsedMs > SWIPE_MAX_DURATION_MS) return null
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE_PX) return null
    if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) return null

    return deltaX < 0 ? 'forward' : 'backward'
}
