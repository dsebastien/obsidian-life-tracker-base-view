import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { EventRef } from 'obsidian'
import { NoteCreationService, type NoteCreationHost, type VaultPath } from './note-creation.service'
import type { NoteTargetResolution } from './note-target.service'

const TARGET_PATH = '40 Journal/41 Daily Notes/2026/35/2026-08-30.md'
const TARGET_FOLDER = '40 Journal/41 Daily Notes/2026/35'
const TEMPLATE_PATH = '50 Resources/54 Templates/Templater/TPL Daily Note.md'

function resolution(overrides: Partial<NoteTargetResolution> = {}): NoteTargetResolution {
    return {
        target: { path: TARGET_PATH, folder: TARGET_FOLDER },
        templatePath: TEMPLATE_PATH,
        mandatoryTags: [],
        source: 'starter-kit',
        ...overrides
    }
}

const DISPATCHER_SETTINGS = {
    trigger_on_file_creation: true,
    enable_folder_templates: true,
    folder_templates: [{ folder: '/', template: TEMPLATE_PATH }]
}

interface VaultState {
    files: Map<string, VaultPath>
    folders: Set<string>
    createdFolders: string[]
    createCalls: string[]
    templaterCalls: unknown[][]
    emitModify: (path: string) => void
}

function createApp(
    options: {
        existingFiles?: string[]
        existingFolders?: string[]
        templaterEnabled?: boolean
        templaterSettings?: unknown
        /** Templater's create_new_note_from_template behavior */
        templaterCreate?: (path: string) => VaultPath | undefined | Promise<VaultPath | undefined>
        createThrows?: boolean
        createFolderThrows?: boolean
    } = {}
): { app: NoteCreationHost; state: VaultState } {
    const {
        existingFiles = [TEMPLATE_PATH],
        existingFolders = [],
        templaterEnabled = false,
        templaterSettings,
        templaterCreate,
        createThrows = false,
        createFolderThrows = false
    } = options

    const makeFile = (path: string): VaultPath => ({ path })

    const files = new Map<string, VaultPath>(existingFiles.map((p) => [p, makeFile(p)]))
    const folders = new Set<string>(existingFolders)
    const createdFolders: string[] = []
    const createCalls: string[] = []
    const templaterCalls: unknown[][] = []
    let modifyHandler: ((file: VaultPath) => void) | null = null

    const templaterInstance = {
        settings: templaterSettings,
        templater: {
            create_new_note_from_template: mock(async (...args: unknown[]) => {
                templaterCalls.push(args)
                if (!templaterCreate) {
                    const file = makeFile(TARGET_PATH)
                    files.set(TARGET_PATH, file)
                    return file
                }
                return await templaterCreate(TARGET_PATH)
            })
        }
    }

    const app: NoteCreationHost = {
        plugins: {
            enabledPlugins: new Set(templaterEnabled ? ['templater-obsidian'] : []),
            plugins: { 'templater-obsidian': templaterInstance }
        },
        vault: {
            getFileByPath: (path: string): VaultPath | null => files.get(path) ?? null,
            getFolderByPath: (path: string): VaultPath | null =>
                folders.has(path) ? { path } : null,
            createFolder: async (path: string): Promise<VaultPath> => {
                if (createFolderThrows) throw new Error('permission denied')
                createdFolders.push(path)
                folders.add(path)
                return { path }
            },
            create: async (path: string, _content: string): Promise<VaultPath> => {
                createCalls.push(path)
                if (createThrows) throw new Error('cannot create')
                const file = makeFile(path)
                files.set(path, file)
                return file
            },
            on: (_event: 'modify', handler: (file: VaultPath) => void): EventRef => {
                modifyHandler = handler
                return {}
            },
            offref: (): void => undefined
        }
    }

    return {
        app,
        state: {
            files,
            folders,
            createdFolders,
            createCalls,
            templaterCalls,
            emitModify: (path: string) => modifyHandler?.({ path })
        }
    }
}

beforeEach(() => {
    // The service uses window timers per the repo's catalog conventions
    const scope: { window?: unknown } = globalThis
    scope.window ??= globalThis
})

describe('reusing what already exists', () => {
    test('an existing note is reused and never overwritten', async () => {
        const { app, state } = createApp({ existingFiles: [TEMPLATE_PATH, TARGET_PATH] })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(outcome?.created).toBe(false)
        expect(outcome?.path).toBe(TARGET_PATH)
        expect(state.createCalls).toEqual([])
        expect(state.createdFolders).toEqual([])
    })
})

describe('folder creation', () => {
    test('creates every missing folder on the way to the note', async () => {
        const { app, state } = createApp()

        await new NoteCreationService(app, 5).ensureNote(resolution())

        // The format contributes 2026/35; creating only the configured folder
        // would leave vault.create throwing on a missing parent
        expect(state.createdFolders).toEqual([
            '40 Journal',
            '40 Journal/41 Daily Notes',
            '40 Journal/41 Daily Notes/2026',
            '40 Journal/41 Daily Notes/2026/35'
        ])
    })

    test('skips folders that already exist', async () => {
        const { app, state } = createApp({
            existingFolders: ['40 Journal', '40 Journal/41 Daily Notes']
        })

        await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(state.createdFolders).toEqual([
            '40 Journal/41 Daily Notes/2026',
            '40 Journal/41 Daily Notes/2026/35'
        ])
    })

    test('a note at the vault root needs no folder', async () => {
        const { app, state } = createApp()

        await new NoteCreationService(app, 5).ensureNote(
            resolution({ target: { path: '2026-08-30.md', folder: '' }, templatePath: null })
        )

        expect(state.createdFolders).toEqual([])
        expect(state.createCalls).toEqual(['2026-08-30.md'])
    })

    test('a folder that cannot be created aborts rather than creating a stray note', async () => {
        const { app, state } = createApp({ createFolderThrows: true })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(outcome).toBeNull()
        expect(state.createCalls).toEqual([])
    })
})

describe('templating', () => {
    test('drives Templater explicitly when it will not fire on its own', async () => {
        const { app, state } = createApp({
            templaterEnabled: true,
            templaterSettings: { trigger_on_file_creation: false }
        })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())
        expect(outcome?.created).toBe(true)

        expect(state.templaterCalls).toHaveLength(1)
        // template, folder, basename without extension, don't open
        expect(state.templaterCalls[0]?.[1]).toBe(TARGET_FOLDER)
        expect(state.templaterCalls[0]?.[2]).toBe('2026-08-30')
        expect(state.templaterCalls[0]?.[3]).toBe(false)
        expect(state.createCalls).toEqual([])
    })

    test('does NOT apply a template when Templater already templates new files', async () => {
        // The reference vault: trigger_on_file_creation with a folder template
        // on '/'. Applying the configured template here would duplicate the
        // entire note.
        const { app, state } = createApp({
            templaterEnabled: true,
            templaterSettings: DISPATCHER_SETTINGS
        })

        const service = new NoteCreationService(app, 5)
        const pending = service.ensureNote(resolution())
        state.emitModify(TARGET_PATH)
        const outcome = await pending

        expect(state.templaterCalls).toEqual([])
        expect(state.createCalls).toEqual([TARGET_PATH])
        expect(outcome?.created).toBe(true)
    })

    test('creates the note anyway when Templater is not installed', async () => {
        const { app, state } = createApp({ templaterEnabled: false })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        // The captured properties matter more than the template
        expect(outcome?.created).toBe(true)
        expect(state.createCalls).toEqual([TARGET_PATH])
    })

    test('creates the note anyway when the configured template is missing', async () => {
        const { app, state } = createApp({
            existingFiles: [],
            templaterEnabled: true,
            templaterSettings: { trigger_on_file_creation: false }
        })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(outcome?.created).toBe(true)
        expect(state.templaterCalls).toEqual([])
        expect(state.createCalls).toEqual([TARGET_PATH])
    })

    test('falls back to a plain note when Templater throws', async () => {
        const { app, state } = createApp({
            templaterEnabled: true,
            templaterSettings: { trigger_on_file_creation: false },
            templaterCreate: () => {
                throw new Error('template evaluation failed')
            }
        })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(outcome?.created).toBe(true)
        expect(state.createCalls).toEqual([TARGET_PATH])
    })

    test('reuses the file when Templater created it before failing', async () => {
        const { app, state } = createApp({
            templaterEnabled: true,
            templaterSettings: { trigger_on_file_creation: false },
            templaterCreate: (path) => {
                state.files.set(path, { path })
                throw new Error('failed after creating')
            }
        })

        const outcome = await new NoteCreationService(app, 5).ensureNote(resolution())

        expect(outcome?.path).toBe(TARGET_PATH)
        // Must not try to create over the file Templater already made
        expect(state.createCalls).toEqual([])
    })

    test('no template configured means a plain note and no waiting', async () => {
        const { app, state } = createApp({ templaterEnabled: true })

        const outcome = await new NoteCreationService(app, 5).ensureNote(
            resolution({ templatePath: null })
        )

        expect(outcome?.created).toBe(true)
        expect(state.createCalls).toEqual([TARGET_PATH])
    })
})

describe('failures', () => {
    test('returns null when the note cannot be created at all', async () => {
        const { app } = createApp({ templatePath: undefined, createThrows: true } as never)

        const outcome = await new NoteCreationService(app, 5).ensureNote(
            resolution({ templatePath: null })
        )

        expect(outcome).toBeNull()
    })
})
