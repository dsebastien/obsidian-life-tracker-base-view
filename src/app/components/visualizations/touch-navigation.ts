/**
 * Tap-to-inspect, tap-again-to-open gate for visualizations (issue #154).
 *
 * On a touch screen there is no hover: the same gesture that would reveal a
 * tooltip on desktop also fires `click`, so tapping a chart point or a heatmap
 * cell opened the underlying note immediately and the data could never be
 * inspected.
 *
 * This gate makes the first tap on a target inspect it (the tooltip shows and
 * nothing else happens) and a second tap on the *same* target within a short
 * window perform the navigation. Mouse and keyboard interaction is untouched:
 * a click still opens the note straight away.
 */

/** How long an armed target stays armed, in milliseconds */
const ARM_TIMEOUT_MS = 5000

/** Pointer types that need the two-step interaction */
const TOUCH_POINTER_TYPES = new Set(['touch', 'pen'])

export class TouchNavigationGate {
    private lastPointerType = 'mouse'
    private armedKey: string | null = null
    private armedAt = 0
    private detach: (() => void) | null = null

    /**
     * Watch an element for pointer input so the gate knows whether the click it
     * is asked about came from a finger. Replaces any previous binding.
     */
    observe(element: HTMLElement): void {
        this.detach?.()

        const onPointerDown = (event: PointerEvent): void => {
            this.lastPointerType = event.pointerType || 'mouse'
        }

        element.addEventListener('pointerdown', onPointerDown)
        this.detach = (): void => {
            element.removeEventListener('pointerdown', onPointerDown)
            this.detach = null
        }
    }

    /** Whether the interaction being handled came from a finger or a pen */
    isTouchInteraction(): boolean {
        return TOUCH_POINTER_TYPES.has(this.lastPointerType)
    }

    /** Whether `targetKey` is currently armed, i.e. a second tap would open it */
    isArmed(targetKey: string): boolean {
        return this.armedKey === targetKey && Date.now() - this.armedAt <= ARM_TIMEOUT_MS
    }

    /**
     * Decide whether a click on `targetKey` should navigate.
     *
     * Always true for mouse and keyboard input. For touch input, the first tap
     * arms the target and returns false; a second tap on the same target within
     * `ARM_TIMEOUT_MS` returns true.
     */
    shouldNavigate(targetKey: string): boolean {
        if (!this.isTouchInteraction()) {
            return true
        }

        if (this.isArmed(targetKey)) {
            this.reset()
            return true
        }

        this.armedKey = targetKey
        this.armedAt = Date.now()
        return false
    }

    /** Forget the armed target (e.g. after a re-render) */
    reset(): void {
        this.armedKey = null
        this.armedAt = 0
    }

    /** Stop watching and forget any armed target */
    dispose(): void {
        this.detach?.()
        this.reset()
    }
}
