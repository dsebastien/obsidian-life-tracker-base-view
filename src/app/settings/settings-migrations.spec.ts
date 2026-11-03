import { describe, expect, test } from 'bun:test'
import { createCaptureTarget, DEFAULT_SETTINGS, type PluginSettings } from '../types'
import {
    NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION,
    SETTINGS_MIGRATIONS,
    allMigrationIds,
    readCompletedMigrations,
    runPendingMigrations,
    type SettingsMigration
} from './settings-migrations'

const MIGRATION_ID = NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION.id

function settingsWith(overrides: Partial<PluginSettings>): PluginSettings {
    return { ...structuredClone(DEFAULT_SETTINGS), ...structuredClone(overrides) }
}

const typed = {
    ...createCaptureTarget('t-typed', 'Through the day'),
    noteTypeId: 'nt-strength',
    fileNamePattern: '{{date}} (Workout)'
}
const standalone = {
    ...createCaptureTarget('t-standalone', 'Moves'),
    folder: 'Moves',
    fileNamePattern: '{{date}} (Workout)'
}

describe('note type file name pattern migration', () => {
    test('resets the hidden pattern of every target with a note type to {{date}}', () => {
        const settings = settingsWith({
            captureTargets: [typed, { ...typed, id: 't-empty', fileNamePattern: '' }, standalone]
        })
        expect(runPendingMigrations(settings)).toEqual([MIGRATION_ID])
        expect(settings.captureTargets.map((target) => target.fileNamePattern)).toEqual([
            '{{date}}',
            '{{date}}',
            '{{date}} (Workout)'
        ])
        expect(settings.completedMigrations).toEqual([MIGRATION_ID])
    })

    test('never runs twice: a pattern set after it is kept', () => {
        const settings = settingsWith({ captureTargets: [typed] })
        runPendingMigrations(settings)
        const target = settings.captureTargets[0]
        if (target) target.fileNamePattern = '{{date}} Gym'

        expect(runPendingMigrations(settings)).toEqual([])
        expect(settings.captureTargets[0]?.fileNamePattern).toBe('{{date}} Gym')
    })

    test('a recorded migration is skipped', () => {
        const settings = settingsWith({
            captureTargets: [typed],
            completedMigrations: [MIGRATION_ID]
        })
        expect(runPendingMigrations(settings)).toEqual([])
        expect(settings.captureTargets[0]?.fileNamePattern).toBe('{{date}} (Workout)')
    })
})

describe('runPendingMigrations', () => {
    test('runs pending migrations in order and records each', () => {
        const order: string[] = []
        const migrations: SettingsMigration[] = [
            { id: 'a', migrate: () => order.push('a') },
            { id: 'b', migrate: () => order.push('b') },
            { id: 'c', migrate: () => order.push('c') }
        ]
        const settings = settingsWith({ completedMigrations: ['b'] })
        expect(runPendingMigrations(settings, migrations)).toEqual(['a', 'c'])
        expect(order).toEqual(['a', 'c'])
        expect(settings.completedMigrations).toEqual(['b', 'a', 'c'])
    })

    test('every migration has a unique id', () => {
        const ids = allMigrationIds()
        expect(ids).toEqual(SETTINGS_MIGRATIONS.map((migration) => migration.id))
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe('readCompletedMigrations', () => {
    test('keeps strings only', () => {
        expect(readCompletedMigrations(['a', 1, null, 'b'])).toEqual(['a', 'b'])
        expect(readCompletedMigrations('a')).toEqual([])
        expect(readCompletedMigrations(undefined)).toEqual([])
    })
})
