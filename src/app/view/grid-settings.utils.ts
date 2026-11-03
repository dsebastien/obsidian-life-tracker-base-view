import { TimeFrame, TIME_FRAME_OPTIONS, type ConfigGetter, type GridSettings } from '../types'
import { getEnumConfig, getNumberConfig } from './config-accessors'
import { DEFAULT_GRID_COLUMNS } from './view-options'

/**
 * Grid settings of a Life Tracker view (issue #189). The `.base` file is the
 * only source of truth: the view reads them from its config on every render
 * and writes one only when the user changes it in the view. Writing the
 * in-memory copy back on a later action once undid an edit made to the file
 * while the view was open.
 */

/** View config keys of the grid settings */
export const GRID_COLUMNS_KEY = 'gridColumns'
export const TIME_FRAME_KEY = 'timeFrame'

/** Grid settings as the view config holds them now */
export function readGridSettings(get: ConfigGetter): GridSettings {
    return {
        columns: getNumberConfig(get, GRID_COLUMNS_KEY) ?? DEFAULT_GRID_COLUMNS,
        timeFrame: getEnumConfig(get, TIME_FRAME_KEY, TIME_FRAME_OPTIONS) ?? TimeFrame.AllTime
    }
}

/** Whether two grid settings are the same */
export function sameGridSettings(a: GridSettings, b: GridSettings): boolean {
    return a.columns === b.columns && a.timeFrame === b.timeFrame
}

/** One view config write */
export interface GridSettingWrite {
    key: typeof GRID_COLUMNS_KEY | typeof TIME_FRAME_KEY
    value: number | string
}

/**
 * The writes a user change needs: only the settings the user changed, and
 * only when they differ from what the config holds now. A setting the user
 * did not touch is never written, so a stale in-memory value cannot replace
 * an edit made to the `.base` file.
 */
export function gridSettingWrites(
    current: GridSettings,
    change: Partial<GridSettings>
): GridSettingWrite[] {
    const writes: GridSettingWrite[] = []
    if (change.columns !== undefined && change.columns !== current.columns) {
        writes.push({ key: GRID_COLUMNS_KEY, value: change.columns })
    }
    if (change.timeFrame !== undefined && change.timeFrame !== current.timeFrame) {
        writes.push({ key: TIME_FRAME_KEY, value: change.timeFrame })
    }
    return writes
}
