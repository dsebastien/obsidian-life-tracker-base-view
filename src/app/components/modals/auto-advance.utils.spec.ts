import { describe, expect, test } from 'bun:test'
import { shouldAutoAdvance } from './auto-advance.utils'

describe('shouldAutoAdvance', () => {
    test('advances after a pick when enabled', () => {
        expect(shouldAutoAdvance({ enabled: true, value: 'good', isLastProperty: false })).toBe(
            true
        )
        expect(shouldAutoAdvance({ enabled: true, value: false, isLastProperty: false })).toBe(true)
        expect(shouldAutoAdvance({ enabled: true, value: 0, isLastProperty: false })).toBe(true)
    })

    test('does nothing when the setting is off', () => {
        expect(shouldAutoAdvance({ enabled: false, value: 'good', isLastProperty: false })).toBe(
            false
        )
    })

    test('stays on the last property instead of closing or switching files', () => {
        expect(shouldAutoAdvance({ enabled: true, value: 'good', isLastProperty: true })).toBe(
            false
        )
    })

    test('does not advance when the pick cleared the value', () => {
        for (const value of ['', null, undefined]) {
            expect(shouldAutoAdvance({ enabled: true, value, isLastProperty: false })).toBe(false)
        }
    })
})
