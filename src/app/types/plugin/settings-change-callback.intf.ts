import type { PluginSettings } from './plugin-settings.intf'

/**
 * Callback type for settings change listeners
 */
export type SettingsChangeCallback = (settings: PluginSettings) => void
