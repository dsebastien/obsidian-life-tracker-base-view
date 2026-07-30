import { describe, expect, test } from 'bun:test'
import { createCoalescingWriter } from './write-queue.utils'

/** Resolve after `ms`, using a real timer so ordering is genuinely exercised */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('createCoalescingWriter', () => {
    test('never runs two writes at once', async () => {
        let running = 0
        let maxConcurrent = 0

        const save = createCoalescingWriter(async () => {
            running++
            maxConcurrent = Math.max(maxConcurrent, running)
            await delay(5)
            running--
        })

        await Promise.all(Array.from({ length: 8 }, () => save()))

        expect(maxConcurrent).toBe(1)
    })

    test('folds a burst of requests into at most two writes', async () => {
        // The pile-up case: 20 keystrokes must not mean 20 writes
        let writes = 0
        const save = createCoalescingWriter(async () => {
            writes++
            await delay(5)
        })

        await Promise.all(Array.from({ length: 20 }, () => save()))

        // One running plus one queued covering everything after it
        expect(writes).toBeLessThanOrEqual(2)
        expect(writes).toBeGreaterThan(0)
    })

    test('always persists the newest state, not the state at request time', async () => {
        const state = { value: '' }
        let persisted = 'unset'

        const save = createCoalescingWriter(async () => {
            const snapshot = state.value
            await delay(5)
            persisted = snapshot
        })

        // Simulate typing: each "keystroke" mutates state then requests a save
        const pending: Promise<void>[] = []
        for (const value of ['a', 'ab', 'abc', 'abcd']) {
            state.value = value
            pending.push(save())
        }

        await Promise.all(pending)

        expect(persisted).toBe('abcd')
    })

    test('a later request is not folded into a write that already started', async () => {
        const state = { value: 'first' }
        const persistedValues: string[] = []

        const save = createCoalescingWriter(async () => {
            const snapshot = state.value
            await delay(10)
            persistedValues.push(snapshot)
        })

        const first = save()
        // Let the first write actually begin before changing the state
        await delay(2)
        state.value = 'second'
        const second = save()

        await Promise.all([first, second])

        // The second request must get its own write: folding it into the
        // already-running one would silently lose "second"
        expect(persistedValues).toEqual(['first', 'second'])
    })

    test('awaiting a coalesced request still waits for a covering write', async () => {
        const state = { value: '' }
        let persisted = ''

        const save = createCoalescingWriter(async () => {
            const snapshot = state.value
            await delay(5)
            persisted = snapshot
        })

        state.value = 'x'
        void save()
        state.value = 'y'

        // This request folded into the queued write; when it resolves, the
        // newest state must already be on disk
        await save()

        expect(persisted).toBe('y')
    })

    test('a failed write rejects for its caller', async () => {
        const save = createCoalescingWriter(() => Promise.reject(new Error('disk full')))

        const message = await save().then(
            () => 'resolved',
            (error: unknown) => (error instanceof Error ? error.message : String(error))
        )

        expect(message).toBe('disk full')
    })

    test('a failed write does not wedge the queue', async () => {
        let attempts = 0
        const save = createCoalescingWriter(async () => {
            attempts++
            if (attempts === 1) throw new Error('disk full')
            await delay(1)
        })

        const failing = save().catch(() => 'failed')
        expect(await failing).toBe('failed')

        // The next request must still be written
        await save()
        expect(attempts).toBe(2)
    })
})
