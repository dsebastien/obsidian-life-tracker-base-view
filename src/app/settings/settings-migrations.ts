/**
 * One-time settings migrations.
 *
 * Each migration has a stable id. Once it has run, its id is stored in
 * `PluginSettings.completedMigrations` (in the vault's `data.json`) and it
 * never runs again for that vault, so a value the user sets afterwards is
 * never reset. A fresh install records every id without running anything:
 * there is nothing to migrate.
 */
import { DEFAULT_TARGET_FILE_NAME_PATTERN, type PluginSettings } from '../types'

export interface SettingsMigration {
    /** Stable id, stored once the migration has run. Never reuse or rename */
    id: string
    /** Change the settings in place */
    migrate: (settings: PluginSettings) => void
}

/**
 * Up to 3.5.0 the settings page hid the File name field of a capture target
 * with a note type, and the pattern was ignored. A target first set up
 * standalone (`{{date}} (Workout)`) and then switched to a note type kept that
 * hidden pattern, which the note type naming now uses
 * (`2026-11-03 (Workout) (Strength Session)`). Reset it to `{{date}}`, the
 * type's usual name, once.
 */
export const NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION: SettingsMigration = {
    id: 'note-type-target-file-name-pattern',
    migrate: (settings) => {
        for (const target of settings.captureTargets) {
            if (target.noteTypeId) target.fileNamePattern = DEFAULT_TARGET_FILE_NAME_PATTERN
        }
    }
}

/** Every migration, oldest first */
export const SETTINGS_MIGRATIONS: readonly SettingsMigration[] = [
    NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION
]

/** The ids of every migration: what a fresh install starts with */
export function allMigrationIds(
    migrations: readonly SettingsMigration[] = SETTINGS_MIGRATIONS
): string[] {
    return migrations.map((migration) => migration.id)
}

/** The string entries of a stored `completedMigrations` value, anything else dropped */
export function readCompletedMigrations(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []
    return raw.filter((id): id is string => typeof id === 'string')
}

/**
 * Run the migrations not yet listed in `settings.completedMigrations`, in
 * order, and record them there.
 *
 * @returns the ids that ran (empty when nothing was pending)
 */
export function runPendingMigrations(
    settings: PluginSettings,
    migrations: readonly SettingsMigration[] = SETTINGS_MIGRATIONS
): string[] {
    const ran: string[] = []
    for (const migration of migrations) {
        if (settings.completedMigrations.includes(migration.id)) continue
        migration.migrate(settings)
        settings.completedMigrations.push(migration.id)
        ran.push(migration.id)
    }
    return ran
}
