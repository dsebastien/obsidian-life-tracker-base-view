import { Notice, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { PropertyCaptureModal } from '../components/modals/property-capture-modal'

/**
 * Context for the property capture dialog
 */
export interface CaptureContext {
    mode: 'single-note' | 'batch'
    /** Current file (single-note mode) */
    file?: TFile
    /** All files with issues (batch mode) */
    files?: TFile[]
    /** Current index in batch (batch mode) */
    currentIndex?: number
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
                    'No property definitions configured. Add them in Settings → Life Tracker → Property Definitions.'
                )
                return
            }

            const context = detectContext(plugin)

            if (!context) {
                new Notice('Please open a markdown file first')
                return
            }

            new PropertyCaptureModal(plugin, context).open()
        }
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

    return null
}
