/**
 * One pending operation per key: a second request for the same key joins the
 * first instead of starting another. Used so two quick-add taps on a missing
 * capture target note create one note, not `… 2` and `… 3`.
 */
export class InFlight<T> {
    private readonly pending = new Map<string, Promise<T>>()

    /** The pending operation for a key, if any */
    get(key: string): Promise<T> | undefined {
        return this.pending.get(key)
    }

    /**
     * Run `start` for a key unless one is already pending, in which case that
     * one is returned. The key is released when the operation settles.
     */
    run(key: string, start: () => Promise<T>): Promise<T> {
        const existing = this.pending.get(key)
        if (existing) return existing
        const operation = start().finally(() => {
            if (this.pending.get(key) === operation) this.pending.delete(key)
        })
        this.pending.set(key, operation)
        return operation
    }
}
