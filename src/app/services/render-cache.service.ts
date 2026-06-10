import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { ResolvedDateAnchor, VisualizationDataPoint } from '../types'

/**
 * Service for caching render-related data within a single render cycle.
 * Caches are automatically invalidated when a new render cycle starts.
 *
 * This improves performance by avoiding:
 * - Duplicate date anchor resolution
 * - Duplicate data point creation
 */
export class RenderCacheService {
    private dateAnchorsCache: Map<BasesEntry, ResolvedDateAnchor | null> | null = null
    private dataPointsCache: Map<BasesPropertyId, VisualizationDataPoint[]> = new Map()
    // Strong references on purpose: they only pin the *current* entries
    // (replaced wholesale whenever data changes), so there is no leak.
    // WeakRefs caused spurious cache invalidation after garbage collection
    // (issue #95: a collected ref made haveEntriesChanged return true).
    private cachedEntries: BasesEntry[] = []

    /**
     * Start a new render cycle. Invalidates caches if data changed.
     * Must be called at the beginning of each onDataUpdated().
     *
     * The dateAnchors cache uses BasesEntry objects as Map keys.
     * When Obsidian updates data, it may provide new BasesEntry objects
     * even for the same files. We must detect this to avoid stale lookups.
     */
    startRenderCycle(entries: BasesEntry[]): void {
        // Check if the entry objects themselves changed (not just the data)
        // This is critical because dateAnchors Map uses BasesEntry as keys
        const entriesChanged = this.haveEntriesChanged(entries)

        if (entriesChanged) {
            // Entry objects changed - must invalidate dateAnchors cache
            // (Map lookup would fail with new entry objects)
            this.dateAnchorsCache = null
            this.dataPointsCache.clear()
            this.updateCachedEntries(entries)
        }
    }

    /**
     * Check if entry objects have changed (new object references)
     */
    private haveEntriesChanged(entries: BasesEntry[]): boolean {
        // Different count = definitely changed
        if (entries.length !== this.cachedEntries.length) {
            return true
        }

        // Check if all entries are the same object references
        for (let i = 0; i < entries.length; i++) {
            if (this.cachedEntries[i] !== entries[i]) {
                return true
            }
        }

        return false
    }

    /**
     * Update cached entry references
     */
    private updateCachedEntries(entries: BasesEntry[]): void {
        this.cachedEntries = [...entries]
    }

    /**
     * Get cached date anchors or null if not cached
     */
    getDateAnchors(): Map<BasesEntry, ResolvedDateAnchor | null> | null {
        return this.dateAnchorsCache
    }

    /**
     * Cache date anchors for this render cycle
     */
    setDateAnchors(anchors: Map<BasesEntry, ResolvedDateAnchor | null>): void {
        this.dateAnchorsCache = anchors
    }

    /**
     * Get cached data points for a property or null if not cached
     */
    getDataPoints(propertyId: BasesPropertyId): VisualizationDataPoint[] | null {
        return this.dataPointsCache.get(propertyId) ?? null
    }

    /**
     * Cache data points for a property
     */
    setDataPoints(propertyId: BasesPropertyId, dataPoints: VisualizationDataPoint[]): void {
        this.dataPointsCache.set(propertyId, dataPoints)
    }

    /**
     * Clear all caches (useful for forced refresh)
     */
    clearAll(): void {
        this.dateAnchorsCache = null
        this.dataPointsCache.clear()
        this.cachedEntries = []
    }
}
