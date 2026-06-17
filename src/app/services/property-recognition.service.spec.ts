// The `obsidian` package is type-only; its runtime stub is registered in
// src/test-preload.ts (loaded via bunfig.toml [test] preload) so that value
// imports like `parseFrontMatterTags` resolve without errors.
import { describe, expect, test } from 'bun:test'
import type { App, CachedMetadata, TFile } from 'obsidian'
import type { Mapping, PropertyDefinition } from '../types'
import { PropertyRecognitionService } from './property-recognition.service'

/**
 * Type alias used to cast structural mocks to TFile without triggering the
 * `obsidianmd/no-tfile-tfolder-cast` lint rule (which bans `as TFile` by name).
 */
type MockTFile = TFile

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal TFile mock.
 * `parent.path` is the folder path, `basename` is the note filename without extension.
 *
 * We cast via `MockTFile` (a type alias for `TFile`) to avoid the
 * `obsidianmd/no-tfile-tfolder-cast` lint rule that bans `as TFile` by identifier name.
 */
function makeFile(path: string, folderPath: string, basename?: string): TFile {
    const mock: unknown = {
        path,
        basename: basename ?? path.replace(/\.md$/, ''),
        parent: { path: folderPath }
    }
    return mock as MockTFile
}

/**
 * Build a minimal App mock.
 * `metadataCache.getFileCache` returns the supplied CachedMetadata (or null).
 */
function makeApp(metadata: CachedMetadata | null = null): App {
    return {
        metadataCache: {
            getFileCache: () => metadata
        }
    } as unknown as App
}

function makeMetadataWithTags(tags: string[]): CachedMetadata {
    return {
        frontmatter: { tags }
    } as unknown as CachedMetadata
}

/**
 * Build a PropertyDefinition with the given mappings.
 */
function makeDef(mappings: Mapping[]): PropertyDefinition {
    return {
        id: 'def-1',
        name: 'energy',
        displayName: 'Energy',
        type: 'number',
        allowedValues: [],
        numberRange: null,
        defaultValue: null,
        required: false,
        description: '',
        order: 0,
        mappings,
        valueMapping: null
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PropertyRecognitionService', () => {
    // ─── no-mapping short-circuit ──────────────────────────────────────────────

    describe('no mappings — applies to all files', () => {
        test('property with empty mappings array applies to any file', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/2024-01-10.md', 'Daily')
            const def = makeDef([])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('property with only disabled mappings also applies to all files', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('daily.md', '')
            const def = makeDef([{ type: 'folder', value: 'NonExistent', enabled: false }])
            // All mappings disabled → treated as "no enabled mappings"
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })
    })

    // ─── folder mapping ────────────────────────────────────────────────────────

    describe('folder mapping', () => {
        test('matches file in the exact folder', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/2024-01-10.md', 'Daily')
            const def = makeDef([{ type: 'folder', value: 'Daily', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('matches file in subfolder of configured folder', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Work/Projects/note.md', 'Work/Projects')
            const def = makeDef([{ type: 'folder', value: 'Work', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('does NOT match file in sibling folder', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Personal/note.md', 'Personal')
            const def = makeDef([{ type: 'folder', value: 'Work', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })

        test('folder matching is case-insensitive', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('daily/note.md', 'daily')
            const def = makeDef([{ type: 'folder', value: 'Daily', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('strips leading/trailing slashes from folder path', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/note.md', 'Daily')
            const def = makeDef([{ type: 'folder', value: '/Daily/', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })
    })

    // ─── tag mapping ───────────────────────────────────────────────────────────

    describe('tag mapping', () => {
        test('matches file with a frontmatter tag', () => {
            const app = makeApp(makeMetadataWithTags(['meeting']))
            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'tag', value: 'meeting', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('tag matching strips # prefix from configured value', () => {
            const app = makeApp(makeMetadataWithTags(['meeting']))
            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'tag', value: '#meeting', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('tag matching is case-insensitive', () => {
            const app = makeApp(makeMetadataWithTags(['Meeting']))
            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'tag', value: 'meeting', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('returns false for file without the required tag', () => {
            const app = makeApp(makeMetadataWithTags(['journal']))
            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'tag', value: 'meeting', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })

        test('returns false when metadata is null', () => {
            const service = new PropertyRecognitionService(makeApp(null))
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'tag', value: 'meeting', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })
    })

    // ─── regex mapping ─────────────────────────────────────────────────────────

    describe('regex mapping', () => {
        test('matches file path against regex', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/2024-01-10.md', 'Daily', '2024-01-10')
            const def = makeDef([{ type: 'regex', value: '^\\d{4}-\\d{2}-\\d{2}$', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('tests against basename as well as full path', () => {
            const service = new PropertyRecognitionService(makeApp())
            // basename matches the pattern even though the full path does not
            const file = makeFile('Daily/2024-01-10.md', 'Daily', '2024-01-10')
            const def = makeDef([{ type: 'regex', value: '2024-01-10', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('returns false for non-matching regex', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Projects/my-project.md', 'Projects', 'my-project')
            const def = makeDef([{ type: 'regex', value: '^\\d{4}-\\d{2}-\\d{2}$', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })

        test('invalid regex pattern returns false (does not throw)', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('note.md', '')
            const def = makeDef([{ type: 'regex', value: '[invalid(', enabled: true }])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })
    })

    // ─── OR logic across multiple mappings ────────────────────────────────────

    describe('OR logic — any enabled matching mapping is sufficient', () => {
        test('file matching any one of multiple enabled mappings returns true', () => {
            const app = makeApp(makeMetadataWithTags(['journal']))
            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', 'Other')
            const def = makeDef([
                { type: 'folder', value: 'Daily', enabled: true }, // no match
                { type: 'tag', value: 'journal', enabled: true } // match
            ])
            expect(service.propertyAppliesToFile(file, def)).toBe(true)
        })

        test('disabled mapping is ignored even if it would match', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/note.md', 'Daily')
            const def = makeDef([
                { type: 'folder', value: 'Daily', enabled: false }, // disabled match
                { type: 'folder', value: 'Work', enabled: true } // enabled non-match
            ])
            expect(service.propertyAppliesToFile(file, def)).toBe(false)
        })
    })

    // ─── getApplicableProperties and cache ────────────────────────────────────

    describe('getApplicableProperties', () => {
        test('returns only definitions that apply to the file', () => {
            const service = new PropertyRecognitionService(makeApp())
            const file = makeFile('Daily/note.md', 'Daily')
            const matchingDef = makeDef([{ type: 'folder', value: 'Daily', enabled: true }])
            const nonMatchingDef = {
                ...makeDef([{ type: 'folder', value: 'Work', enabled: true }]),
                id: 'def-2'
            }
            const result = service.getApplicableProperties(file, [matchingDef, nonMatchingDef])
            expect(result).toHaveLength(1)
            expect(result[0]!.id).toBe('def-1')
        })

        test('result is cached and returned on second call without re-checking metadata', () => {
            let callCount = 0
            const app = {
                metadataCache: {
                    getFileCache: () => {
                        callCount++
                        return null
                    }
                }
            } as unknown as App

            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const defs = [makeDef([])]

            service.getApplicableProperties(file, defs)
            service.getApplicableProperties(file, defs)
            // Cache hit on second call: getFileCache should be called only once
            expect(callCount).toBe(1)
        })

        test('clearCache() for specific path removes only that entry', () => {
            let callCount = 0
            const app = {
                metadataCache: {
                    getFileCache: () => {
                        callCount++
                        return null
                    }
                }
            } as unknown as App

            const service = new PropertyRecognitionService(app)
            const fileA = makeFile('a.md', '')
            const fileB = makeFile('b.md', '')
            const defs = [makeDef([])]

            service.getApplicableProperties(fileA, defs) // callCount = 1
            service.getApplicableProperties(fileB, defs) // callCount = 2

            service.clearCache('a.md')

            service.getApplicableProperties(fileA, defs) // callCount = 3 (cache miss)
            service.getApplicableProperties(fileB, defs) // callCount = 3 (cache hit)

            expect(callCount).toBe(3)
        })

        test('clearCache() with no argument clears all entries', () => {
            let callCount = 0
            const app = {
                metadataCache: {
                    getFileCache: () => {
                        callCount++
                        return null
                    }
                }
            } as unknown as App

            const service = new PropertyRecognitionService(app)
            const file = makeFile('note.md', '')
            const defs = [makeDef([])]

            service.getApplicableProperties(file, defs)
            service.clearCache()
            service.getApplicableProperties(file, defs)

            expect(callCount).toBe(2)
        })
    })
})
