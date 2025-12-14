/**
 * Describes what changed in settings to enable targeted updates
 */
export type SettingsChangeInfo =
    | { type: 'preset-updated'; presetId: string }
    | { type: 'preset-added'; presetId: string }
    | { type: 'preset-deleted'; presetId: string }
    | { type: 'animation-duration-changed' }
    | { type: 'property-definitions-changed' }
    | { type: 'confetti-setting-changed' }
    | { type: 'full' } // Generic change requiring full refresh
