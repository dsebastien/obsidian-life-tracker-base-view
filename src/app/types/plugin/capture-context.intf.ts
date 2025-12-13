import type { TFile } from 'obsidian'
import type { PropertyDefinition } from '../property/property-definition.types'

/**
 * Context for the capture command
 */
export interface CaptureContext {
    /** Files to process (single file or batch from view) */
    files: TFile[]
    /** Property definitions that apply to the context */
    definitions: PropertyDefinition[]
    /** Whether this is batch mode (multiple files) */
    isBatchMode: boolean
}
