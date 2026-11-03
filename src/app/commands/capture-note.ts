import { Notice, type App, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { CaptureTarget } from '../types'
import { ConfirmModal } from '../components/modals/confirm-modal'
import { CaptureTargetService, type TargetCreationPlan } from '../services/capture-target.service'
import { NoteCreationService } from '../services/note-creation.service'
import { findDailyNote, offerToCreateDailyNote } from './daily-note'
import { formatDateISO, isSameDay, log } from '../../utils'

/**
 * How long to wait for the metadata cache to index the values written into a
 * new target note. Without the wait, a capture opened at once would see a note
 * without its tags and report "No matching properties" (see the same bound in
 * `NoteCreationService`).
 */
const INDEX_TIMEOUT_MS = 3000

/** The capture target service bound to the plugin's vault and Starter Kit */
export function createCaptureTargetService(plugin: LifeTrackerPlugin): CaptureTargetService<TFile> {
    return new CaptureTargetService<TFile>(plugin.app, (id) => {
        return plugin.starterKit.listNoteTypes().find((noteType) => noteType.id === id) ?? null
    })
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
 * note (null target), or the capture target's note.
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
 * Same opt-in and confirmation as daily notes (issue #160).
 */
export function offerToCreateCaptureNote(
    plugin: LifeTrackerPlugin,
    target: CaptureTarget | null,
    date: Date,
    onReady: (file: TFile) => void
): void {
    if (!target) {
        offerToCreateDailyNote(plugin, date, onReady)
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

    new ConfirmModal(
        plugin.app,
        `No "${name}" note exists for ${day}. Create it at ${plan.resolution.target.path}?${warning}`,
        () => {
            void createTargetNote(plugin, service, target, date, plan).then((file) => {
                if (file) onReady(file)
            })
        },
        {
            title:
                day === 'today'
                    ? `Create today's "${name}" note`
                    : `Create the "${name}" note for ${day}`,
            confirmText: 'Create'
        }
    ).open()
}

/**
 * Create the planned note, write the target's values into it and wait for the
 * cache to see them. Null (with a notice) on any failure.
 */
async function createTargetNote(
    plugin: LifeTrackerPlugin,
    service: CaptureTargetService<TFile>,
    target: CaptureTarget,
    date: Date,
    plan: TargetCreationPlan
): Promise<TFile | null> {
    const expectedPath = plan.resolution.target.path
    const outcome = await new NoteCreationService(plugin.app).ensureNote(plan.resolution)
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

    const indexed = waitForIndex(plugin.app, file.path)
    const written = await service.writeCreationValues(file, target, plan.layout, date)
    if (!written) {
        new Notice(
            `Created ${file.path}, but could not write its date and filter values. Add them by hand so the note is found again.`
        )
        return null
    }
    await indexed
    return file
}

/**
 * Resolve once the metadata cache has re-indexed `path`, or after a timeout.
 * Started before the write so an index that lands quickly is not missed.
 */
function waitForIndex(app: App, path: string): Promise<void> {
    return new Promise<void>((resolve) => {
        let settled = false
        const finish = (): void => {
            if (settled) return
            settled = true
            app.metadataCache.offref(eventRef)
            window.clearTimeout(timer)
            resolve()
        }
        const eventRef = app.metadataCache.on('changed', (changed) => {
            if (changed.path === path) finish()
        })
        const timer = window.setTimeout(() => {
            log('Timed out waiting for the new target note to be indexed', 'debug', { path })
            finish()
        }, INDEX_TIMEOUT_MS)
    })
}

/**
 * Find a destination's note for a date, offering creation when it is missing,
 * then run `onReady` on it.
 */
export function withCaptureNote(
    plugin: LifeTrackerPlugin,
    target: CaptureTarget | null,
    date: Date,
    onReady: (file: TFile) => void
): void {
    const file = findCaptureNote(plugin, target, date)
    if (file) {
        onReady(file)
        return
    }
    offerToCreateCaptureNote(plugin, target, date, onReady)
}
