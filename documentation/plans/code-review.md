# Code Review - Life Tracker Plugin

## Review Status

| File                                                                   | Status  | Issues |
| ---------------------------------------------------------------------- | ------- | ------ |
| src/main.ts                                                            | Done    | 0      |
| src/app/plugin.ts                                                      | Done    | 2      |
| src/app/domain/time-granularity.enum.ts                                | Done    | 0      |
| src/app/domain/visualization-type.enum.ts                              | Done    | 0      |
| src/app/domain/visualization-options.ts                                | Done    | 0      |
| src/app/types/plugin-settings.intf.ts                                  | Done    | 1      |
| src/app/types/column-config.types.ts                                   | Done    | 1      |
| src/app/types/date-anchor.types.ts                                     | Done    | 1      |
| src/app/types/visualization.types.ts                                   | Done    | 0      |
| src/app/settings/settings-tab.ts                                       | Done    | 2      |
| src/app/services/date-anchor.service.ts                                | Done    | 1      |
| src/app/services/data-aggregation.service.ts                           | Done    | 2      |
| src/app/view/view-options.ts                                           | Done    | 1      |
| src/app/view/life-tracker-view.ts                                      | Done    | 0      |
| src/app/components/ui/card-context-menu.ts                             | Done    | 2      |
| src/app/components/ui/column-config-card.ts                            | Done    | 2      |
| src/app/components/ui/empty-state.ts                                   | Done    | 1      |
| src/app/components/ui/grid-controls.ts                                 | Done    | 0      |
| src/app/components/ui/tooltip.ts                                       | Done    | 2      |
| src/app/components/visualizations/base-visualization.ts                | Done    | 1      |
| src/app/components/visualizations/chart/chart-visualization.ts         | Skipped | -      |
| src/app/components/visualizations/heatmap/heatmap-renderer.ts          | Skipped | -      |
| src/app/components/visualizations/heatmap/heatmap-visualization.ts     | Skipped | -      |
| src/app/components/visualizations/tag-cloud/tag-cloud-visualization.ts | Skipped | -      |
| src/app/components/visualizations/timeline/timeline-visualization.ts   | Skipped | -      |
| src/utils/log.ts                                                       | Done    | 1      |
| src/utils/color-utils.ts                                               | Done    | 1      |
| src/utils/date-utils.ts                                                | Skipped | -      |
| src/utils/value-extractors.ts                                          | Done    | 0      |

## Issues Found

### Fixed (2025-12-12)

1. **Memory leak bug** - `card-context-menu.ts`: Escape handler in custom scale modal was only removed on Escape press, not when Cancel/Apply clicked. **Fixed**: Created `cleanup()` function called from all close paths.

2. **Unused `enabled` setting** - `plugin-settings.intf.ts` & `plugin.ts`: `enabled` field was loaded but never used. **Fixed**: Removed from interface, defaults, and loading code.

3. **String literals instead of enum** - Multiple files used string literals instead of enum values:
    - `column-config.types.ts`: SCALE_SUPPORTED_TYPES used `'heatmap' as VisualizationType`
    - `date-anchor.types.ts`: DatePattern.granularity used string literals
    - `tooltip.ts`: Used `'daily' as TimeGranularity`
    - `date-utils.ts`: DATE_PATTERNS and formatDateByGranularity used string literals
      **Fixed**: All updated to use proper enum values (VisualizationType._, TimeGranularity._).

4. **Missing await** - `plugin.ts`: `this.saveSettings()` not awaited. **Was already fixed** in a previous session.

5. **Duplicated SCALE_PRESETS** - Same scale presets defined in 3 files. **Fixed**: Consolidated into `visualization-options.ts` as `SCALE_PRESETS` and `SCALE_PRESETS_RECORD`.

6. **Unused re-exports** - Three files had unused `VISUALIZATION_OPTIONS` re-exports "for backwards compatibility". **Fixed**: Removed from `settings-tab.ts`, `card-context-menu.ts`, and `column-config-card.ts`.

7. **Outdated comment** - `view-options.ts`: Comment said DEFAULT_EMBEDDED_HEIGHT is "unused" but it IS used. **Fixed**: Updated comment.

### To Decide (Unused Code)

These are unused code items that may be kept for future use or removed for cleanliness:

8. **Unused helper methods** - `date-anchor.service.ts`: `createPropertyConfig`, `createFilenameConfig`, `createMetadataConfig` never used.
9. **Unused method** - `data-aggregation.service.ts`: `matchesByGranularity()` never used.
10. **Wrapper method** - `data-aggregation.service.ts`: `aggregateForRadarChart()` just delegates to `aggregateForChart()`.
11. **Unused functions** - `empty-state.ts`: `createLoadingState` and `createErrorState` never used.
12. **Unused function** - `tooltip.ts`: `formatChartTooltip` never used.
13. **Unused method** - `base-visualization.ts`: `showLoading()` never called.
14. **Unused export** - `log.ts`: `LOG_SEPARATOR` exported and tested but never used in production.
15. **Unused color utils** - `color-utils.ts`: `generateGradient`, `getThemeAwareHeatmapColors`, `DARK_HEATMAP_COLORS` tested but not used.
