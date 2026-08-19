import { describe, expect, test } from 'bun:test'
import { TouchNavigationGate } from './touch-navigation'

/** Fake element recording the listener the gate installs */
function makeElement(): { el: HTMLElement; fire: (pointerType: string) => void } {
    let handler: ((event: PointerEvent) => void) | null = null

    const el = {
        addEventListener: (_type: string, fn: (event: PointerEvent) => void): void => {
            handler = fn
        },
        removeEventListener: (): void => {
            handler = null
        }
    } as unknown as HTMLElement

    return {
        el,
        fire: (pointerType: string): void => {
            handler?.({ pointerType } as PointerEvent)
        }
    }
}

describe('TouchNavigationGate', () => {
    test('mouse clicks navigate straight away', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('mouse')
        expect(gate.shouldNavigate('0:3')).toBe(true)
        expect(gate.shouldNavigate('0:3')).toBe(true)
    })

    test('with no pointer input at all, clicks navigate (keyboard)', () => {
        const gate = new TouchNavigationGate()
        expect(gate.shouldNavigate('0:3')).toBe(true)
    })

    test('the first tap only arms the target, the second navigates', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('touch')
        expect(gate.shouldNavigate('0:3')).toBe(false)
        expect(gate.isArmed('0:3')).toBe(true)
        expect(gate.shouldNavigate('0:3')).toBe(true)
    })

    test('tapping a different target re-arms instead of navigating', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('touch')
        expect(gate.shouldNavigate('0:3')).toBe(false)
        expect(gate.shouldNavigate('0:7')).toBe(false)
        expect(gate.isArmed('0:3')).toBe(false)
        expect(gate.shouldNavigate('0:7')).toBe(true)
    })

    test('a pen behaves like a finger', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('pen')
        expect(gate.isTouchInteraction()).toBe(true)
        expect(gate.shouldNavigate('0:3')).toBe(false)
    })

    test('switching back to the mouse navigates again', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('touch')
        expect(gate.shouldNavigate('0:3')).toBe(false)

        fire('mouse')
        expect(gate.shouldNavigate('0:3')).toBe(true)
    })

    test('reset disarms the pending target', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('touch')
        gate.shouldNavigate('0:3')
        gate.reset()

        expect(gate.isArmed('0:3')).toBe(false)
        expect(gate.shouldNavigate('0:3')).toBe(false)
    })

    test('dispose removes the listener', () => {
        const gate = new TouchNavigationGate()
        const { el, fire } = makeElement()
        gate.observe(el)

        fire('touch')
        gate.dispose()
        fire('touch')

        // The listener is gone, so the gate still sees the last known type
        expect(gate.isTouchInteraction()).toBe(true)
        expect(gate.isArmed('0:3')).toBe(false)
    })
})
