import { Notice, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { TimeGranularity, type BatchFilterMode, type StarterKitNoteType } from '../types'
import { PropertyCaptureModal } from '../components/modals/property-capture-modal'
import { ConfirmModal } from '../components/modals/confirm-modal'
import { NoteCreationService } from '../services/note-creation.service'
import { NoteTargetService } from '../services/note-target.service'
import { StarterKitService } from '../services/starter-kit.service'
import { isSameDay, isTargetDiscoverable, parseDateFromPath } from '../../utils'
import { formatMomentPattern } from '../../utils/moment.utils'

/**
 * Context for the property capture dialog
 */
export interface CaptureContext {
    mode: 'single-note' | 'batch'
    /** Current file (single-note mode) */
    file?: TFile
    /** All files (batch mode) */
    files?: TFile[]
    /** Current index in batch (batch mode) */
    currentIndex?: number
    /** Filter mode for batch - determines when a file is considered complete */
    filterMode?: BatchFilterMode
}

/**
 * Register the capture properties command
 */
export function registerCaptureCommand(plugin: LifeTrackerPlugin): void {
    plugin.addCommand({
        id: 'capture-properties',
        name: 'Capture properties',
        callback: () => {
            // Check if property definitions are configured
            if (plugin.settings.propertyDefinitions.length === 0) {
                new Notice(
                    'No property definitions configured. Add them in settings > Life Tracker > property definitions.'
                )
                return
            }

            const context = detectContext(plugin)

            if (!context) {
                new Notice('Please open a Markdown file or a Life Tracker view first')
                return
            }

            new PropertyCaptureModal(plugin, context).open()
        }
    })

    plugin.addCommand({
        id: 'capture-today',
        name: 'Capture today',
        callback: () => {
            // Check if property definitions are configured
            if (plugin.settings.propertyDefinitions.length === 0) {
                new Notice(
                    'No property definitions configured. Add them in settings > Life Tracker > property definitions.'
                )
                return
            }

            const file = findTodayNote(plugin)

            if (file) {
                new PropertyCaptureModal(plugin, { mode: 'single-note', file }).open()
                return
            }

            void offerToCreateTodayNote(plugin)
        }
    })
}

/**
 * Offer to create today's note when the vault has none (issue #160).
 *
 * Creation is opt-in and confirmed: this writes a new file into the user's
 * vault, and the path comes from another plugin's configuration, so the user
 * sees exactly where it will go before agreeing.
 */
async function offerToCreateTodayNote(plugin: LifeTrackerPlugin): Promise<void> {
    const missingNoteMessage =
        "No note for today found. Expected a note named after today's date (YYYY-MM-DD), or matching one of your filename date patterns."

    if (!plugin.settings.createMissingNotes) {
        new Notice(missingNoteMessage)
        return
    }

    const today = new Date()
    const targetService = new NoteTargetService(plugin.app, formatMomentPattern)
    const noteType = findDailyNoteType(plugin)
    const resolution = targetService.resolve(today, TimeGranularity.Daily, noteType)

    if (!resolution) {
        new Notice(
            `${missingNoteMessage} Life Tracker could not work out where to create one — configure the Periodic Notes plugin, or pick a Starter Kit note type in settings > Life Tracker > dates.`
        )
        return
    }

    // A note whose filename this plugin cannot parse back is invisible in every
    // view and unreachable by this command — the very problem being fixed. The
    // configuration is the user's, so this warns rather than refuses.
    const discoverable = isTargetDiscoverable(resolution.target, today, TimeGranularity.Daily)
    const warning = discoverable
        ? ''
        : `\n\nHeads up: Life Tracker will not recognise this filename as today's date, so the note will not appear in your views. Add a matching filename date pattern in settings > Life Tracker > dates.`

    new ConfirmModal(
        plugin.app,
        `No note exists for today. Create it at ${resolution.target.path}?${warning}`,
        () => {
            void createAndCapture(plugin, resolution.target.path, async () => {
                const outcome = await new NoteCreationService(plugin.app).ensureNote(resolution)
                return outcome?.path ?? null
            })
        },
        { title: "Create today's note", confirmText: 'Create' }
    ).open()
}

/**
 * Run a creation and open capture on whatever note it produced.
 *
 * The file is resolved from the vault after creation rather than carried out of
 * it: a template may have been applied in between, and the vault is the
 * freshest source.
 */
async function createAndCapture(
    plugin: LifeTrackerPlugin,
    expectedPath: string,
    create: () => Promise<string | null>
): Promise<void> {
    const path = await create()
    if (!path) {
        new Notice(`Could not create ${expectedPath}`)
        return
    }

    const file = plugin.app.vault.getFileByPath(path)
    if (!file) {
        new Notice(`Created ${path}, but it could not be opened for capture`)
        return
    }

    new PropertyCaptureModal(plugin, { mode: 'single-note', file }).open()
}

/**
 * The Starter Kit note type the user mapped to daily notes, or null.
 *
 * Null whenever the Starter Kit is unavailable or nothing is mapped, which
 * simply lets the resolver fall through to Periodic Notes.
 */
function findDailyNoteType(plugin: LifeTrackerPlugin): StarterKitNoteType | null {
    const noteTypeId = plugin.settings.dailyNoteTypeId
    if (!noteTypeId) return null

    const noteTypes = new StarterKitService(plugin.app).listNoteTypes()
    return noteTypes.find((candidate) => candidate.id === noteTypeId) ?? null
}

/**
 * Find today's daily note: a markdown file whose path resolves to today's date
 * at daily granularity — either a built-in pattern (YYYY-MM-DD) or one of the
 * user's custom filename date patterns (issue #139).
 *
 * Notes matched by a configured pattern beat notes that only matched a
 * built-in one: a user who wrote `daily/{{date}}` told us where their daily
 * notes live, so an identically named note in another folder must not win just
 * because it was touched more recently (issue #152). Ties inside the same
 * group are broken by modification time, freshest first.
 */
function findTodayNote(plugin: LifeTrackerPlugin): TFile | null {
    const today = new Date()

    const candidates: Array<{ file: TFile; fromCustomPattern: boolean }> = []

    for (const file of plugin.app.vault.getMarkdownFiles()) {
        const parsed = parseDateFromPath(file.path)
        if (
            parsed !== null &&
            parsed.granularity === TimeGranularity.Daily &&
            isSameDay(parsed.date, today)
        ) {
            candidates.push({ file, fromCustomPattern: parsed.origin === 'custom' })
        }
    }

    candidates.sort((a, b) => {
        if (a.fromCustomPattern !== b.fromCustomPattern) {
            return a.fromCustomPattern ? -1 : 1
        }
        return b.file.stat.mtime - a.file.stat.mtime
    })

    return candidates[0]?.file ?? null
}

/**
 * Detect the capture context based on current workspace state
 */
function detectContext(plugin: LifeTrackerPlugin): CaptureContext | null {
    const app = plugin.app

    // First, check for active file
    const activeFile = app.workspace.getActiveFile()

    if (activeFile && activeFile.extension === 'md') {
        return {
            mode: 'single-note',
            file: activeFile
        }
    }

    // Check for active file provider (Grid View, Life Tracker View or Base views of compatible plugins)
    const providerFiles = plugin.getActiveProviderFiles()
    const filterMode = plugin.getActiveProviderFilterMode()

    if (providerFiles && providerFiles.length > 0) {
        return {
            mode: 'batch',
            files: providerFiles,
            currentIndex: 0,
            filterMode: filterMode ?? 'never'
        }
    }

    return null
}
