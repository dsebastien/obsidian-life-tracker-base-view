import type { App, EventRef } from 'obsidian'
import { folderAncestry, log } from '../../utils'
import {
    TEMPLATER_PLUGIN_ID,
    templaterWillAutoApply,
    type TemplaterAutoFireSettings
} from '../../utils/templater-autofire.utils'
import type { NoteTargetResolution } from './note-target.service'

/**
 * How long to wait for Templater to finish writing a freshly created note.
 *
 * Templater templates asynchronously and returns before the file has settled.
 * Writing frontmatter into it meanwhile races that write and loses data, so
 * creation waits for the file's first modification. The timeout only bounds the
 * wait for a template that produces no change (an empty template, or a
 * Templater that declined the file); it is not the expected path.
 */
const TEMPLATE_SETTLE_TIMEOUT_MS = 3000

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
    plugins?: App['plugins']
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
        private readonly settleTimeoutMs: number = TEMPLATE_SETTLE_TIMEOUT_MS
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
     * Resolve when the file is next modified, or when the wait times out.
     *
     * Used to let Templater finish before frontmatter is written into the note.
     */
    private waitForTemplateToSettle(file: VaultPath): Promise<void> {
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
                if (modified.path === file.path) finish()
            })
            const timer = window.setTimeout(finish, this.settleTimeoutMs)
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

        const created = templateFile
            ? await this.createFromTemplate(templateFile, resolution.target.path, folder)
            : await this.createEmpty(path)

        if (!created) return null

        // Templater writes after returning, whether it was driven explicitly or
        // fired on its own. Settle before the caller writes frontmatter.
        if (templateFile || autoApplies) {
            await this.waitForTemplateToSettle(created)
        }

        return { path: created.path, created: true }
    }

    /** Create through Templater so `<% %>` commands are executed, not copied */
    private async createFromTemplate(
        templateFile: VaultPath,
        path: string,
        folder: string
    ): Promise<VaultPath | null> {
        const templater = this.getTemplater()
        const create = templater?.templater?.create_new_note_from_template
        if (!templater?.templater || !create) return this.createEmpty(path)

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
            if (file) return file
            log('Templater created no file; falling back to an untemplated note', 'warn')
        } catch (error: unknown) {
            log('Templater failed; falling back to an untemplated note', 'warn', error)
        }

        // Templater may have created the file before failing partway through.
        return this.app.vault.getFileByPath(path) ?? (await this.createEmpty(path))
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
