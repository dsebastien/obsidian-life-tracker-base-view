import { Notice, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { TimeGranularity, type BatchFilterMode } from '../types'
import { PropertyCaptureModal } from '../components/modals/property-capture-modal'
import { isSameDay, parseDateFromFilename } from '../../utils'

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
                new Notice('Please open a markdown file or a life tracker view first')
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

            if (!file) {
                new Notice(
                    "No note for today found. Expected a note named after today's date (YYYY-MM-DD)."
                )
                return
            }

            new PropertyCaptureModal(plugin, { mode: 'single-note', file }).open()
        }
    })
}

/**
 * Find today's daily note: a markdown file whose basename is today's date
 * in the daily filename pattern (YYYY-MM-DD). When several notes match
 * (e.g. duplicates across folders), the most recently modified one wins.
 */
function findTodayNote(plugin: LifeTrackerPlugin): TFile | null {
    const today = new Date()

    const candidates = plugin.app.vault.getMarkdownFiles().filter((file) => {
        const parsed = parseDateFromFilename(file.basename)
        return (
            parsed !== null &&
            parsed.granularity === TimeGranularity.Daily &&
            isSameDay(parsed.date, today)
        )
    })

    if (candidates.length > 1) {
        candidates.sort((a, b) => b.stat.mtime - a.stat.mtime)
    }

    return candidates[0] ?? null
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
