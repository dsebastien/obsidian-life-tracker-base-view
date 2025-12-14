import type { PluginSettings } from './plugin-settings.intf'
import type { SettingsChangeInfo } from './settings-change-info.intf'

/**
 * Callback type for settings change listeners
 * @param settings - The updated settings
 * @param changeInfo - Information about what changed (enables targeted updates)
 */
export type SettingsChangeCallback = (
    settings: PluginSettings,
    changeInfo: SettingsChangeInfo
) => void
