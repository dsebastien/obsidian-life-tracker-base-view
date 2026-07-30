import { describe, expect, test } from 'bun:test'
import { detectSwipeDirection, SWIPE_MAX_DURATION_MS, SWIPE_MIN_DISTANCE_PX } from './swipe.utils'

describe('detectSwipeDirection (issue #140)', () => {
    test('a quick leftward flick navigates forward', () => {
        expect(detectSwipeDirection(-120, 5, 200)).toBe('forward')
    })

    test('a quick rightward flick navigates backward', () => {
        expect(detectSwipeDirection(120, -5, 200)).toBe('backward')
    })

    test('ignores gestures shorter than the distance threshold', () => {
        expect(detectSwipeDirection(-(SWIPE_MIN_DISTANCE_PX - 1), 0, 200)).toBeNull()
        expect(detectSwipeDirection(0, 0, 200)).toBeNull()
    })

    test('accepts a gesture exactly at the distance threshold', () => {
        expect(detectSwipeDirection(SWIPE_MIN_DISTANCE_PX, 0, 200)).toBe('backward')
    })

    test('ignores slow drags', () => {
        expect(detectSwipeDirection(-200, 0, SWIPE_MAX_DURATION_MS + 1)).toBeNull()
    })

    test('ignores mostly vertical gestures (scrolling)', () => {
        expect(detectSwipeDirection(-80, 200, 200)).toBeNull()
        // Diagonal but still dominated by horizontal travel
        expect(detectSwipeDirection(-200, 80, 200)).toBe('forward')
    })

    test('requires horizontal travel to beat vertical by the ratio', () => {
        // 90 horizontal vs 60 vertical = exactly 1.5x, which qualifies
        expect(detectSwipeDirection(-90, 60, 200)).toBe('forward')
        // 89 horizontal vs 60 vertical falls just short
        expect(detectSwipeDirection(-89, 60, 200)).toBeNull()
    })
})
