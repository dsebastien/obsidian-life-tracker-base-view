/**
 * Wrap a "persist the current state" operation so it is both **serialized** and
 * **coalesced**.
 *
 * Settings editors call `updateSettings` on every keystroke. Two problems follow:
 *
 * - *Interleaving*: without serialization two writes can be in flight at once
 *   and land out of order, leaving the **older** snapshot on disk — a corruption
 *   that only surfaces after a restart.
 * - *Pile-up*: with naive serialization, typing 20 characters queues 20 writes.
 *   On slow storage the newest state stays unpersisted for as long as it takes
 *   to drain them, and quitting mid-drain loses the most recent edits.
 *
 * Both are solved by the same observation: `write` always persists *whatever the
 * state is when it runs*, so a write that has been queued but not yet started
 * already covers every request made since. At most one write runs and one waits;
 * everything else folds into the waiting one.
 *
 * The returned promise resolves once a write covering the caller's state has
 * completed, so `await`ing it remains meaningful. A failed write rejects for its
 * own callers without wedging the queue.
 */
export function createCoalescingWriter(write: () => Promise<void>): () => Promise<void> {
    let tail: Promise<void> = Promise.resolve()
    let queued: Promise<void> | null = null

    return (): Promise<void> => {
        // A queued write has not started yet, so it will pick up the state this
        // caller wants persisted — no need to add another
        if (queued !== null) return queued

        const startWrite = (): Promise<void> => {
            // Cleared as the write *starts*, not when it finishes: later callers
            // must queue a fresh write rather than fold into one that has
            // already read the state
            queued = null
            return write()
        }

        // Same handler either way: a previous failure must not skip this write
        const promise = tail.then(startWrite, startWrite)

        queued = promise
        tail = promise.catch(() => undefined)
        return promise
    }
}
