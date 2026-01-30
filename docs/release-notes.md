# Release Notes

## 2.6.2 (2026-01-30)

### Features

- **all:** added release and validate scripts

## 2.6.1 (2026-01-30)

### Features

- **all:** isolated styles and removed tw reset

## 2.6.0 (2026-01-05)

### Features

- **all:** added support for value mappings

## 2.5.0 (2026-01-03)

### Features

- **all:** added reference line support in visualization customizations
- **all:** added support for reference lines on visualizations with multiple properties

### Bug Fixes

- **all:** fixed issue with maximizing charts with multiple props

## 2.4.0 (2026-01-03)

### Features

- **all:** add better support for lists. The values are now considered in isolation and aggregated correctly

### Bug Fixes

- **all:** fixed broken test

## 2.3.0 (2025-12-22)

### Features

- **all:** added support for creating visualizationss with multiple properties

## 2.2.1 (2025-12-20)

### Bug Fixes

- **all:** fixed default state for show empty values

## 2.2.0 (2025-12-17)

## 2.1.0 (2025-12-17)

### Features

- **all:** enabled adding multiple visualizations for the same property

## 2.0.0 (2025-12-16)

### Features

- **all:** enabled changing the time frame for the life tracking grid (base view options)

### Bug Fixes

- **all:** filtered the dataset given to the bulk processing command

## 1.9.0 (2025-12-16)

### Features

- **all:** enabled changing the time frame for the life tracker view
- **all:** improved visualizations resizing based on available space

### Bug Fixes

- **all:** removed visualization as soon as a property is removed from the life tracker view

## 1.8.1 (2025-12-16)

### Features

- **all:** enabed copying an existing property definition

## 1.8.0 (2025-12-16)

### Features

- **all:** added more per-visualization customization options for heatmaps
- **all:** enabled customizing visualization colors

### Bug Fixes

- **all:** better handled color customization for boolean pie and doughtnut charts
- **all:** fixed tooltip display for heatmaps

## 1.7.0 (2025-12-15)

### Features

- **all:** enabled using default values in the data entry modal
- **all:** made the grid responsive (becomes a cards view on mobile)

## 1.6.0 (2025-12-15)

### Features

- **all:** added support for rendering visualizations for formulas
- **all:** added support for rendering visualizing properties (eg file tags as a cloud)
- **all:** better handled different chart types and fixed rendering
- **all:** enabled reordering property definitions
- **all:** harmonized label generation across all chart types
- **all:** normalized chart sizes
- **all:** reduced the number of visualization re-renders after configuration or data changes
- **all:** removed the card height setting in the Life Tracker Base view

### Bug Fixes

- **all:** added some delay to validations in the grid to avoid losing input focus too quickly
- **all:** fixed issue where the visualization context menu did not reflect the current state
- **all:** fixed label positioning for timeline chart
- **all:** fixed labels for timeline charts
- **all:** stop animations when maximizing/minimizing charts
- **all:** the cached data is now updated correctly when base data changes

## 1.5.0 (2025-12-14)

### Features

- **all:** added mobile support for the data entry modal

## 1.4.0 (2025-12-14)

### Features

- **all:** better handle the date anchor setting and add support for more date/time formats
- **all:** display boolean values more nicely (True|False instead of true|false)
- **all:** improved performances of the Life Tracker view

### Bug Fixes

- **all:** fixed rendering of the property edition modal (space for slider vs space for input)

## 1.3.0 (2025-12-14)

### Features

- **all:** assigned colors based on value for boolean data
- **all:** improved performances by limiting re-rendering
- **all:** improved rendering of line charts

### Bug Fixes

- **all:** improved rendering of heatmap visualizations (fixed misalignment)

## 1.2.0 (2025-12-13)

### Features

- **all:** added batch mode support for the command and modal
- **all:** added capture command and a new grid base view type
- **all:** enhanced handling of empty/null values in visualizations (new setting)
- **all:** improved navigation across properties with the modal
- **all:** improved validation in modal and grid. Only valid values may be entered now

### Bug Fixes

- **all:** fixed bug where the heatmap color did not changed according to the setting

## 1.1.1 (2025-12-12)

### Bug Fixes

- **all:** fixed issue where after minimizing a maximized card, another was maximized
- **all:** fixed the release workflow to name the tags correctly

## 1.1.0 (2025-12-12)

### Features

- **all:** avoid fully recreating the base view when grid settings are changed (eg number of columns)
- **all:** renamed the plugin (wider scope)

## 1.0.0 (2025-12-12)

### Bug Fixes

- **all:** fix matching between columns and global visualization presets

## 0.2.0 (2025-12-12)

### Features

- **all:** added new visualization types

### Bug Fixes

- **all:** fix issue with settings update

## 0.1.0 (2025-12-12)

### Features

- **all:** adapt visualizations based on date granularity
- **all:** added github ci and release workflows
- **all:** added plugin shell
- **all:** added release scripts
- **all:** added setting for the animation duration
- **all:** handle copying the assets in the build script and also copying the required files
- **all:** improve the display and controls
- **all:** improved animations (show values over time)
- **all:** initial implementation (vibe-coded)
- **all:** removed animations for heatmaps (nok)
- **all:** updated build to also take care of the CSS with Tailwind
- **build:** handle copying manifest.json and versions.js in the build script
