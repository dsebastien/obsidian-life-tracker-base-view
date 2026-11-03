import type { GridSettings } from './grid-settings.intf'

/**
 * Callback when the user changes a grid setting in the control bar. Carries
 * only the setting the user changed (issue #189): the view writes that one
 * key, never the rest of its in-memory copy
 */
export type GridSettingsChangeCallback = (change: Partial<GridSettings>) => void
