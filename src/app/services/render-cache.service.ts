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
    private entriesHash: string = ''

    /**
     * Start a new render cycle. Invalidates caches if data changed.
     * Must be called at the beginning of each onDataUpdated().
     */
    startRenderCycle(entries: BasesEntry[]): void {
        // Compute a simple hash of entries to detect data changes
        const newHash = this.computeEntriesHash(entries)

        // Only clear caches if entries actually changed
        if (newHash !== this.entriesHash) {
            this.dateAnchorsCache = null
            this.dataPointsCache.clear()
            this.entriesHash = newHash
        }
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
     * Clear all caches (useful for forced refresh)
     */
    clearAll(): void {
        this.dateAnchorsCache = null
        this.dataPointsCache.clear()
        this.entriesHash = ''
    }
}
