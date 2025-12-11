import type { BasesEntry, BasesPropertyId, Value } from 'obsidian'
import type {
    DateAnchorConfig,
    DateAnchorSource,
    ResolvedDateAnchor
} from '../types/date-anchor.types'
import { parseDateFromFilename } from '../../utils/date-utils'
import { extractDate, isDateLike } from '../../utils/value-extractors'

/**
 * Service for resolving date anchors from entries
 */
export class DateAnchorService {
    /**
     * Default date anchor sources in priority order
     */
    private readonly defaultSources: DateAnchorConfig[] = [
        { source: { type: 'filename', pattern: 'auto' }, priority: 1 },
        { source: { type: 'property', propertyId: 'note.date' as BasesPropertyId }, priority: 2 },
        {
            source: { type: 'property', propertyId: 'note.created' as BasesPropertyId },
            priority: 3
        },
        { source: { type: 'file-metadata', field: 'ctime' }, priority: 4 }
    ]

    /**
     * Resolve date anchor for an entry using default sources
     */
    resolveAnchor(entry: BasesEntry, config?: DateAnchorConfig[]): ResolvedDateAnchor | null {
        const sources = config ?? this.defaultSources

        // Sort by priority
        const sortedSources = [...sources].sort((a, b) => a.priority - b.priority)

        for (const { source } of sortedSources) {
            const result = this.tryResolveFromSource(entry, source)
            if (result) {
                return result
            }
        }

        return null
    }

    /**
     * Try to resolve date from a specific source
     */
    private tryResolveFromSource(
        entry: BasesEntry,
        source: DateAnchorSource
    ): ResolvedDateAnchor | null {
        switch (source.type) {
            case 'filename':
                return this.resolveFromFilename(entry, source)

            case 'property':
                return this.resolveFromProperty(entry, source)

            case 'file-metadata':
                return this.resolveFromFileMetadata(entry, source)

            default:
                return null
        }
    }

    /**
     * Resolve date from filename
     */
    private resolveFromFilename(
        entry: BasesEntry,
        source: DateAnchorSource & { type: 'filename' }
    ): ResolvedDateAnchor | null {
        const filename = entry.file.basename

        const parsed = parseDateFromFilename(filename)
        if (parsed) {
            return {
                date: parsed.date,
                source,
                confidence: 'high'
            }
        }

        return null
    }

    /**
     * Resolve date from a property value
     */
    private resolveFromProperty(
        entry: BasesEntry,
        source: DateAnchorSource & { type: 'property' }
    ): ResolvedDateAnchor | null {
        const value = entry.getValue(source.propertyId)

        if (!value || !isDateLike(value)) {
            return null
        }

        const date = extractDate(value)
        if (date) {
            return {
                date,
                source,
                confidence: 'medium'
            }
        }

        return null
    }

    /**
     * Resolve date from file metadata
     */
    private resolveFromFileMetadata(
        entry: BasesEntry,
        source: DateAnchorSource & { type: 'file-metadata' }
    ): ResolvedDateAnchor | null {
        const stat = entry.file.stat

        let timestamp: number | undefined
        if (source.field === 'ctime') {
            timestamp = stat.ctime
        } else if (source.field === 'mtime') {
            timestamp = stat.mtime
        }

        if (timestamp) {
            return {
                date: new Date(timestamp),
                source,
                confidence: 'low'
            }
        }

        return null
    }

    /**
     * Resolve date anchors for all entries
     */
    resolveAllAnchors(
        entries: BasesEntry[],
        config?: DateAnchorConfig[]
    ): Map<BasesEntry, ResolvedDateAnchor | null> {
        const results = new Map<BasesEntry, ResolvedDateAnchor | null>()

        for (const entry of entries) {
            results.set(entry, this.resolveAnchor(entry, config))
        }

        return results
    }

    /**
     * Find available date properties in entries
     */
    findDateProperties(entries: BasesEntry[], propertyIds: BasesPropertyId[]): BasesPropertyId[] {
        const dateProperties: BasesPropertyId[] = []

        for (const propId of propertyIds) {
            // Skip file properties for date anchor (use file-metadata source instead)
            if (propId.startsWith('file.')) continue

            // Check if any entry has a date-like value for this property
            let hasDateValue = false
            for (const entry of entries) {
                const value: Value | null = entry.getValue(propId)
                if (isDateLike(value)) {
                    hasDateValue = true
                    break
                }
            }

            if (hasDateValue) {
                dateProperties.push(propId)
            }
        }

        return dateProperties
    }

    /**
     * Create config for a specific property
     */
    createPropertyConfig(propertyId: BasesPropertyId, priority: number): DateAnchorConfig {
        return {
            source: { type: 'property', propertyId },
            priority
        }
    }

    /**
     * Create config for filename-based anchoring
     */
    createFilenameConfig(priority: number): DateAnchorConfig {
        return {
            source: { type: 'filename', pattern: 'auto' },
            priority
        }
    }

    /**
     * Create config for file metadata anchoring
     */
    createMetadataConfig(field: 'ctime' | 'mtime', priority: number): DateAnchorConfig {
        return {
            source: { type: 'file-metadata', field },
            priority
        }
    }
}
