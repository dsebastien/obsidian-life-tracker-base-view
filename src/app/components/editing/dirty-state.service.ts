/**
 * State for a single tracked entry
 */
interface EntryState {
    entryId: string
    originalValues: Record<string, unknown>
    currentValues: Record<string, unknown>
}

/**
 * Callback for dirty state changes
 */
export type DirtyChangeCallback = (entryId: string, isDirty: boolean) => void

/**
 * Service to track unsaved changes for entries (notes)
 * Used by table and grid views to manage Save/Reset button state
 */
export class DirtyStateService {
    private entries = new Map<string, EntryState>()
    private listeners = new Set<DirtyChangeCallback>()

    /**
     * Start tracking an entry with its initial values
     * @param entryId Unique identifier (typically file path)
     * @param values Initial property values
     */
    track(entryId: string, values: Record<string, unknown>): void {
        this.entries.set(entryId, {
            entryId,
            originalValues: this.deepClone(values),
            currentValues: this.deepClone(values)
        })
    }

    /**
     * Stop tracking an entry
     */
    untrack(entryId: string): void {
        this.entries.delete(entryId)
    }

    /**
     * Clear all tracked entries
     */
    clear(): void {
        this.entries.clear()
    }

    /**
     * Update a single property value
     */
    update(entryId: string, propertyName: string, value: unknown): void {
        const entry = this.entries.get(entryId)
        if (!entry) return

        entry.currentValues[propertyName] = value
        this.notifyListeners(entryId)
    }

    /**
     * Update multiple property values at once
     */
    updateMultiple(entryId: string, values: Record<string, unknown>): void {
        const entry = this.entries.get(entryId)
        if (!entry) return

        for (const [key, value] of Object.entries(values)) {
            entry.currentValues[key] = value
        }
        this.notifyListeners(entryId)
    }

    /**
     * Check if an entry has unsaved changes
     */
    isDirty(entryId: string): boolean {
        const entry = this.entries.get(entryId)
        if (!entry) return false

        return !this.deepEqual(entry.originalValues, entry.currentValues)
    }

    /**
     * Check if a specific property has changed
     */
    isPropertyDirty(entryId: string, propertyName: string): boolean {
        const entry = this.entries.get(entryId)
        if (!entry) return false

        return !this.deepEqual(
            entry.originalValues[propertyName],
            entry.currentValues[propertyName]
        )
    }

    /**
     * Get all current values for an entry
     */
    getCurrentValues(entryId: string): Record<string, unknown> | null {
        const entry = this.entries.get(entryId)
        if (!entry) return null

        return this.deepClone(entry.currentValues)
    }

    /**
     * Get only the changed values for saving
     * Returns null if no changes
     */
    getChanges(entryId: string): Record<string, unknown> | null {
        const entry = this.entries.get(entryId)
        if (!entry || !this.isDirty(entryId)) return null

        const changes: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(entry.currentValues)) {
            if (!this.deepEqual(entry.originalValues[key], value)) {
                changes[key] = value
            }
        }

        return Object.keys(changes).length > 0 ? changes : null
    }

    /**
     * Reset entry to original values
     * Returns the original values
     */
    reset(entryId: string): Record<string, unknown> | null {
        const entry = this.entries.get(entryId)
        if (!entry) return null

        entry.currentValues = this.deepClone(entry.originalValues)
        this.notifyListeners(entryId)
        return this.deepClone(entry.originalValues)
    }

    /**
     * Mark entry as saved (set original = current)
     */
    markSaved(entryId: string): void {
        const entry = this.entries.get(entryId)
        if (!entry) return

        entry.originalValues = this.deepClone(entry.currentValues)
        this.notifyListeners(entryId)
    }

    /**
     * Subscribe to dirty state changes
     * @returns Unsubscribe function
     */
    onChange(callback: DirtyChangeCallback): () => void {
        this.listeners.add(callback)
        return () => {
            this.listeners.delete(callback)
        }
    }

    /**
     * Get list of all dirty entry IDs
     */
    getDirtyEntryIds(): string[] {
        const dirtyIds: string[] = []
        for (const entryId of this.entries.keys()) {
            if (this.isDirty(entryId)) {
                dirtyIds.push(entryId)
            }
        }
        return dirtyIds
    }

    /**
     * Check if any entries are dirty
     */
    hasAnyDirty(): boolean {
        for (const entryId of this.entries.keys()) {
            if (this.isDirty(entryId)) {
                return true
            }
        }
        return false
    }

    private notifyListeners(entryId: string): void {
        const isDirty = this.isDirty(entryId)
        for (const listener of this.listeners) {
            try {
                listener(entryId, isDirty)
            } catch {
                // Ignore listener errors
            }
        }
    }

    private deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj)) as T
    }

    private deepEqual(a: unknown, b: unknown): boolean {
        return JSON.stringify(a) === JSON.stringify(b)
    }
}
