import type { TFile } from 'obsidian'
import type { BatchFilterMode } from './batch-filter-mode.intf'

/**
 * Interface for views that can provide files for batch capture
 */
export interface FileProvider {
    getFiles(): TFile[]
    getFilterMode(): BatchFilterMode
}
