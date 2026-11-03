import { Notice, getFrontMatterInfo, parseYaml, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { CaptureTarget } from '../types'
import { ConfirmModal } from '../components/modals/confirm-modal'
import { CaptureTargetService, type TargetCreationPlan } from '../services/capture-target.service'
import { NoteCreationService } from '../services/note-creation.service'
import { InFlight } from '../services/in-flight.utils'
import { waitForCache } from '../services/metadata-wait.utils'
import { findDailyNote, offerToCreateDailyNote } from './daily-note'
import { formatDateISO, isSameDay, log } from '../../utils'

/**
 * How long to wait for the metadata cache to show the values written into a
 * new target note. Without the wait, a capture opened at once would see a note
 * without its tags and report "No matching properties" (see the same bound in
 * `NoteCreationService`).
 */
const INDEX_TIMEOUT_MS = 3000

/**
 * Called with the destination's note. `created` is true when the note was
 * created for this request (it may not be fully indexed by the cache yet).
 */
export type CaptureNoteReady = (file: TFile, created: boolean) => void

/**
 * Creations in progress, per target and day: a second quick-add tap while the
 * first one's note is being created joins it instead of creating `… 3`.
 */
const creations = new InFlight<TFile | null>()

/** Frontmatter of a note's text, or null; for lookups that bypass the cache */
function parseFrontmatter(content: string): Record<string, unknown> | null {
    const info = getFrontMatterInfo(content)
    if (!info.exists) return null
    try {
        const parsed: unknown = parseYaml(info.frontmatter)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null
    } catch {
        return null
    }
}

/** The capture target service bound to the plugin's vault and Starter Kit */
export function createCaptureTargetService(plugin: LifeTrackerPlugin): CaptureTargetService<TFile> {
    return new CaptureTargetService<TFile>(
        plugin.app,
        (id) => plugin.starterKit.listNoteTypes().find((noteType) => noteType.id === id) ?? null,
        parseFrontmatter
    )
}

/** Name of a destination for titles and notices */
export function destinationName(target: CaptureTarget | null): string {
    return target ? target.name || 'Unnamed target' : 'Daily note'
}

/** "today" for today, the ISO date otherwise — for notices and titles */
function describeDay(date: Date): string {
    return isSameDay(date, new Date()) ? 'today' : formatDateISO(date)
}

/**
 * The note captured values of a destination go to for a date: the daily
 * note (null target), or the capture target's note. Reads the metadata cache
 * only, so it is fast enough for rendering.
 */
export function findCaptureNote(
    plugin: LifeTrackerPlugin,
    target: CaptureTarget | null,
    date: Date
): TFile | null {
    if (!target) return findDailyNote(plugin, date)
    return createCaptureTargetService(plugin).findNote(target, date)
}

/**
 * Offer to create a destination's note for a date, then hand it to `onReady`.
 * Same opt-in and confirmation as daily notes (issue #160). While a creation
 * for the same target and day is pending, a second request joins it.
 */
export function offerToCreateCaptureNote(
    plugin: LifeTrackerPlugin,
    target: CaptureTarget | null,
    date: Date,
    onReady: CaptureNoteReady
): void {
    if (!target) {
        offerToCreateDailyNote(plugin, date, (file) => onReady(file, true))
        return
    }

    const key = `${target.id}|${formatDateISO(date)}`
    const pending = creations.get(key)
    if (pending) {
        void pending.then((file) => {
            if (file) onReady(file, true)
        })
        return
    }

    const day = describeDay(date)
    const name = destinationName(target)
    const missingMessage = `No "${name}" note for ${day} found.`

    if (!plugin.settings.createMissingNotes) {
        new Notice(
            `${missingMessage} Turn on "Create missing notes when capturing" in settings to create it from here.`
        )
        return
    }

    const service = createCaptureTargetService(plugin)
    const planned = service.planCreation(target, date)
    if (!planned.ok) {
        new Notice(`${missingMessage} ${planned.error}`)
        return
    }

    const { plan } = planned
    const warning = plan.warnUndiscoverable
        ? `\n\nHeads up: this target has no date property and Life Tracker cannot read the date from this file name, so the note will not appear in your views. Set a date property on the target.`
        : ''

    const creation = creations.run(
        key,
        () =>
            new Promise<TFile | null>((resolve) => {
                new ConfirmModal(
                    plugin.app,
                    `No "${name}" note exists for ${day}. Create it at ${plan.resolution.target.path}?${warning}`,
                    () => {
                        void createTargetNote(plugin, service, target, date, plan).then(resolve)
                    },
                    {
                        title:
                            day === 'today'
                                ? `Create today's "${name}" note`
                                : `Create the "${name}" note for ${day}`,
                        confirmText: 'Create',
                        onCancel: () => resolve(null)
                    }
                ).open()
            })
    )
    void creation.then((file) => {
        if (file) onReady(file, true)
    })
}

/**
 * Create the planned note, write the target's values into it and wait for the
 * cache to show them. Null (with a notice) on any failure.
 */
async function createTargetNote(
    plugin: LifeTrackerPlugin,
    service: CaptureTargetService<TFile>,
    target: CaptureTarget,
    date: Date,
    plan: TargetCreationPlan
): Promise<TFile | null> {
    const expectedPath = plan.resolution.target.path
    // The target's template is applied by the plugin, never left to a
    // Templater folder template (which could be a note type picker)
    const outcome = await new NoteCreationService(plugin.app).ensureNote(plan.resolution, {
        alwaysApplyTemplate: true
    })
    if (!outcome) {
        new Notice(`Could not create ${expectedPath}`)
        return null
    }
    if (!outcome.created) {
        // Something created this exact path between planning and creating. It
        // may be a different note of the same type: never write into it.
        new Notice(`${expectedPath} appeared meanwhile and was left untouched. Try again.`)
        return null
    }

    const file = plugin.app.vault.getFileByPath(outcome.path)
    if (!file) {
        new Notice(`Created ${outcome.path}, but it could not be opened`)
        return null
    }

    const written = await service.writeCreationValues(file, target, plan.layout, date)
    if (!written) {
        new Notice(
            `Created ${file.path}, but could not write its date and filter values. Add them by hand so the note is found again.`
        )
        return null
    }

    // Wait for the cache to show the written values, not just for the next
    // index of the path: that one can belong to an earlier write
    const indexed = await waitForCache(
        plugin.app.metadataCache,
        file.path,
        () => service.isIndexedAsTargetNote(file, target, date),
        INDEX_TIMEOUT_MS
    )
    if (!indexed) {
        log('The new target note was not indexed in time', 'debug', { path: file.path })
    }
    return file
}

/**
 * Find a destination's note for a date, offering creation when it is missing,
 * then run `onReady` on it. For a target, a cache miss is checked against the
 * disk before anything is offered, so a note the cache has not indexed yet is
 * never created twice.
 */
export function withCaptureNote(
    plugin: LifeTrackerPlugin,
    target: CaptureTarget | null,
    date: Date,
    onReady: CaptureNoteReady
): void {
    if (!target) {
        const file = findDailyNote(plugin, date)
        if (file) onReady(file, false)
        else offerToCreateCaptureNote(plugin, null, date, onReady)
        return
    }

    void createCaptureTargetService(plugin)
        .findNoteVerified(target, date)
        .then((file) => {
            if (file) onReady(file, false)
            else offerToCreateCaptureNote(plugin, target, date, onReady)
        })
}
