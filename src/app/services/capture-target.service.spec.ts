import { describe, expect, test } from 'bun:test'
import { createCaptureTarget, type CaptureTarget, type StarterKitNoteType } from '../types'
import {
    CaptureTargetService,
    type CaptureTargetHost,
    type TargetFileLike
} from './capture-target.service'
import { describeTargetIssues } from './capture-target.utils'

const TYPE_ID = 'nt-strength'
const FOLDER = 'Sessions/Strength/2026'

const STRENGTH_TYPE: StarterKitNoteType = {
    id: TYPE_ID,
    name: 'Strength Sessions',
    description: '',
    icon: null,
    mappings: [{ type: 'tag', value: 'type/session/sport/strength', enabled: true }],
    properties: [],
    associatedFolder: 'Sessions/Strength/{{year}}',
    templatePath: 'Templates/Strength.md',
    noteNamePrefix: null,
    noteNameSuffix: ' (Strength Session)',
    tags: ['zone/journal', 'type/session/sport/strength']
}

const TARGET: CaptureTarget = {
    ...createCaptureTarget('t1', 'Through the day'),
    noteTypeId: TYPE_ID,
    filters: [{ property: 'workout_kind', value: 'Through the day' }]
}

const NOV_3 = new Date(2026, 10, 3)

interface FakeFile extends TargetFileLike {
    /** What the metadata cache holds */
    frontmatter: Record<string, unknown>
    /** What is on disk, when it differs from the cache (a lagging index) */
    disk?: Record<string, unknown>
}

function file(
    name: string,
    frontmatter: Record<string, unknown>,
    mtime = 1,
    folder = FOLDER
): FakeFile {
    return {
        path: `${folder}/${name}.md`,
        basename: name,
        extension: 'md',
        stat: { mtime },
        parent: { path: folder },
        frontmatter
    }
}

/** A vault holding `files`, with folders derived from their paths */
function createHost(
    files: FakeFile[]
): CaptureTargetHost<FakeFile> & { scanned: string[]; reads: string[] } {
    const scanned: string[] = []
    const reads: string[] = []
    const childrenOf = (folder: string): unknown[] => {
        const direct = files.filter((f) => f.parent?.path === folder)
        const subfolders = new Set<string>()
        for (const f of files) {
            const parent = f.parent?.path ?? ''
            if (!parent.startsWith(`${folder}/`)) continue
            const next = parent.slice(folder.length + 1).split('/')[0] ?? ''
            subfolders.add(`${folder}/${next}`)
        }
        return [
            ...direct,
            ...[...subfolders].map((path) => ({ path, children: childrenOf(path) })),
            { path: `${folder}/image.png`, extension: 'png' }
        ]
    }
    return {
        scanned,
        reads,
        vault: {
            getFolderByPath: (path) => {
                scanned.push(path)
                const exists = files.some(
                    (f) => f.parent?.path === path || f.parent?.path.startsWith(`${path}/`)
                )
                return exists ? { children: childrenOf(path) } : null
            },
            getFileByPath: (path) => files.find((f) => f.path === path) ?? null,
            cachedRead: (f) => {
                reads.push(f.path)
                return Promise.resolve(JSON.stringify(f.disk ?? f.frontmatter))
            }
        },
        metadataCache: {
            getFileCache: (f) => ({ frontmatter: f.frontmatter })
        },
        fileManager: {
            processFrontMatter: (f, fn) => {
                fn(f.frontmatter)
                return Promise.resolve()
            }
        }
    }
}

function service(files: FakeFile[]): {
    host: ReturnType<typeof createHost>
    service: CaptureTargetService<FakeFile>
} {
    const host = createHost(files)
    return {
        host,
        service: new CaptureTargetService(
            host,
            (id) => (id === TYPE_ID ? STRENGTH_TYPE : null),
            parseJson
        )
    }
}

/** Test stand-in for frontmatter parsing: the fake disk holds JSON */
function parseJson(content: string): Record<string, unknown> | null {
    const parsed: unknown = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
}

const STRENGTH_TAGS = { tags: ['zone/journal', 'type/session/sport/strength'] }

describe('findNote', () => {
    test('finds the through-the-day note next to a gym session, scanning only that year', () => {
        const gym = file(
            '2026-11-03 (Strength Session)',
            { ...STRENGTH_TAGS, date: '2026-11-03', workout_kind: 'Full body' },
            9
        )
        const through = file('2026-11-03 2 (Strength Session)', {
            ...STRENGTH_TAGS,
            date: '2026-11-03',
            workout_kind: 'Through the day'
        })
        const { host, service: s } = service([gym, through])

        expect(s.findNote(TARGET, NOV_3)).toBe(through)
        expect(host.scanned).toEqual([FOLDER])
    })

    test('walks subfolders, accepts a tags string, and ignores non-markdown files', () => {
        const nested = file(
            'quick',
            {
                tags: 'zone/journal type/session/sport/strength',
                date: '2026-11-03',
                workout_kind: 'Through the day'
            },
            1,
            `${FOLDER}/November`
        )
        expect(service([nested]).service.findNote(TARGET, NOV_3)).toBe(nested)
    })

    test('null when the folder does not exist or the type is unavailable', () => {
        expect(service([]).service.findNote(TARGET, NOV_3)).toBeNull()
        const host = createHost([])
        expect(
            new CaptureTargetService(host, () => null, parseJson).findNote(TARGET, NOV_3)
        ).toBeNull()
    })
})

describe('planCreation', () => {
    test('never reuses the plain path when a gym session holds it', () => {
        const gym = file('2026-11-03 (Strength Session)', {
            ...STRENGTH_TAGS,
            workout_kind: 'Full body'
        })
        const result = service([gym]).service.planCreation(TARGET, NOV_3)

        expect(result).toEqual({
            ok: true,
            plan: {
                resolution: {
                    target: {
                        path: `${FOLDER}/2026-11-03 2 (Strength Session).md`,
                        folder: FOLDER
                    },
                    templatePath: 'Templates/Strength.md',
                    mandatoryTags: ['zone/journal', 'type/session/sport/strength'],
                    source: 'starter-kit'
                },
                layout: expect.anything() as never,
                warnUndiscoverable: false
            }
        })
    })

    test('explains an unusable target', () => {
        const result = service([]).service.planCreation({ ...TARGET, noteTypeId: '' }, NOV_3)
        expect(result).toEqual({
            ok: false,
            error: 'Capture target "Through the day" has no folder.'
        })
    })

    test('a standalone target is sourced as a capture target', () => {
        const result = service([]).service.planCreation(
            {
                ...TARGET,
                noteTypeId: '',
                folder: 'Moves/{{year}}',
                fileNamePattern: '{{date}} moves'
            },
            NOV_3
        )
        expect(result.ok && result.plan.resolution).toEqual({
            target: { path: 'Moves/2026/2026-11-03 moves.md', folder: 'Moves/2026' },
            templatePath: null,
            mandatoryTags: [],
            source: 'capture-target'
        })
    })

    test('refuses a name the settings page lists as a problem, with the same message', () => {
        const target = { ...TARGET, noteTypeFileName: '{{date}} {{time}}' }
        const result = service([]).service.planCreation(target, NOV_3)
        const [problem] = describeTargetIssues(target, STRENGTH_TYPE, NOV_3)
        expect(problem).toContain('does not give a valid note path')
        expect(result).toEqual({ ok: false, error: problem ?? '' })
    })

    test('refuses a folder in the file name, with the Problems message', () => {
        const target = { ...TARGET, noteTypeFileName: '{{year}}/{{date}}' }
        const result = service([]).service.planCreation(target, NOV_3)
        expect(result).toEqual({
            ok: false,
            error: describeTargetIssues(target, STRENGTH_TYPE, NOV_3)[0] ?? ''
        })
    })
})

describe('writeCreationValues', () => {
    test('writes the date, the filter values and merges tags into the new note', async () => {
        const created = file('2026-11-03 (Strength Session)', { tags: ['zone/journal'], rpe: null })
        const { service: s } = service([created])
        const plan = s.planCreation(TARGET, NOV_3)
        if (!plan.ok) throw new Error('expected a plan')

        expect(await s.writeCreationValues(created, TARGET, plan.plan.layout, NOV_3)).toBe(true)
        expect(created.frontmatter).toEqual({
            tags: ['zone/journal', 'type/session/sport/strength'],
            rpe: null,
            date: '2026-11-03',
            workout_kind: 'Through the day'
        })
    })

    test('a failed write is reported, not thrown', async () => {
        const created = file('x', {})
        const host = createHost([created])
        host.fileManager.processFrontMatter = (): Promise<void> =>
            Promise.reject(new Error('locked'))
        const s = new CaptureTargetService(host, () => STRENGTH_TYPE, parseJson)
        const plan = s.planCreation(TARGET, NOV_3)
        if (!plan.ok) throw new Error('expected a plan')
        expect(await s.writeCreationValues(created, TARGET, plan.plan.layout, NOV_3)).toBe(false)
    })
})

describe('a note the cache has not indexed yet (vault bug: a second note offered)', () => {
    const THROUGH = {
        ...STRENGTH_TAGS,
        date: '2030-01-02',
        workout_kind: 'Through the day'
    }
    const JAN_2 = new Date(2030, 0, 2)
    const folder = 'Sessions/Strength/2030'

    test('the cache alone misses it; the verified lookup reads the disk and finds it', async () => {
        const gym = file(
            '2030-01-02 (Strength Session)',
            { ...STRENGTH_TAGS, date: '2030-01-02', workout_kind: 'Full body' },
            1,
            folder
        )
        // Created and filled, but still indexed as the empty file it started as
        const through = file('2030-01-02 2 (Strength Session)', {}, 2, folder)
        through.disk = THROUGH
        const { service: s } = service([gym, through])

        expect(s.findNote(TARGET, JAN_2)).toBeNull()
        expect(await s.findNoteVerified(TARGET, JAN_2)).toBe(through)
    })

    test('the verified lookup still never picks the gym session', async () => {
        const gym = file(
            '2030-01-02 (Strength Session)',
            { ...STRENGTH_TAGS, date: '2030-01-02', workout_kind: 'Full body' },
            1,
            folder
        )
        expect(await service([gym]).service.findNoteVerified(TARGET, JAN_2)).toBeNull()
    })

    test('isIndexedAsTargetNote is false until the cache shows the written values', () => {
        const through = file('2030-01-02 2 (Strength Session)', {}, 2, folder)
        const { service: s } = service([through])
        expect(s.isIndexedAsTargetNote(through, TARGET, JAN_2)).toBe(false)
        through.frontmatter = THROUGH
        expect(s.isIndexedAsTargetNote(through, TARGET, JAN_2)).toBe(true)
    })
})

describe('planCreation refuses a note it would never find again (review #4)', () => {
    test('a regex mapping the numbered name breaks', () => {
        const regexType: StarterKitNoteType = {
            ...STRENGTH_TYPE,
            mappings: [
                {
                    type: 'regex',
                    value: '^\\d{4}-\\d{2}-\\d{2} \\(Strength Session\\)$',
                    enabled: true
                }
            ]
        }
        const gym = file('2026-11-03 (Strength Session)', { workout_kind: 'Full body' })
        const host = createHost([gym])
        const s = new CaptureTargetService(host, () => regexType, parseJson)

        const result = s.planCreation(TARGET, NOV_3)
        expect(result.ok).toBe(false)
        expect(!result.ok && result.error).toContain('would not be recognized')
    })

    test('a note without a readable date is refused', () => {
        const result = service([]).service.planCreation(
            {
                ...TARGET,
                noteTypeId: '',
                folder: 'Moves',
                fileNamePattern: 'Moves {{date}}',
                dateProperty: ''
            },
            NOV_3
        )
        // No date property, and "Moves 2026-11-03" does not start with the date
        expect(result.ok).toBe(false)
        expect(!result.ok && result.error).toContain('no date')
    })
})

describe('the disk fallback reads only likely candidates (review #5)', () => {
    test('old, indexed notes of other days are not read', async () => {
        const now = Date.now()
        const old = file(
            '2026-10-01 (Strength Session)',
            { ...STRENGTH_TAGS, date: '2026-10-01' },
            now - 86_400_000
        )
        const recent = file('Renamed session', { ...STRENGTH_TAGS, date: '2026-10-02' }, now)
        const sameDay = file(
            '2026-11-03 (Strength Session)',
            { ...STRENGTH_TAGS, date: '2026-11-03', workout_kind: 'Full body' },
            now - 86_400_000
        )
        const { host, service: s } = service([old, recent, sameDay])

        expect(await s.findNoteVerified(TARGET, NOV_3)).toBeNull()
        expect(host.reads.sort()).toEqual([recent.path, sameDay.path].sort())
    })

    test('an unindexed note is read whatever its name and age', async () => {
        const unindexed = file('Untitled', {}, 0)
        unindexed.disk = { ...STRENGTH_TAGS, date: '2026-11-03', workout_kind: 'Through the day' }
        const { host, service: s } = service([unindexed])
        const cache = host.metadataCache
        host.metadataCache = {
            getFileCache: (f) => (f === unindexed ? null : cache.getFileCache(f))
        }
        expect(await s.findNoteVerified(TARGET, NOV_3)).toBe(unindexed)
    })
})
