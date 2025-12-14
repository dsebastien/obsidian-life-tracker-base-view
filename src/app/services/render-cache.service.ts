import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { ResolvedDateAnchor, VisualizationDataPoint } from '../types'

/**
 * Cache key for aggregated data
 */
interface AggregationCacheKey {
    propertyId: BasesPropertyId
    type: string
    granularity?: string
}

/**
 * Service for caching render-related data within a single render cycle.
 * Caches are automatically invalidated when a new render cycle starts.
 *
 * This improves performance by avoiding:
 * - Duplicate date anchor resolution
 * - Duplicate data point creation
 * - Duplicate aggregation computations
 */
export class RenderCacheService {
    private renderCycleId: number = 0
    private dateAnchorsCache: Map<BasesEntry, ResolvedDateAnchor | null> | null = null
    private dataPointsCache: Map<BasesPropertyId, VisualizationDataPoint[]> = new Map()
    private aggregationCache: Map<string, unknown> = new Map()
    private entriesHash: string = ''

    /**
     * Start a new render cycle. This invalidates all caches.
     * Must be called at the beginning of each onDataUpdated().
     */
    startRenderCycle(entries: BasesEntry[]): number {
        this.renderCycleId++

        // Compute a simple hash of entries to detect data changes
        const newHash = this.computeEntriesHash(entries)

        // Only clear caches if entries actually changed
        if (newHash !== this.entriesHash) {
            this.dateAnchorsCache = null
            this.dataPointsCache.clear()
            this.aggregationCache.clear()
            this.entriesHash = newHash
        }

        return this.renderCycleId
    }

    /**
     * Compute a hash of entries for change detection
     */
    private computeEntriesHash(entries: BasesEntry[]): string {
        // Use entry count and first/last file paths as a quick hash
        // This is fast and catches most changes
        if (entries.length === 0) return 'empty'

        const first = entries[0]
        const last = entries[entries.length - 1]
        return `${entries.length}:${first?.file.path ?? ''}:${last?.file.path ?? ''}`
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
     * Get cached aggregation result or null if not cached
     */
    getAggregation<T>(key: AggregationCacheKey): T | null {
        const cacheKey = this.buildAggregationKey(key)
        return (this.aggregationCache.get(cacheKey) as T) ?? null
    }

    /**
     * Cache an aggregation result
     */
    setAggregation<T>(key: AggregationCacheKey, data: T): void {
        const cacheKey = this.buildAggregationKey(key)
        this.aggregationCache.set(cacheKey, data)
    }

    /**
     * Build a string key for aggregation cache
     */
    private buildAggregationKey(key: AggregationCacheKey): string {
        return `${key.propertyId}:${key.type}:${key.granularity ?? ''}`
    }

    /**
     * Clear all caches (useful for forced refresh)
     */
    clearAll(): void {
        this.dateAnchorsCache = null
        this.dataPointsCache.clear()
        this.aggregationCache.clear()
        this.entriesHash = ''
    }

    /**
     * Get current render cycle ID (for debugging)
     */
    getRenderCycleId(): number {
        return this.renderCycleId
    }
}
