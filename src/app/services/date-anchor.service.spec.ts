import { describe, expect, test } from 'bun:test'
import type { BasesEntry, BasesPropertyId } from 'obsidian'
import type { DateAnchorConfig } from '../types'
import { DateAnchorService } from './date-anchor.service'

/**
 * Minimal BasesEntry mock.
 * Only provides what DateAnchorService actually accesses: file.basename,
 * file.stat.ctime/mtime, file.path, and getValue().
 */
function makeEntry(
    basename: string,
    options: {
        getValue?: (id: BasesPropertyId) => unknown
        ctime?: number
        mtime?: number
        path?: string
    } = {}
): BasesEntry {
    return {
        file: {
            basename,
            path: options.path ?? basename,
            stat: {
                ctime: options.ctime ?? 0,
                mtime: options.mtime ?? 0
            }
        },
        getValue: options.getValue ?? (() => null)
    } as unknown as BasesEntry
}

describe('DateAnchorService', () => {
    const service = new DateAnchorService()

    // ─── filename source ──────────────────────────────────────────────────────

    describe('resolveAnchor — filename source', () => {
        test('parses YYYY-MM-DD daily note filename with high confidence', () => {
            const entry = makeEntry('2024-03-15')
            const result = service.resolveAnchor(entry)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('high')
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(2) // March = 2 (0-indexed)
            expect(result!.date.getDate()).toBe(15)
            expect(result!.source.type).toBe('filename')
        })

        test('parses YYYY-Www weekly filename', () => {
            const entry = makeEntry('2024-W10')
            const result = service.resolveAnchor(entry)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('high')
            expect(result!.source.type).toBe('filename')
        })

        test('parses YYYY-MM monthly filename', () => {
            const entry = makeEntry('2024-06')
            const result = service.resolveAnchor(entry)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('high')
        })

        test('returns null for non-date filename when only filename source configured', () => {
            const entry = makeEntry('my-journal-note')
            const filenameOnly: DateAnchorConfig[] = [
                { source: { type: 'filename', pattern: 'auto' }, priority: 1 }
            ]
            const result = service.resolveAnchor(entry, filenameOnly)
            expect(result).toBeNull()
        })
    })

    // ─── property source ──────────────────────────────────────────────────────

    describe('resolveAnchor — property source', () => {
        test('extracts date from ISO date string property with medium confidence', () => {
            const entry = makeEntry('some-note', {
                getValue: () => '2024-05-20'
            })
            const propertyOnly: DateAnchorConfig[] = [
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 1
                }
            ]
            const result = service.resolveAnchor(entry, propertyOnly)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('medium')
            expect(result!.source.type).toBe('property')
            expect(result!.date.getFullYear()).toBe(2024)
            expect(result!.date.getMonth()).toBe(4) // May
            expect(result!.date.getDate()).toBe(20)
        })

        test('returns null when property value is not date-like', () => {
            const entry = makeEntry('some-note', {
                getValue: () => 'hello world' // clearly not a date string
            })
            const propertyOnly: DateAnchorConfig[] = [
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.energy' as BasesPropertyId
                    },
                    priority: 1
                }
            ]
            const result = service.resolveAnchor(entry, propertyOnly)
            expect(result).toBeNull()
        })

        test('returns null when property value is null', () => {
            const entry = makeEntry('some-note', {
                getValue: () => null
            })
            const propertyOnly: DateAnchorConfig[] = [
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 1
                }
            ]
            expect(service.resolveAnchor(entry, propertyOnly)).toBeNull()
        })
    })

    // ─── file-metadata source ─────────────────────────────────────────────────

    describe('resolveAnchor — file-metadata source', () => {
        const EPOCH_MS = new Date('2024-01-15T12:00:00Z').getTime()

        test('resolves from ctime with low confidence', () => {
            const entry = makeEntry('some-note', { ctime: EPOCH_MS })
            const metaOnly: DateAnchorConfig[] = [
                { source: { type: 'file-metadata', field: 'ctime' }, priority: 1 }
            ]
            const result = service.resolveAnchor(entry, metaOnly)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('low')
            expect(result!.source.type).toBe('file-metadata')
            expect(result!.date.getTime()).toBe(EPOCH_MS)
        })

        test('resolves from mtime with low confidence', () => {
            const entry = makeEntry('some-note', { mtime: EPOCH_MS })
            const metaOnly: DateAnchorConfig[] = [
                { source: { type: 'file-metadata', field: 'mtime' }, priority: 1 }
            ]
            const result = service.resolveAnchor(entry, metaOnly)
            expect(result).not.toBeNull()
            expect(result!.confidence).toBe('low')
            expect(result!.date.getTime()).toBe(EPOCH_MS)
        })

        test('returns null when ctime is 0 (falsy)', () => {
            const entry = makeEntry('some-note', { ctime: 0 })
            const metaOnly: DateAnchorConfig[] = [
                { source: { type: 'file-metadata', field: 'ctime' }, priority: 1 }
            ]
            expect(service.resolveAnchor(entry, metaOnly)).toBeNull()
        })
    })

    // ─── priority order ───────────────────────────────────────────────────────

    describe('resolveAnchor — priority ordering', () => {
        test('filename wins over property when filename matches and both have values', () => {
            const entry = makeEntry('2024-03-15', {
                getValue: () => '2025-12-31' // a different date in the property
            })
            // filename priority=1, property priority=2 → filename wins
            const config: DateAnchorConfig[] = [
                { source: { type: 'filename', pattern: 'auto' }, priority: 1 },
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 2
                }
            ]
            const result = service.resolveAnchor(entry, config)
            expect(result).not.toBeNull()
            expect(result!.source.type).toBe('filename')
            expect(result!.date.getFullYear()).toBe(2024)
        })

        test('property wins over filename when filename does not match', () => {
            const entry = makeEntry('my-note', {
                getValue: () => '2025-06-01'
            })
            const config: DateAnchorConfig[] = [
                { source: { type: 'filename', pattern: 'auto' }, priority: 1 },
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 2
                }
            ]
            const result = service.resolveAnchor(entry, config)
            expect(result).not.toBeNull()
            expect(result!.source.type).toBe('property')
        })

        test('lower-priority source is last resort fallback', () => {
            const CTIME = new Date('2023-07-04').getTime()
            const entry = makeEntry('my-note', { ctime: CTIME })
            // filename won't match, no property value → ctime is the fallback
            const config: DateAnchorConfig[] = [
                { source: { type: 'filename', pattern: 'auto' }, priority: 1 },
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 2
                },
                { source: { type: 'file-metadata', field: 'ctime' }, priority: 3 }
            ]
            const result = service.resolveAnchor(entry, config)
            expect(result).not.toBeNull()
            expect(result!.source.type).toBe('file-metadata')
            expect(result!.confidence).toBe('low')
        })

        test('returns null when all sources fail', () => {
            const entry = makeEntry('my-note') // no date anywhere
            const result = service.resolveAnchor(entry)
            expect(result).toBeNull()
        })

        test('custom config with higher-priority property beats default filename source', () => {
            // filename matches a date but property has higher priority (lower number)
            const entry = makeEntry('2024-01-01', {
                getValue: () => '2025-06-15'
            })
            const config: DateAnchorConfig[] = [
                {
                    source: {
                        type: 'property',
                        propertyId: 'note.date' as BasesPropertyId
                    },
                    priority: 1 // higher priority
                },
                { source: { type: 'filename', pattern: 'auto' }, priority: 2 }
            ]
            const result = service.resolveAnchor(entry, config)
            expect(result).not.toBeNull()
            expect(result!.source.type).toBe('property')
            expect(result!.date.getFullYear()).toBe(2025)
        })
    })

    // ─── resolveAllAnchors ────────────────────────────────────────────────────

    describe('resolveAllAnchors', () => {
        test('returns a Map entry for every entry, including those that resolve to null', () => {
            const e1 = makeEntry('2024-01-10')
            const e2 = makeEntry('no-date')
            const map = service.resolveAllAnchors([e1, e2])
            expect(map.size).toBe(2)
            expect(map.get(e1)).not.toBeNull()
            expect(map.get(e2)).toBeNull()
        })

        test('empty entries array returns empty map', () => {
            expect(service.resolveAllAnchors([]).size).toBe(0)
        })
    })

    // ─── findDateProperties ───────────────────────────────────────────────────

    describe('findDateProperties', () => {
        test('returns property IDs where at least one entry has a date-like value', () => {
            const entry = makeEntry('my-note', {
                getValue: (id) => {
                    if (id === ('note.date' as BasesPropertyId)) return '2024-01-01'
                    return null
                }
            })
            const result = service.findDateProperties([entry], [
                'note.date',
                'note.energy'
            ] as BasesPropertyId[])
            expect(result).toContain('note.date')
            expect(result).not.toContain('note.energy')
        })

        test('skips file.* properties', () => {
            const entry = makeEntry('my-note', {
                getValue: () => '2024-01-01'
            })
            const result = service.findDateProperties([entry], [
                'file.created',
                'note.date'
            ] as BasesPropertyId[])
            expect(result).not.toContain('file.created')
        })

        test('returns empty array when no entries have date-like values', () => {
            const entry = makeEntry('my-note', { getValue: () => 'not-a-date-value' })
            const result = service.findDateProperties([entry], ['note.energy'] as BasesPropertyId[])
            expect(result).toHaveLength(0)
        })
    })

    // ─── config factory helpers ───────────────────────────────────────────────

    describe('config factories', () => {
        test('createPropertyConfig returns correct shape', () => {
            const cfg = service.createPropertyConfig('note.date' as BasesPropertyId, 3)
            expect(cfg.source.type).toBe('property')
            expect(cfg.priority).toBe(3)
        })

        test('createFilenameConfig returns correct shape', () => {
            const cfg = service.createFilenameConfig(1)
            expect(cfg.source.type).toBe('filename')
            expect(cfg.priority).toBe(1)
        })

        test('createMetadataConfig returns correct shape', () => {
            const cfg = service.createMetadataConfig('mtime', 5)
            expect(cfg.source.type).toBe('file-metadata')
            if (cfg.source.type === 'file-metadata') {
                expect(cfg.source.field).toBe('mtime')
            }
            expect(cfg.priority).toBe(5)
        })
    })
})
