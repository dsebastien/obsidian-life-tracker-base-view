import type { App, EventRef } from 'obsidian'
import { folderAncestry, log } from '../../utils'
import {
    TEMPLATER_PLUGIN_ID,
    templaterWillAutoApply,
    type TemplaterAutoFireSettings
} from '../../utils/templater-autofire.utils'
import type { NoteTargetResolution } from './note-target.service'

/**
 * How long to wait for Templater's own creation hook to template a new note.
 *
 * That hook sleeps 300ms before it even reads the file, then writes. Frontmatter
 * written meanwhile races it and loses, so creation waits for the file's first
 * modification. The timeout bounds the wait when no modification ever comes —
 * an ignored folder, a template that renders nothing, a trigger that did not
 * fire after all. It is the abnormal path, not the expected one.
 *
 * Generous because a template may open a suggester and sit waiting for the user.
 */
const TEMPLATE_SETTLE_TIMEOUT_MS = 15000

/**
 * How long to wait for the metadata cache to index a note a template just wrote.
 *
 * The vault reports the write before the cache has parsed it. A capture opened
 * in that gap sees a note with no frontmatter and no tags, so every tag-mapped
 * property definition fails to apply and the modal reports "No matching
 * properties" on a note that is, on disk, complete. Indexing takes milliseconds;
 * the bound only covers a template that writes no frontmatter at all.
 */
const METADATA_SETTLE_TIMEOUT_MS = 3000

/** The bits of the Templater plugin instance this service uses */
interface TemplaterPluginInstance {
    templater?: {
        create_new_note_from_template?: (
            template: VaultPath | string,
            folder?: string,
            filename?: string,
            openNewNote?: boolean
        ) => Promise<VaultPath | undefined>
    }
    settings?: TemplaterAutoFireSettings
}

/**
 * The slice of `App` this service uses.
 *
 * Narrower than `App` on purpose: the real `App` satisfies it structurally, so
 * production passes one unchanged, while a test can build a plain object that
 * type-checks without a single cast. Casting a stub to `App` would need the
 * `as unknown as` the repo's pre-commit hook refuses, in specs as much as in
 * shipped code.
 */
export interface NoteCreationHost {
    vault: {
        getFileByPath(path: string): VaultPath | null
        getFolderByPath(path: string): VaultPath | null
        createFolder(path: string): Promise<VaultPath>
        create(path: string, data: string): Promise<VaultPath>
        on(name: 'modify', callback: (file: VaultPath) => void): EventRef
        offref(ref: EventRef): void
    }
    metadataCache: {
        getFileCache(file: VaultPath): IndexedMetadata | null
        on(name: 'changed', callback: (file: VaultPath) => void): EventRef
        offref(ref: EventRef): void
    }
    plugins?: App['plugins']
}

/** The one thing this service reads from a cached metadata entry */
export interface IndexedMetadata {
    frontmatter?: unknown
}

/**
 * All this service needs of a vault file or folder.
 *
 * `TFile` and `TFolder` satisfy it, so production passes the real `App`
 * untouched. Declaring the narrow shape keeps the seam honest and lets tests
 * build stubs without casting to `TFile`, which the community catalog's
 * `no-tfile-tfolder-cast` rule rightly refuses.
 */
export interface VaultPath {
    path: string
}

/** Outcome of asking for a note at a resolved target */
export interface NoteCreationOutcome {
    /**
     * Vault path of the note. A path rather than a `TFile` so this service
     * never has to manufacture one; the caller resolves it against the vault,
     * which is also the freshest source after Templater has written.
     */
    path: string
    /** False when the note already existed and was reused */
    created: boolean
}

/**
 * Creates the periodic note a capture needs when the vault has none (issue
 * #160).
 *
 * Never overwrites: an existing file at the target path is reused. The caller
 * writes frontmatter afterwards, and does so only once this service has
 * returned, by which point any template has been applied.
 */
export class NoteCreationService {
    /**
     * `settleTimeoutMs` is injectable so tests do not have to spend the real
     * timeout waiting for a modification they control.
     */
    constructor(
        private readonly app: NoteCreationHost,
        private readonly settleTimeoutMs: number = TEMPLATE_SETTLE_TIMEOUT_MS,
        private readonly metadataTimeoutMs: number = METADATA_SETTLE_TIMEOUT_MS
    ) {}

    /** The Templater plugin instance, or null when absent or disabled */
    private getTemplater(): TemplaterPluginInstance | null {
        const registry = this.app.plugins
        if (!registry?.enabledPlugins?.has(TEMPLATER_PLUGIN_ID)) return null

        const instance = registry.plugins?.[TEMPLATER_PLUGIN_ID]
        if (!instance || typeof instance !== 'object') return null
        return instance as TemplaterPluginInstance
    }

    /**
     * Create every missing folder on the way to `folder`.
     *
     * Obsidian does not create intermediate folders and throws when asked for
     * one that exists, so each level is checked before it is created.
     */
    private async ensureFolder(folder: string): Promise<void> {
        for (const path of folderAncestry(folder)) {
            if (this.app.vault.getFolderByPath(path)) continue
            try {
                await this.app.vault.createFolder(path)
            } catch (error: unknown) {
                // A concurrent creation (another plugin, a sync) is a race we
                // lost harmlessly: the folder now exists either way.
                if (!this.app.vault.getFolderByPath(path)) throw error
            }
        }
    }

    /**
     * Start listening for the modification that means a template has been
     * applied to `path`, and return a promise that settles on it or on timeout.
     *
     * Called **before** the file is created. Templater's hook fires on its own
     * schedule, and a listener registered after the write would miss an event
     * that had already happened, turning every creation into a full timeout.
     */
    private watchForTemplate(path: string): Promise<void> {
        return new Promise<void>((resolve) => {
            let settled = false
            const finish = (): void => {
                if (settled) return
                settled = true
                this.app.vault.offref(eventRef)
                window.clearTimeout(timer)
                resolve()
            }

            const eventRef = this.app.vault.on('modify', (modified) => {
                if (modified.path === path) finish()
            })
            const timer = window.setTimeout(finish, this.settleTimeoutMs)
        })
    }

    /**
     * Wait until the metadata cache has indexed a templated note.
     *
     * Everything downstream of creation — the capture modal, property
     * recognition, the frontmatter reader — works from the cache, not the file.
     * The cache parses a write asynchronously, so "Templater has written" does
     * not yet mean "the note's tags and properties are visible". Resolves at
     * once when frontmatter is already indexed, otherwise on the next index of
     * this path, bounded by a timeout for templates that carry no frontmatter.
     */
    private awaitMetadata(file: VaultPath): Promise<void> {
        if (this.app.metadataCache.getFileCache(file)?.frontmatter) return Promise.resolve()

        return new Promise<void>((resolve) => {
            let settled = false
            const finish = (): void => {
                if (settled) return
                settled = true
                this.app.metadataCache.offref(eventRef)
                window.clearTimeout(timer)
                resolve()
            }

            const eventRef = this.app.metadataCache.on('changed', (changed) => {
                if (changed.path === file.path) finish()
            })
            const timer = window.setTimeout(finish, this.metadataTimeoutMs)
        })
    }

    /**
     * Get or create the note at a resolved target.
     *
     * Templating follows one rule: the template is applied exactly once. When
     * Templater is configured to template new files itself, the file is created
     * plainly and Templater does the work — applying the configured template on
     * top would duplicate the note's whole contents. Otherwise Templater is
     * driven explicitly. With no Templater at all the note is still created,
     * empty, because the captured properties matter more than the template.
     */
    async ensureNote(resolution: NoteTargetResolution): Promise<NoteCreationOutcome | null> {
        const { path, folder } = resolution.target

        if (this.app.vault.getFileByPath(path)) return { path, created: false }

        try {
            await this.ensureFolder(folder)
        } catch (error: unknown) {
            log('Could not create the folder for a new note', 'error', { folder, error })
            return null
        }

        const templater = this.getTemplater()
        const autoApplies = templaterWillAutoApply(templater?.settings ?? null, path)
        const templateFile =
            resolution.templatePath !== null && !autoApplies
                ? this.app.vault.getFileByPath(resolution.templatePath)
                : null

        if (resolution.templatePath !== null && !autoApplies && !templateFile) {
            log('Configured template not found; creating the note without it', 'warn', {
                templatePath: resolution.templatePath
            })
        }

        if (templateFile) {
            // Templater's own creation hook skips files it is creating itself,
            // and `create_new_note_from_template` has written the template
            // before it resolves. Nothing to wait for.
            const result = await this.createFromTemplate(templateFile, path, folder)
            if (!result) return null
            const { file: created, templated } = result
            if (created.path !== path) {
                // Templater picks an available path, so a file appearing between
                // the check above and here yields a numbered sibling rather than
                // the note that was asked for.
                log('Templater created a different path than the one resolved', 'warn', {
                    expected: path,
                    actual: created.path
                })
            }
            // A note that fell back to empty has nothing for the cache to index
            if (templated) await this.awaitMetadata(created)
            return { path: created.path, created: true }
        }

        // Start watching before creating: Templater's hook may fire the moment
        // the file exists, and a listener attached afterwards would miss it.
        const settled = autoApplies ? this.watchForTemplate(path) : null

        const created = await this.createEmpty(path)
        if (!created) {
            void settled
            return null
        }

        if (settled) {
            await settled
            await this.awaitMetadata(created)
        }

        return { path: created.path, created: true }
    }

    /**
     * Create through Templater so `<% %>` commands are executed, not copied.
     *
     * `templated` is false when the note fell back to an empty file, which
     * carries nothing worth waiting for the metadata cache to index.
     */
    private async createFromTemplate(
        templateFile: VaultPath,
        path: string,
        folder: string
    ): Promise<{ file: VaultPath; templated: boolean } | null> {
        const templater = this.getTemplater()
        const create = templater?.templater?.create_new_note_from_template
        if (!templater?.templater || !create) return this.untemplated(await this.createEmpty(path))

        // Templater appends the extension itself
        const basename = path.slice(folder.length > 0 ? folder.length + 1 : 0).replace(/\.md$/, '')

        try {
            const file = await create.call(
                templater.templater,
                templateFile,
                folder,
                basename,
                false
            )
            if (file) return { file, templated: true }
            log('Templater created no file; falling back to an untemplated note', 'warn')
        } catch (error: unknown) {
            log('Templater failed; falling back to an untemplated note', 'warn', error)
        }

        // Templater may have created the file before failing partway through.
        return this.untemplated(
            this.app.vault.getFileByPath(path) ?? (await this.createEmpty(path))
        )
    }

    private untemplated(file: VaultPath | null): { file: VaultPath; templated: false } | null {
        return file ? { file, templated: false } : null
    }

    /** Create a plain empty note */
    private async createEmpty(path: string): Promise<VaultPath | null> {
        try {
            return await this.app.vault.create(path, '')
        } catch (error: unknown) {
            // Lost a race, or the path became unusable. Reuse whatever is there.
            const existing = this.app.vault.getFileByPath(path)
            if (existing) return existing
            log('Could not create the note', 'error', { path, error })
            return null
        }
    }
}
