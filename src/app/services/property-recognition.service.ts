import { type TFile, parseFrontMatterTags, type CachedMetadata, type App } from 'obsidian'
import type { PropertyDefinition, Mapping } from '../types'
import { log } from '../../utils'

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
        return matchesMapping(toMappingSubject(file, metadata), mapping)
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

/**
 * What a mapping looks at, independent of Obsidian's file classes so capture
 * target lookup (and tests) can use the exact same matching.
 */
export interface MappingSubject {
    /** Vault-relative path */
    path: string
    /** File name without extension */
    basename: string
    /** Parent folder path; empty for the vault root */
    folder: string
    /** Frontmatter tags, with or without a leading `#` */
    tags: readonly string[]
}

/** Build the mapping subject of a vault file from its cached metadata */
export function toMappingSubject(file: TFile, metadata: CachedMetadata | null): MappingSubject {
    const tags = metadata?.frontmatter ? (parseFrontMatterTags(metadata.frontmatter) ?? []) : []
    return {
        path: file.path,
        basename: file.basename,
        folder: file.parent?.path ?? '',
        tags
    }
}

function normalizeTag(tag: string): string {
    return (tag.startsWith('#') ? tag.slice(1) : tag).toLowerCase()
}

/** Whether a subject carries a tag (frontmatter tags, case-insensitive, `#` optional) */
export function subjectHasTag(subject: MappingSubject, tag: string): boolean {
    const wanted = normalizeTag(tag)
    return subject.tags.some((candidate) => normalizeTag(candidate) === wanted)
}

/**
 * Whether a subject matches one mapping: a frontmatter tag, a folder (exact
 * or below it), or a regex tested against the path and the basename. Formula
 * mappings are not implemented and never match.
 */
export function matchesMapping(subject: MappingSubject, mapping: Mapping): boolean {
    switch (mapping.type) {
        case 'tag':
            return subjectHasTag(subject, mapping.value)

        case 'folder': {
            const folder = mapping.value.replace(/^\/|\/$/g, '').toLowerCase()
            const fileFolder = subject.folder.toLowerCase()
            return fileFolder === folder || fileFolder.startsWith(folder + '/')
        }

        case 'regex':
            try {
                const regex = new RegExp(mapping.value, 'i')
                return regex.test(subject.path) || regex.test(subject.basename)
            } catch (e) {
                log('Invalid regex in a note filter; it matches nothing', 'warn', mapping.value, e)
                return false
            }

        case 'formula':
            // Formula matching not yet implemented
            return false

        default: {
            // Exhaustive check
            const _exhaustive: never = mapping.type
            log('Unknown note filter type; it matches nothing', 'warn', _exhaustive)
            return false
        }
    }
}
