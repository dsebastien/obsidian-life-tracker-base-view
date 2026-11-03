import { describe, expect, test } from 'bun:test'
import { TimeFrame } from '../types'
import { gridSettingWrites, readGridSettings, sameGridSettings } from './grid-settings.utils'
import { DEFAULT_GRID_COLUMNS } from './view-options'

/** A view config backed by a plain object, like Bases' in-memory copy of the file */
function viewConfig(values: Record<string, unknown>): {
    get: (key: string) => unknown
    set: (key: string, value: unknown) => void
    values: Record<string, unknown>
} {
    return {
        values,
        get: (key) => values[key],
        set: (key, value) => {
            values[key] = value
        }
    }
}

describe('readGridSettings (issue #189)', () => {
    test('reads the settings the config holds', () => {
        const config = viewConfig({ gridColumns: 3, timeFrame: TimeFrame.Last365Days })
        expect(readGridSettings(config.get)).toEqual({
            columns: 3,
            timeFrame: TimeFrame.Last365Days
        })
    })

    test('falls back to the defaults for missing or invalid values', () => {
        const config = viewConfig({ gridColumns: 'three', timeFrame: 'someday' })
        expect(readGridSettings(config.get)).toEqual({
            columns: DEFAULT_GRID_COLUMNS,
            timeFrame: TimeFrame.AllTime
        })
    })

    test('sees an edit made to the file after a first read', () => {
        const config = viewConfig({ timeFrame: TimeFrame.AllTime })
        const before = readGridSettings(config.get)
        config.values['timeFrame'] = TimeFrame.Last365Days
        const after = readGridSettings(config.get)
        expect(sameGridSettings(before, after)).toBe(false)
        expect(after.timeFrame).toBe(TimeFrame.Last365Days)
    })
})

describe('gridSettingWrites (issue #189)', () => {
    test('a column change writes only the column count', () => {
        const current = { columns: 2, timeFrame: TimeFrame.Last365Days }
        expect(gridSettingWrites(current, { columns: 3 })).toEqual([
            { key: 'gridColumns', value: 3 }
        ])
    })

    test('a time frame change writes only the time frame', () => {
        const current = { columns: 2, timeFrame: TimeFrame.AllTime }
        expect(gridSettingWrites(current, { timeFrame: TimeFrame.Last365Days })).toEqual([
            { key: 'timeFrame', value: TimeFrame.Last365Days }
        ])
    })

    test('nothing is written when the config already holds the value', () => {
        const current = { columns: 2, timeFrame: TimeFrame.AllTime }
        expect(gridSettingWrites(current, { columns: 2 })).toEqual([])
        expect(gridSettingWrites(current, {})).toEqual([])
    })

    test('a stale in-memory time frame never overwrites an edit to the file', () => {
        // The view rendered with all-time; the .base file then got last-365-days
        const config = viewConfig({ gridColumns: 2, timeFrame: TimeFrame.AllTime })
        const rendered = readGridSettings(config.get)
        config.values['timeFrame'] = TimeFrame.Last365Days

        // The user adds a column in the still-open view
        const writes = gridSettingWrites(readGridSettings(config.get), {
            columns: rendered.columns + 1
        })
        for (const write of writes) config.set(write.key, write.value)

        expect(config.values).toEqual({ gridColumns: 3, timeFrame: TimeFrame.Last365Days })
    })
})
