# Code Review - Life Tracker Plugin

**IMPORTANT**: When adding or updating features, ALWAYS verify compliance with the guidelines in [AGENTS.md](../../AGENTS.md). This includes:

- Obsidian plugin development best practices
- Security, privacy, and compliance requirements
- Code organization and TypeScript conventions
- Event listener cleanup using `register*` helpers
- File size limits (~200-300 lines per file)
- Mobile compatibility considerations

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
    - `date-utils.ts`: DATE*PATTERNS and formatDateByGranularity used string literals
      **Fixed**: All updated to use proper enum values (VisualizationType.*, TimeGranularity.\_).

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

---

## AGENTS.md Guidelines Compliance Review

### Compliant

- **main.ts is minimal**: Only re-exports the plugin class (4 lines)
- **manifest.json complete**: Has all required fields (id, name, version, minAppVersion, description, isDesktopOnly, author, authorUrl, fundingUrl)
- **No network calls**: Plugin operates entirely locally
- **No telemetry**: No hidden analytics or data collection
- **Async/await used**: No `.then()` promise chains found
- **Chart.js cleanup**: `destroy()` properly called on chart instances
- **ResizeObserver cleanup**: Properly disconnected in `cleanupResizeObserver()`
- **Escape handler cleanup**: Fixed - `removeEventListener` called in cleanup paths
- **isDesktopOnly: false**: Plugin designed for mobile compatibility

### Potential Issues to Discuss

16. **Q16: Large files exceed 200-300 line guideline**:
    - `life-tracker-view.ts`: 800 lines
    - `chart-visualization.ts`: 819 lines
    - `data-aggregation.service.ts`: 614 lines
    - Should these be split into smaller modules?

17. **Q17: versions.json inconsistency** - Contains:

    ```json
    {
        "1.0.0": "0.15.0",
        "0.1.0": "1.4.0"
    }
    ```

    Current manifest is v1.1.0 with minAppVersion 1.4.0. Missing entry for 1.1.0. Also "1.0.0": "0.15.0" seems wrong (0.15.0 is very old). Should this be cleaned up?

18. **Q18: Unused dependency** - `zod` is in package.json dependencies but not imported anywhere in src/. Remove?

19. **Q19: Event listeners without register\* helpers** - Several UI components use raw `addEventListener` without Obsidian's `register*` helpers:
    - `column-config-card.ts`: 5 addEventListener calls
    - `grid-controls.ts`: 3 addEventListener calls
    - `card-context-menu.ts`: 4 addEventListener calls (modal)
    - `base-visualization.ts`: 4 addEventListener calls
    - `heatmap-visualization.ts`: 4 addEventListener calls
    - `timeline-visualization.ts`: 3 addEventListener calls
    - `tag-cloud-visualization.ts`: 3 addEventListener calls

    **Note**: These are on dynamically created DOM elements that get removed when the view is destroyed, so memory leaks are unlikely. However, the AGENTS.md guideline says "Use `this.register*` helpers for everything that needs cleanup." Should we audit these more carefully, or is the current cleanup sufficient?

20. **Q20: Missing entry in versions.json** - Current version 1.1.0 not listed. Add it?
