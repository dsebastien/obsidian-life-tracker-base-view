# Architecture

## Overview

Obsidian plugin providing a custom Base View ("Life Tracker") for visualizing tracked data.

## Directory Structure

```
src/
  main.ts                    # Re-export only
  app/
    plugin.ts                # Plugin lifecycle, settings management, view registration
    settings/
      settings-tab.ts        # Plugin settings UI
    types/
      plugin-settings.intf.ts      # PluginSettings, PropertyVisualizationPreset
      column-config.types.ts       # ColumnVisualizationConfig, ScaleConfig
      visualization-type.intf.ts   # VisualizationType enum
      time-granularity.intf.ts     # TimeGranularity enum
      visualization-options.intf.ts # UI options for menus/cards
      visualization.types.ts       # Data structures for visualizations
      date-anchor.types.ts         # Date anchor types
    services/
      date-anchor.service.ts       # Extract dates from entries (filename, properties)
      data-aggregation.service.ts  # Aggregate data for visualizations
      chart-aggregation.utils.ts   # Chart-specific aggregation
      date-grouping.utils.ts       # Time period grouping
    view/
      life-tracker-view.ts         # Main BasesView implementation
      view-options.ts              # View option definitions
      column-config.service.ts     # Per-column config management
      maximize-state.service.ts    # Card maximize/minimize state
      visualization-config.helper.ts # Build visualization configs
    components/
      ui/
        card-context-menu.ts       # Right-click menu
        column-config-card.ts      # Unconfigured property card
        grid-controls.ts           # Column/height controls
        empty-state.ts             # No data states
        tooltip.ts                 # Shared tooltip
      visualizations/
        base-visualization.ts      # Abstract base class
        heatmap/                   # GitHub-style heatmap
        chart/                     # Chart.js wrapper (line, bar, area, pie, etc.)
        tag-cloud/                 # Frequency-sized tags
        timeline/                  # Date distribution
  utils/
    date-utils.ts            # Date parsing, formatting
    color-utils.ts           # Heatmap color scales
    value-extractors.ts      # Extract values from Obsidian Value types
    log.ts                   # Debug logging
  styles.src.css             # Tailwind source (compiled to styles.css)
```

## Key Components

### Plugin (`plugin.ts`)

- Registers "life-tracker" BasesView via `registerBasesView()`
- Manages immutable settings with immer
- Notifies views on settings changes

### LifeTrackerView (`view/life-tracker-view.ts`)

- Extends `BasesView`
- Renders grid of visualization cards
- Delegates to services for data processing
- Creates visualization instances per property

### Services

- **DateAnchorService**: Resolves date for each entry (filename pattern > property > file metadata)
- **DataAggregationService**: Groups data by time granularity, produces visualization-ready structures
- **ColumnConfigService**: Manages per-property visualization configs (persisted in view config)
- **MaximizeStateService**: Handles card maximize/minimize state, escape key handler

### Visualizations

All extend `BaseVisualization`:

- `HeatmapVisualization`: GitHub contribution-style grid
- `ChartVisualization`: Chart.js wrapper for 9 chart types
- `TagCloudVisualization`: Frequency-weighted tags
- `TimelineVisualization`: Horizontal date distribution

## Data Flow

```
BasesEntry[] → DateAnchorService → DataAggregationService → Visualization.render()
```

1. Entries from Obsidian Bases API
2. Date anchors resolved per entry
3. Data aggregated by granularity
4. Visualization renders to DOM
