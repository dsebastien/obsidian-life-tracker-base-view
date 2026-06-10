import { test, expect, describe } from 'bun:test'
import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { ResolvedDateAnchor, VisualizationDataPoint } from '../types'
import { RenderCacheService } from './render-cache.service'

function makeEntry(path: string): BasesEntry {
    return { file: { path } } as unknown as BasesEntry
}

function makeDataPoint(filePath: string): VisualizationDataPoint {
    return {
        filePath,
        dateAnchor: null,
        numericValue: 1,
        booleanValue: null,
        displayLabel: null,
        listValues: []
    }
}

const PROPERTY = 'note.energy' as BasesPropertyId

describe('RenderCacheService (issue #95)', () => {
    test('caches survive a render cycle with identical entry references', () => {
        const service = new RenderCacheService()
        const entries = [makeEntry('a.md'), makeEntry('b.md')]

        service.startRenderCycle(entries)
        const anchors = new Map<BasesEntry, ResolvedDateAnchor | null>()
        service.setDateAnchors(anchors)
        service.setDataPoints(PROPERTY, [makeDataPoint('a.md')])

        // Same array contents (same references) → caches must be retained
        service.startRenderCycle([...entries])
        expect(service.getDateAnchors()).toBe(anchors)
        expect(service.getDataPoints(PROPERTY)).toHaveLength(1)
    })

    test('caches are invalidated when an entry reference changes', () => {
        const service = new RenderCacheService()
        const entries = [makeEntry('a.md'), makeEntry('b.md')]

        service.startRenderCycle(entries)
        service.setDateAnchors(new Map())
        service.setDataPoints(PROPERTY, [makeDataPoint('a.md')])

        // Obsidian replaced one entry object (e.g. the note was edited)
        service.startRenderCycle([entries[0]!, makeEntry('b.md')])
        expect(service.getDateAnchors()).toBeNull()
        expect(service.getDataPoints(PROPERTY)).toBeNull()
    })

    test('caches are invalidated when the entry count changes', () => {
        const service = new RenderCacheService()
        const entries = [makeEntry('a.md')]

        service.startRenderCycle(entries)
        service.setDataPoints(PROPERTY, [makeDataPoint('a.md')])

        service.startRenderCycle([...entries, makeEntry('b.md')])
        expect(service.getDataPoints(PROPERTY)).toBeNull()
    })

    test('clearAll drops everything', () => {
        const service = new RenderCacheService()
        const entries = [makeEntry('a.md')]

        service.startRenderCycle(entries)
        service.setDateAnchors(new Map())
        service.setDataPoints(PROPERTY, [makeDataPoint('a.md')])

        service.clearAll()
        expect(service.getDateAnchors()).toBeNull()
        expect(service.getDataPoints(PROPERTY)).toBeNull()

        // After clearAll the next cycle re-registers the entries
        service.startRenderCycle(entries)
        service.setDataPoints(PROPERTY, [makeDataPoint('a.md')])
        service.startRenderCycle(entries)
        expect(service.getDataPoints(PROPERTY)).toHaveLength(1)
    })
})
