import { Notice, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { BatchFilterMode, CaptureTarget, PropertyDefinition } from '../types'
import { PropertyCaptureModal } from '../components/modals/property-capture-modal'
import { withCaptureNote } from './capture-note'
import { definitionsForDestination } from '../services/capture-target.utils'

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
    /**
     * Candidate definitions (single-note mode), e.g. only those whose capture
     * destination is this note. All definitions when absent.
     */
    definitions?: PropertyDefinition[]
    /**
     * Use `definitions` as they are, without the note filtering (mappings):
     * a capture target already decided these properties go to this note.
     */
    ignoreMappings?: boolean
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
            // Only the properties whose destination is the daily note: those
            // with a capture target have their own "Capture today: <target>"
            captureToday(plugin, null)
        }
    })
}

/**
 * Open the capture dialog on today's note of a destination (null = the daily
 * note), creating it first when missing and allowed. The dialog lists only
 * the properties whose destination it is.
 */
export function captureToday(plugin: LifeTrackerPlugin, target: CaptureTarget | null): void {
    if (plugin.settings.propertyDefinitions.length === 0) {
        new Notice(
            'No property definitions configured. Add them in settings > Life Tracker > property definitions.'
        )
        return
    }

    withCaptureNote(plugin, target, new Date(), (file: TFile) => {
        // Read at open time: settings may have changed while a confirmation was up
        const { propertyDefinitions, captureTargets } = plugin.settings
        const current = target
            ? (captureTargets.find((candidate) => candidate.id === target.id) ?? target)
            : null
        const definitions = definitionsForDestination(propertyDefinitions, captureTargets, current)
        new PropertyCaptureModal(plugin, {
            mode: 'single-note',
            file,
            definitions,
            ignoreMappings: current !== null
        }).open()
    })
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
