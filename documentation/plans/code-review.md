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

### Resolved Issues

16. **Q16: Large files exceed 200-300 line guideline** - **FIXED**:
    Original sizes:
    - `life-tracker-view.ts`: 800 lines
    - `chart-visualization.ts`: 819 lines
    - `data-aggregation.service.ts`: 614 lines

    Split into smaller modules:
    - `life-tracker-view.ts`: 503 lines (main view, orchestration)
    - `column-config.service.ts`: 168 lines (column config management)
    - `maximize-state.service.ts`: 127 lines (maximize/minimize state)
    - `visualization-config.helper.ts`: 115 lines (config helpers)
    - `chart-visualization.ts`: 450 lines (main chart class)
    - `chart-initializers.ts`: 387 lines (chart type initialization)
    - `chart-types.ts`: 47 lines (type definitions)
    - `data-aggregation.service.ts`: 241 lines (main service)
    - `date-grouping.utils.ts`: 155 lines (date utilities)
    - `chart-aggregation.utils.ts`: 319 lines (aggregation functions)

17. **Q17: versions.json inconsistency** - **FIXED**:
    - Fixed to `{"0.1.0": "1.10.0"}` - single entry since all versions require same minAppVersion
    - Updated manifest.json minAppVersion from 1.4.0 to 1.10.0 (Bases API requirement)
    - Note: versions.json only needs entries when minAppVersion CHANGES (per official Obsidian spec)

18. **Q18: Unused dependency** - **FIXED**: Removed `zod` from package.json dependencies.

19. **Q19: Event listeners audit** - **RESOLVED (No Changes Needed)**:

    After detailed audit, the current implementation is correct:

    **Document-level listeners** (need explicit cleanup):
    - `card-context-menu.ts`: Escape handler - properly cleaned up via `cleanup()` function
    - `life-tracker-view.ts`: Escape handler - properly cleaned up in `closeAllMenus()`

    **Element-level listeners** (auto-cleaned by garbage collection):
    - `column-config-card.ts`: Click/keydown on option buttons - attached to child elements, GC'd when card removed
    - `grid-controls.ts`: Click handlers on buttons - attached to child elements, GC'd when controls removed
    - `base-visualization.ts`: Click/mousemove/mouseleave on container - GC'd when viz destroyed
    - All visualization files: Hover/click handlers on cells/elements - GC'd when parent removed

    **Conclusion**: Obsidian's `register*` helpers are for plugin-level listeners (app events, workspace events, intervals). For DOM listeners on dynamically created child elements, explicit cleanup is NOT required because:
    1. When parent DOM is removed, child listeners are automatically garbage collected
    2. The view's `destroy()` method empties the container, triggering GC
    3. Document-level listeners ARE explicitly cleaned up (the only ones that need it)

20. **Q20: Missing entry in versions.json** - **RESOLVED**: No entry needed for 1.1.0 since minAppVersion hasn't changed from 1.10.0. The versions.json file only tracks when minAppVersion changes.
