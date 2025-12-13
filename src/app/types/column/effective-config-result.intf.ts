import type { ColumnVisualizationConfig } from './column-config.types'

/**
 * Result of getting effective configuration for a column.
 * When getEffectiveConfig returns a result (not null), config is always defined.
 */
export interface EffectiveConfigResult {
    config: ColumnVisualizationConfig
    isFromPreset: boolean
}
