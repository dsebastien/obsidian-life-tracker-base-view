import { setIcon } from 'obsidian'
import type { BasesPropertyId } from 'obsidian'
import type { OrderedCardItem } from '../../view/card-order.types'
import { prefersReducedMotion, setCssProps } from '../../../utils'

const HANDLE_CLASS = 'lt-card-drag-handle'
const FLIP_CLASS = 'lt-card--flip'
const DRAG_GHOST_CLASS = 'lt-card--dragging'
const DROP_INDICATOR_BEFORE_CLASS = 'lt-card--drop-before'
const DROP_INDICATOR_AFTER_CLASS = 'lt-card--drop-after'
const CARD_KIND_ATTR = 'data-card-kind'
const CARD_ID_ATTR = 'data-card-id'

/**
 * Movement threshold (px) before pointerdown is interpreted as a drag.
 * Below this, the press is treated as a normal interaction (so accidental
 * tiny mouse jitters don't start a drag).
 */
const DRAG_START_THRESHOLD = 5

export interface DragReorderController {
    /**
     * Attach a drag handle (grip icon) to a card. Returns the handle element
     * so the caller can position it inside the card if needed.
     */
    attachHandle(cardEl: HTMLElement, item: OrderedCardItem): HTMLElement
    /**
     * Stop listening to grid-level pointer events. Call when the view is
     * unloaded or before tearing down the grid.
     */
    destroy(): void
}

export interface DragReorderOptions {
    /**
     * Called once the user has dropped a card in a new position. Receives
     * the new card order (already reflected in the DOM).
     */
    onReorder: (newOrder: OrderedCardItem[]) => void
}

/**
 * FLIP-animate a reorder (issue #111): capture every card's position, run the
 * DOM mutation, then transition each displaced card from its old position to
 * its new one. Skipped entirely under prefers-reduced-motion.
 */
function animateReorder(gridEl: HTMLElement, mutate: () => void): void {
    if (prefersReducedMotion()) {
        mutate()
        return
    }

    const cards = Array.from(gridEl.querySelectorAll<HTMLElement>(`[${CARD_ID_ATTR}]`))
    const before = new Map(cards.map((card) => [card, card.getBoundingClientRect()]))

    mutate()

    for (const card of cards) {
        const first = before.get(card)
        if (!first) continue

        const last = card.getBoundingClientRect()
        const dx = first.left - last.left
        const dy = first.top - last.top
        if (dx === 0 && dy === 0) continue

        // Invert: place the card visually back at its old position, then let
        // the transition play it to its natural (new) position.
        setCssProps(card, { transform: `translate(${dx}px, ${dy}px)` })
        window.requestAnimationFrame(() => {
            card.classList.add(FLIP_CLASS)
            card.style.removeProperty('transform')
            window.setTimeout(() => card.classList.remove(FLIP_CLASS), 200)
        })
    }
}

interface DragState {
    item: OrderedCardItem
    cardEl: HTMLElement
    pointerId: number
    startX: number
    startY: number
    started: boolean
    lastDropTarget: { cardEl: HTMLElement; position: 'before' | 'after' } | null
}

/**
 * Create a controller that wires pointer-event based drag-and-drop reordering
 * on the cards inside `gridEl`. Works on both desktop (mouse) and mobile
 * (touch/stylus) because Pointer events are unified.
 */
export function createDragReorderController(
    gridEl: HTMLElement,
    options: DragReorderOptions
): DragReorderController {
    let state: DragState | null = null

    const cleanupDropIndicators = (): void => {
        gridEl.querySelectorAll('.' + DROP_INDICATOR_BEFORE_CLASS).forEach((el) => {
            el.classList.remove(DROP_INDICATOR_BEFORE_CLASS)
        })
        gridEl.querySelectorAll('.' + DROP_INDICATOR_AFTER_CLASS).forEach((el) => {
            el.classList.remove(DROP_INDICATOR_AFTER_CLASS)
        })
    }

    const cancelDrag = (): void => {
        if (!state) return
        state.cardEl.classList.remove(DRAG_GHOST_CLASS)
        cleanupDropIndicators()
        state = null
    }

    const findDropTarget = (
        clientX: number,
        clientY: number
    ): { cardEl: HTMLElement; position: 'before' | 'after' } | null => {
        if (!state) return null

        const cards = Array.from(gridEl.querySelectorAll<HTMLElement>(`[${CARD_ID_ATTR}]`)).filter(
            (el) => el !== state?.cardEl
        )

        for (const card of cards) {
            const rect = card.getBoundingClientRect()
            if (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            ) {
                // Decide before/after based on which half the pointer is in.
                // Horizontal midpoint works well for grid layouts where cards
                // sit side by side; for single-column layouts vertical works
                // better. Use the longer dimension to pick the axis.
                const isWide = rect.width >= rect.height
                const pivot = isWide ? rect.left + rect.width / 2 : rect.top + rect.height / 2
                const pointer = isWide ? clientX : clientY
                return { cardEl: card, position: pointer < pivot ? 'before' : 'after' }
            }
        }
        return null
    }

    const handlePointerMove = (event: PointerEvent): void => {
        if (!state || event.pointerId !== state.pointerId) return

        const dx = event.clientX - state.startX
        const dy = event.clientY - state.startY
        if (!state.started) {
            if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD) return
            state.started = true
            state.cardEl.classList.add(DRAG_GHOST_CLASS)
        }

        event.preventDefault()

        const target = findDropTarget(event.clientX, event.clientY)
        if (
            target?.cardEl === state.lastDropTarget?.cardEl &&
            target?.position === state.lastDropTarget?.position
        ) {
            return
        }

        cleanupDropIndicators()
        state.lastDropTarget = target
        if (target) {
            const cls =
                target.position === 'before'
                    ? DROP_INDICATOR_BEFORE_CLASS
                    : DROP_INDICATOR_AFTER_CLASS
            target.cardEl.classList.add(cls)
        }
    }

    const handlePointerUp = (event: PointerEvent): void => {
        if (!state || event.pointerId !== state.pointerId) return

        const wasStarted = state.started
        const target = state.lastDropTarget
        const draggedCard = state.cardEl
        const draggedItem = state.item

        // Snapshot then clear so the drag is no longer "in progress" before we
        // call out to user code or mutate the DOM.
        state.cardEl.classList.remove(DRAG_GHOST_CLASS)
        cleanupDropIndicators()
        state = null

        if (!wasStarted || !target) return

        // Move the dragged card next to the drop target in the DOM right now,
        // so the user sees the change instantly (no chart re-render). The
        // displaced cards glide to their new positions (issue #111).
        animateReorder(gridEl, () => {
            if (target.position === 'before') {
                target.cardEl.parentElement?.insertBefore(draggedCard, target.cardEl)
            } else {
                target.cardEl.parentElement?.insertBefore(draggedCard, target.cardEl.nextSibling)
            }
        })

        const newOrder = readGridOrder(gridEl)
        const containsDragged = newOrder.some(
            (i) => i.kind === draggedItem.kind && i.id === draggedItem.id
        )
        if (containsDragged) {
            options.onReorder(newOrder)
        }
    }

    const handlePointerCancel = (event: PointerEvent): void => {
        if (!state || event.pointerId !== state.pointerId) return
        cancelDrag()
    }

    // Listen at the grid level so we don't have to attach to each handle.
    gridEl.addEventListener('pointermove', handlePointerMove)
    gridEl.addEventListener('pointerup', handlePointerUp)
    gridEl.addEventListener('pointercancel', handlePointerCancel)

    return {
        attachHandle(cardEl: HTMLElement, item: OrderedCardItem): HTMLElement {
            cardEl.setAttribute(CARD_KIND_ATTR, item.kind)
            cardEl.setAttribute(CARD_ID_ATTR, item.id)

            // Place the handle inline at the start of the card's header so
            // it sits just before the title. Configured / overlay cards use
            // `.lt-section-header`; the unconfigured config card uses
            // `.lt-config-card-header`. Fall back to the card itself if
            // neither is present (shouldn't happen, but keeps the handle
            // discoverable).
            const headerEl =
                cardEl.querySelector<HTMLElement>('.lt-section-header') ??
                cardEl.querySelector<HTMLElement>('.lt-config-card-header') ??
                cardEl

            // createDiv only appends; we want to prepend to the header so
            // the handle sits before the title. Two-step: createDiv (appends
            // as last child) then move with insertBefore to first position.
            const handle = headerEl.createDiv({
                cls: HANDLE_CLASS,
                attr: {
                    'aria-label': 'Reorder card (drag, or use arrow keys while focused)',
                    'role': 'button'
                }
            })
            setIcon(handle, 'grip-vertical')
            headerEl.insertBefore(handle, headerEl.firstChild)

            // Keyboard alternative to dragging (issue #110): arrows move the
            // card one position back/forward in reading order
            handle.tabIndex = 0
            handle.addEventListener('keydown', (event) => {
                const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
                if (!backward && !forward) return
                event.preventDefault()
                event.stopPropagation()

                const cards = Array.from(gridEl.querySelectorAll<HTMLElement>(`[${CARD_ID_ATTR}]`))
                const index = cards.indexOf(cardEl)
                const target = cards[backward ? index - 1 : index + 1]
                if (!target) return

                animateReorder(gridEl, () => {
                    if (backward) {
                        target.parentElement?.insertBefore(cardEl, target)
                    } else {
                        target.parentElement?.insertBefore(cardEl, target.nextSibling)
                    }
                })

                options.onReorder(readGridOrder(gridEl))
                handle.focus()
            })

            handle.addEventListener('pointerdown', (event) => {
                // Ignore secondary buttons; let context-menu / right-click work.
                if (event.button !== undefined && event.button !== 0) return
                if (state) return

                state = {
                    item,
                    cardEl,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    started: false,
                    lastDropTarget: null
                }

                // Capture so we keep getting move/up events even if the pointer
                // leaves the handle (or the card).
                try {
                    handle.setPointerCapture(event.pointerId)
                } catch {
                    // Ignore — some environments throw when capture fails.
                }
            })

            return handle
        },
        destroy(): void {
            gridEl.removeEventListener('pointermove', handlePointerMove)
            gridEl.removeEventListener('pointerup', handlePointerUp)
            gridEl.removeEventListener('pointercancel', handlePointerCancel)
            cancelDrag()
        }
    }
}

function readGridOrder(gridEl: HTMLElement): OrderedCardItem[] {
    const cards = Array.from(gridEl.querySelectorAll<HTMLElement>(`[${CARD_ID_ATTR}]`))
    const order: OrderedCardItem[] = []
    for (const card of cards) {
        const kind = card.getAttribute(CARD_KIND_ATTR)
        const id = card.getAttribute(CARD_ID_ATTR)
        if (!id) continue
        if (kind === 'property') {
            order.push({ kind: 'property', id: id as BasesPropertyId })
        } else if (kind === 'overlay') {
            order.push({ kind: 'overlay', id })
        }
    }
    return order
}
