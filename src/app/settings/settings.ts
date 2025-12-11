/**
 * Global plugin configuration stored in data.json.
 *
 */
export interface PluginSettings {
    /** Global plugin settings */
    globalSettings: Record<string, unknown>
}

/**
 * Default plugin settings.
 *
 */
export const DEFAULT_SETTINGS: PluginSettings = {
    globalSettings: {}
}
