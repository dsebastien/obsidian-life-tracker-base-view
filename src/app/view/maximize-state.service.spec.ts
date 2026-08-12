import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { MaximizeStateService, type VisualizationEntry } from './maximize-state.service'
import type { BaseVisualization } from '../components/visualizations/base-visualization'
import type { VisualizationDataPoint } from '../types'
import { CSS_CLASS, DATA_ATTR_FULL } from '../../utils'

/**
 * Minimal DOM stand-ins. Bun's test runner has no DOM, and the service only
 * uses classList, getAttribute and querySelectorAll, so faking those keeps the
 * real branching logic under test without pulling in a DOM implementation.
 */
class FakeClassList {
    private classes = new Set<string>()

    add(...names: string[]): void {
        names.forEach((name) => this.classes.add(name))
    }

    remove(...names: string[]): void {
        names.forEach((name) => this.classes.delete(name))
    }

    contains(name: string): boolean {
        return this.classes.has(name)
    }
}

class FakeElement {
    classList = new FakeClassList()
    private attributes: Record<string, string> = {}
    private children: FakeElement[] = []

    constructor(attributes: Record<string, string> = {}) {
        this.attributes = attributes
    }

    getAttribute(name: string): string | null {
        return this.attributes[name] ?? null
    }

    appendChild(child: FakeElement): void {
        this.children.push(child)
    }

    querySelectorAll(_selector: string): { forEach(cb: (el: FakeElement) => void): void } {
        // The service only ever queries for cards, and every child here is one.
        const children = this.children
        return {
            forEach(cb: (el: FakeElement) => void): void {
                children.forEach(cb)
            }
        }
    }
}

/** Records what the service asked of a visualization. */
class FakeVisualization {
    maximized = false
    updateCount = 0

    setMaximized(maximized: boolean): void {
        this.maximized = maximized
    }

    update(_dataPoints: VisualizationDataPoint[]): void {
        this.updateCount++
    }
}

const PROPERTY_ID = 'note.mood' as unknown as BasesPropertyId
const DATA_POINT = {} as VisualizationDataPoint

interface Harness {
    service: MaximizeStateService
    containerEl: FakeElement
    cards: Map<string, FakeElement>
    visualizations: Map<string, VisualizationEntry>
    vizOf(id: string): FakeVisualization
}

/**
 * Build a grid where every visualization ID in `visualizationIds` renders its
 * own card, all backed by the same property — the shape that broke in #151.
 */
function createHarness(visualizationIds: string[], extraCards: FakeElement[] = []): Harness {
    const containerEl = new FakeElement()
    const gridEl = new FakeElement()
    const cards = new Map<string, FakeElement>()
    const visualizations = new Map<string, VisualizationEntry>()

    for (const id of visualizationIds) {
        const card = new FakeElement({
            [DATA_ATTR_FULL.PROPERTY_ID]: String(PROPERTY_ID),
            [DATA_ATTR_FULL.VISUALIZATION_ID]: id
        })
        cards.set(id, card)
        gridEl.appendChild(card)

        visualizations.set(id, {
            propertyId: PROPERTY_ID,
            propertyDisplayName: 'Mood',
            visualization: new FakeVisualization() as unknown as BaseVisualization
        })
    }

    extraCards.forEach((card) => gridEl.appendChild(card))

    const service = new MaximizeStateService(
        containerEl as unknown as HTMLElement,
        () => gridEl as unknown as HTMLElement,
        () => visualizations,
        () => [DATA_POINT]
    )

    return {
        service,
        containerEl,
        cards,
        visualizations,
        vizOf: (id) => visualizations.get(id)?.visualization as unknown as FakeVisualization
    }
}

describe('MaximizeStateService', () => {
    let originalActiveDocument: unknown

    beforeEach(() => {
        originalActiveDocument = (globalThis as Record<string, unknown>)['activeDocument']
        ;(globalThis as Record<string, unknown>)['activeDocument'] = {
            addEventListener: (): void => {},
            removeEventListener: (): void => {}
        }
    })

    afterEach(() => {
        ;(globalThis as Record<string, unknown>)['activeDocument'] = originalActiveDocument
    })

    it('maximizes only the visualization whose button was clicked (issue #151)', () => {
        const harness = createHarness(['viz-a', 'viz-b'])

        harness.service.handleMaximizeToggle('viz-a', true)

        expect(harness.vizOf('viz-a').maximized).toBe(true)
        expect(harness.vizOf('viz-b').maximized).toBe(false)
    })

    it('hides the sibling card that shares the same property (issue #151)', () => {
        const harness = createHarness(['viz-a', 'viz-b'])

        harness.service.handleMaximizeToggle('viz-a', true)

        const cardA = harness.cards.get('viz-a')
        const cardB = harness.cards.get('viz-b')
        expect(cardA?.classList.contains('lt-card--maximized')).toBe(true)
        expect(cardA?.classList.contains('lt-card--hidden')).toBe(false)
        expect(cardB?.classList.contains('lt-card--maximized')).toBe(false)
        expect(cardB?.classList.contains('lt-card--hidden')).toBe(true)
    })

    it('re-renders only the maximized visualization, not its siblings', () => {
        const harness = createHarness(['viz-a', 'viz-b'])

        harness.service.handleMaximizeToggle('viz-a', true)

        expect(harness.vizOf('viz-a').updateCount).toBe(1)
        expect(harness.vizOf('viz-b').updateCount).toBe(0)
    })

    it('reports maximized state per visualization, not per property', () => {
        const harness = createHarness(['viz-a', 'viz-b'])

        harness.service.handleMaximizeToggle('viz-a', true)

        expect(harness.service.isMaximized('viz-a')).toBe(true)
        expect(harness.service.isMaximized('viz-b')).toBe(false)
        expect(harness.service.getMaximizedVisualizationId()).toBe('viz-a')
    })

    it('restores every card when minimizing, and re-renders the previous one', () => {
        const harness = createHarness(['viz-a', 'viz-b'])
        harness.service.handleMaximizeToggle('viz-a', true)

        harness.service.handleMaximizeToggle('viz-a', false)

        expect(harness.service.getMaximizedVisualizationId()).toBeNull()
        expect(harness.vizOf('viz-a').maximized).toBe(false)
        expect(harness.vizOf('viz-b').maximized).toBe(false)
        expect(harness.vizOf('viz-a').updateCount).toBe(2)
        expect(harness.vizOf('viz-b').updateCount).toBe(0)
        for (const card of harness.cards.values()) {
            expect(card.classList.contains('lt-card--hidden')).toBe(false)
            expect(card.classList.contains('lt-card--maximized')).toBe(false)
        }
    })

    it('switches directly from one maximized visualization to another', () => {
        const harness = createHarness(['viz-a', 'viz-b'])
        harness.service.handleMaximizeToggle('viz-a', true)

        harness.service.handleMaximizeToggle('viz-b', true)

        expect(harness.vizOf('viz-a').maximized).toBe(false)
        expect(harness.vizOf('viz-b').maximized).toBe(true)
        expect(harness.cards.get('viz-a')?.classList.contains('lt-card--hidden')).toBe(true)
        expect(harness.cards.get('viz-b')?.classList.contains('lt-card--maximized')).toBe(true)
    })

    it('hides cards without a visualization ID but never maximizes them', () => {
        const skeleton = new FakeElement()
        const harness = createHarness(['viz-a'], [skeleton])

        harness.service.handleMaximizeToggle('viz-a', true)
        expect(skeleton.classList.contains('lt-card--hidden')).toBe(true)
        expect(skeleton.classList.contains('lt-card--maximized')).toBe(false)

        harness.service.handleMaximizeToggle('viz-a', false)
        expect(skeleton.classList.contains('lt-card--hidden')).toBe(false)
    })

    it('toggles the container class alongside the maximized state', () => {
        const harness = createHarness(['viz-a'])

        harness.service.handleMaximizeToggle('viz-a', true)
        expect(harness.containerEl.classList.contains('lt-container--has-maximized')).toBe(true)

        harness.service.handleMaximizeToggle('viz-a', false)
        expect(harness.containerEl.classList.contains('lt-container--has-maximized')).toBe(false)
    })

    it('clears state on cleanup', () => {
        const harness = createHarness(['viz-a'])
        harness.service.handleMaximizeToggle('viz-a', true)

        harness.service.cleanup()

        expect(harness.service.getMaximizedVisualizationId()).toBeNull()
        expect(harness.containerEl.classList.contains('lt-container--has-maximized')).toBe(false)
    })

    it('uses the shared card class for grid queries', () => {
        // Guards against the selector and the class constant drifting apart.
        expect(CSS_CLASS.CARD).toBe('lt-card')
    })
})
