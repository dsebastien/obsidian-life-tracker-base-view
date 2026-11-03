import type { EventRef } from 'obsidian'

/** The metadata cache events this helper listens to; `MetadataCache` satisfies it */
export interface MetadataChangeSource {
    on(name: 'changed', callback: (file: { path: string }) => void): EventRef
    offref(ref: EventRef): void
}

/**
 * Wait until the cache shows what was written to `path`, not merely until
 * the next index of that path.
 *
 * A freshly created note is indexed several times (creation, Templater's
 * write, the plugin's own write), and the events arrive in their own time: the
 * first `changed` after a write can belong to an earlier write, leaving a
 * capture to read a note without its tags. So `isReady` is checked at once and
 * on every `changed` of the path, and only a true result ends the wait.
 *
 * The note is followed, not its path at the start: `subject.path` is read on
 * every event, and Obsidian updates a `TFile`'s path when a template renames
 * or moves the note.
 *
 * @returns whether the cache was ready; false when the timeout ran out first
 */
export function waitForCache(
    cache: MetadataChangeSource,
    subject: { readonly path: string },
    isReady: () => boolean,
    timeoutMs: number
): Promise<boolean> {
    if (isReady()) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (ready: boolean): void => {
            if (settled) return
            settled = true
            cache.offref(eventRef)
            window.clearTimeout(timer)
            resolve(ready)
        }
        const eventRef = cache.on('changed', (file) => {
            if ((file === subject || file.path === subject.path) && isReady()) finish(true)
        })
        const timer = window.setTimeout(() => finish(isReady()), timeoutMs)
    })
}
