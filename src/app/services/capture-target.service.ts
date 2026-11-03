import type { CaptureTarget, StarterKitNoteType } from '../types'
import { log } from '../../utils'
import type { NoteTargetResolution } from './note-target.service'
import {
    buildCreationFrontmatter,
    describeLayoutError,
    describeTargetLayout,
    isTargetLayout,
    needsDiscoverabilityWarning,
    pickTargetNote,
    renderTargetFolder,
    resolveFreeTargetPath,
    type TargetLayout,
    type TargetNoteCandidate
} from './capture-target.utils'

/** All this service needs of a vault file; `TFile` satisfies it */
export interface TargetFileLike {
    path: string
    basename: string
    extension: string
    stat: { mtime: number }
    parent: { path: string } | null
}

/**
 * The slice of `App` this service uses. The real `App` satisfies it, and a
 * test builds a plain object without casting (see `NoteCreationHost`).
 */
export interface CaptureTargetHost<F extends TargetFileLike> {
    vault: {
        getFolderByPath(path: string): { children: readonly unknown[] } | null
        getFileByPath(path: string): F | null
        /** Read a file from disk, bypassing the metadata cache */
        read(file: F): Promise<string>
    }
    metadataCache: {
        getFileCache(file: F): { frontmatter?: unknown } | null
    }
    fileManager: {
        processFrontMatter(
            file: F,
            fn: (frontmatter: Record<string, unknown>) => void
        ): Promise<void>
    }
}

/** A creation that can go ahead: where, with which template, and the layout */
export interface TargetCreationPlan {
    resolution: NoteTargetResolution
    layout: TargetLayout
    /** True when the note will not be dated in views (no date property, unparseable name) */
    warnUndiscoverable: boolean
}

export type TargetCreationPlanResult =
    | { ok: true; plan: TargetCreationPlan }
    | { ok: false; error: string }

/** Frontmatter tags as strings, `#` kept as written */
function readTags(frontmatter: Record<string, unknown>): string[] {
    const raw = frontmatter['tags']
    if (Array.isArray(raw)) return raw.filter((tag): tag is string => typeof tag === 'string')
    if (typeof raw === 'string') {
        return raw
            .split(/[,\s]+/)
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0)
    }
    return []
}

/** A lookup candidate from a file and its frontmatter */
function toCandidate<F extends TargetFileLike>(
    file: F,
    frontmatter: Record<string, unknown>
): TargetNoteCandidate & { file: F } {
    return {
        file,
        path: file.path,
        basename: file.basename,
        folder: file.parent?.path ?? '',
        tags: readTags(frontmatter),
        frontmatter,
        mtime: file.stat.mtime
    }
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

/**
 * Finds and prepares the note of a capture target for a date (see
 * `documentation/plans/capture-targets.md`). Vault access only; the decisions
 * are in `capture-target.utils.ts`.
 */
export class CaptureTargetService<F extends TargetFileLike> {
    /**
     * @param parseFrontmatter reads the frontmatter of a note's text (Obsidian's
     * `getFrontMatterInfo` + `parseYaml` in production); null when it has none
     */
    constructor(
        private readonly app: CaptureTargetHost<F>,
        private readonly getNoteType: (id: string) => StarterKitNoteType | null,
        private readonly parseFrontmatter: (content: string) => Record<string, unknown> | null
    ) {}

    private noteTypeOf(target: CaptureTarget): StarterKitNoteType | null {
        return target.noteTypeId ? this.getNoteType(target.noteTypeId) : null
    }

    /**
     * Markdown file paths under a folder, recursively. Only that folder is
     * walked, never the vault: a phone vault holds tens of thousands of notes.
     */
    private markdownPathsIn(folderPath: string): string[] {
        const root = this.app.vault.getFolderByPath(folderPath)
        if (!root) return []

        const paths: string[] = []
        const stack: Array<readonly unknown[]> = [root.children]
        while (stack.length > 0) {
            const children = stack.pop() ?? []
            for (const child of children) {
                if (!child || typeof child !== 'object') continue
                const node = child as { children?: unknown; extension?: unknown; path?: unknown }
                if (Array.isArray(node.children)) {
                    stack.push(node.children)
                } else if (node.extension === 'md' && typeof node.path === 'string') {
                    paths.push(node.path)
                }
            }
        }
        return paths
    }

    /**
     * The target's note for a day, or null. Scans the target's folder rendered
     * for that date (e.g. `…/Strength/2026`), then applies type, filter and
     * date matching.
     */
    findNote(target: CaptureTarget, date: Date): F | null {
        const noteType = this.noteTypeOf(target)
        const candidates = this.filesInTargetFolder(target, date).map((file) =>
            toCandidate(file, asRecord(this.app.metadataCache.getFileCache(file)?.frontmatter))
        )
        return pickTargetNote(candidates, target, noteType, date)?.file ?? null
    }

    /**
     * Like `findNote`, but when the metadata cache finds nothing, read the
     * folder's notes from disk before concluding the note is missing.
     *
     * The cache lags behind writes: a note just created and filled may still
     * be indexed as empty, and the cache alone would then offer to create a
     * second note for the same day. Disk is only read on a miss, which happens
     * once a day per target (before its note exists).
     */
    async findNoteVerified(target: CaptureTarget, date: Date): Promise<F | null> {
        const cached = this.findNote(target, date)
        if (cached) return cached

        const noteType = this.noteTypeOf(target)
        const candidates: Array<TargetNoteCandidate & { file: F }> = []
        for (const file of this.filesInTargetFolder(target, date)) {
            let content: string
            try {
                content = await this.app.vault.read(file)
            } catch (error: unknown) {
                log('Could not read a note while looking for a capture target note', 'debug', {
                    path: file.path,
                    error
                })
                continue
            }
            candidates.push(toCandidate(file, this.parseFrontmatter(content) ?? {}))
        }
        return pickTargetNote(candidates, target, noteType, date)?.file ?? null
    }

    /**
     * Whether the metadata cache already sees `file` as the target's note for
     * the day (type, filters, date). Used to wait for a new note to be indexed
     * before capturing into it.
     */
    isIndexedAsTargetNote(file: F, target: CaptureTarget, date: Date): boolean {
        const candidate = toCandidate(
            file,
            asRecord(this.app.metadataCache.getFileCache(file)?.frontmatter)
        )
        return pickTargetNote([candidate], target, this.noteTypeOf(target), date) !== null
    }

    /** The markdown files of the target's folder for a date (none when unusable) */
    private filesInTargetFolder(target: CaptureTarget, date: Date): F[] {
        const layout = describeTargetLayout(target, this.noteTypeOf(target))
        if (!isTargetLayout(layout)) return []
        const folder = renderTargetFolder(layout, date)
        if (folder === null) return []

        const files: F[] = []
        for (const path of this.markdownPathsIn(folder)) {
            const file = this.app.vault.getFileByPath(path)
            if (file) files.push(file)
        }
        return files
    }

    /**
     * Work out where a new note for the day goes. The name is the first one
     * not taken: a file at the plain path is never reused, since it may be a
     * different note of the same type.
     */
    planCreation(target: CaptureTarget, date: Date): TargetCreationPlanResult {
        const layout = describeTargetLayout(target, this.noteTypeOf(target))
        if (!isTargetLayout(layout)) {
            return { ok: false, error: describeLayoutError(layout, target) }
        }

        const resolved = resolveFreeTargetPath(
            layout,
            date,
            (path) => this.app.vault.getFileByPath(path) !== null
        )
        if (!resolved) {
            return {
                ok: false,
                error: `Could not work out a valid, free file name for capture target "${target.name}".`
            }
        }

        return {
            ok: true,
            plan: {
                resolution: {
                    target: resolved,
                    templatePath: layout.templatePath,
                    mandatoryTags: layout.tags,
                    source: target.noteTypeId ? 'starter-kit' : 'capture-target'
                },
                layout,
                warnUndiscoverable: needsDiscoverabilityWarning(target, resolved, date)
            }
        }
    }

    /**
     * Write what makes a freshly created note this target's note: the date
     * property, the filter values and the mandatory tags. Runs after the
     * template, so it completes a templated note and fills an empty one.
     */
    async writeCreationValues(
        file: F,
        target: CaptureTarget,
        layout: TargetLayout,
        date: Date
    ): Promise<boolean> {
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                const values = buildCreationFrontmatter(target, layout, date, frontmatter['tags'])
                for (const [key, value] of Object.entries(values)) {
                    frontmatter[key] = value
                }
            })
            return true
        } catch (error: unknown) {
            log('Could not write the capture target values into the new note', 'error', {
                path: file.path,
                error
            })
            return false
        }
    }
}
