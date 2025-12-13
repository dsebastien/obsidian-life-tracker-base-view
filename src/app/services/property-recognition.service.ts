import { type TFile, parseFrontMatterTags, type CachedMetadata, type App } from 'obsidian'
import type { PropertyDefinition, Mapping } from '../types/property-definition.types'

/**
 * Service responsible for determining which property definitions apply to a file.
 *
 * Recognition uses OR logic: If a property has multiple mappings, ANY enabled
 * mapping matching means the property applies to that file.
 *
 * Properties with no mappings apply to all files.
 *
 * Compatible with Obsidian Starter Kit plugin's recognition patterns.
 */
export class PropertyRecognitionService {
    private cache: Map<string, PropertyDefinition[]>

    constructor(private app: App) {
        this.cache = new Map()
    }

    /**
     * Get all property definitions that apply to a specific file.
     *
     * @param file - The file to check
     * @param definitions - All property definitions
     * @returns Property definitions that apply to this file
     */
    getApplicableProperties(file: TFile, definitions: PropertyDefinition[]): PropertyDefinition[] {
        // Check cache first
        const cacheKey = this.getCacheKey(file.path, definitions)
        const cached = this.cache.get(cacheKey)
        if (cached) {
            return cached
        }

        const metadata = this.app.metadataCache.getFileCache(file)

        const applicable = definitions.filter((def) => this.propertyApplies(file, metadata, def))

        // Cache result
        this.cache.set(cacheKey, applicable)

        return applicable
    }

    /**
     * Check if a property definition applies to a file.
     * A property applies if it has no mappings OR if any enabled mapping matches.
     *
     * @param file - The file to check
     * @param definition - The property definition
     * @returns True if the property applies to this file
     */
    propertyAppliesToFile(file: TFile, definition: PropertyDefinition): boolean {
        const metadata = this.app.metadataCache.getFileCache(file)
        return this.propertyApplies(file, metadata, definition)
    }

    /**
     * Check if a property applies to a file.
     * Internal implementation with metadata already retrieved.
     */
    private propertyApplies(
        file: TFile,
        metadata: CachedMetadata | null,
        definition: PropertyDefinition
    ): boolean {
        // If no mappings defined, property applies to all files
        const enabledMappings = definition.mappings.filter((m) => m.enabled)
        if (enabledMappings.length === 0) {
            return true
        }

        // OR logic: if ANY enabled mapping matches, property applies
        return enabledMappings.some((mapping) => this.matchesMapping(file, metadata, mapping))
    }

    /**
     * Check if a file matches a specific mapping.
     */
    private matchesMapping(
        file: TFile,
        metadata: CachedMetadata | null,
        mapping: Mapping
    ): boolean {
        switch (mapping.type) {
            case 'tag':
                return this.matchesTag(metadata, mapping.value)

            case 'folder':
                return this.matchesFolder(file, mapping.value)

            case 'regex':
                return this.matchesRegex(file, mapping.value)

            case 'formula':
                // Formula matching not yet implemented
                return false

            default: {
                // Exhaustive check
                const _exhaustive: never = mapping.type
                console.error('Unknown mapping type:', _exhaustive)
                return false
            }
        }
    }

    /**
     * Check if a file has a specific tag in its frontmatter.
     */
    private matchesTag(metadata: CachedMetadata | null, tag: string): boolean {
        if (!metadata?.frontmatter) {
            return false
        }

        const tags = parseFrontMatterTags(metadata.frontmatter)
        if (!tags) {
            return false
        }

        // Normalize tag (remove # prefix if present)
        const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag

        return tags.some((t) => {
            const normalized = t.startsWith('#') ? t.slice(1) : t
            return normalized.toLowerCase() === normalizedTag.toLowerCase()
        })
    }

    /**
     * Check if a file is in a specific folder.
     */
    private matchesFolder(file: TFile, folderPath: string): boolean {
        // Normalize folder path (remove leading/trailing slashes)
        const normalizedFolder = folderPath.replace(/^\/|\/$/g, '')

        // Get file's folder path
        const fileFolder = file.parent?.path || ''

        // Exact match or subfolder match
        return (
            fileFolder.toLowerCase() === normalizedFolder.toLowerCase() ||
            fileFolder.toLowerCase().startsWith(normalizedFolder.toLowerCase() + '/')
        )
    }

    /**
     * Check if a file path or name matches a regex pattern.
     */
    private matchesRegex(file: TFile, pattern: string): boolean {
        try {
            const regex = new RegExp(pattern, 'i')
            // Test against both full path and basename
            return regex.test(file.path) || regex.test(file.basename)
        } catch (e) {
            console.error('Invalid regex pattern:', pattern, e)
            return false
        }
    }

    /**
     * Create a cache key from file path and definitions.
     * We include a hash of definition mappings to invalidate on changes.
     */
    private getCacheKey(filePath: string, definitions: PropertyDefinition[]): string {
        const mappingsHash = definitions
            .map(
                (d) => `${d.id}:${d.mappings.length}:${d.mappings.filter((m) => m.enabled).length}`
            )
            .join('|')
        return `${filePath}:${mappingsHash}`
    }

    /**
     * Clear the recognition cache.
     * Should be called when property definitions change.
     *
     * @param path - Optional file path to clear (clears all if omitted)
     */
    clearCache(path?: string): void {
        if (path) {
            // Clear all entries for this file path
            for (const key of this.cache.keys()) {
                if (key.startsWith(`${path}:`)) {
                    this.cache.delete(key)
                }
            }
        } else {
            this.cache.clear()
        }
    }
}
