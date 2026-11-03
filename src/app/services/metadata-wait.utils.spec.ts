import { describe, expect, test } from 'bun:test'
import type { EventRef } from 'obsidian'
import { waitForCache, type MetadataChangeSource } from './metadata-wait.utils'

function source(): MetadataChangeSource & { emit: (path: string) => void; listeners: number } {
    let handler: ((file: { path: string }) => void) | null = null
    const state = {
        listeners: 0,
        on: (_name: 'changed', callback: (file: { path: string }) => void): EventRef => {
            handler = callback
            state.listeners++
            return {}
        },
        offref: (): void => {
            handler = null
            state.listeners--
        },
        emit: (path: string): void => handler?.({ path })
    }
    return state
}

const PATH = 'S/2030/2030-01-02 2 (Strength Session).md'

describe('waitForCache', () => {
    test('an index of an earlier write does not end the wait (stale cache)', async () => {
        const cache = source()
        let indexedTags = false
        const waiting = waitForCache(cache, PATH, () => indexedTags, 1000)

        // Templater's earlier write is indexed first: still no tags
        cache.emit(PATH)
        let done = false
        void waiting.then(() => (done = true))
        await Promise.resolve()
        expect(done).toBe(false)

        // Then the plugin's own write
        indexedTags = true
        cache.emit(PATH)
        expect(await waiting).toBe(true)
        expect(cache.listeners).toBe(0)
    })

    test('ignores other paths, resolves at once when ready, reports a timeout', async () => {
        const cache = source()
        expect(await waitForCache(cache, PATH, () => true, 1000)).toBe(true)
        expect(cache.listeners).toBe(0)

        const waiting = waitForCache(cache, PATH, () => false, 5)
        cache.emit('other.md')
        expect(await waiting).toBe(false)
        expect(cache.listeners).toBe(0)
    })
})
