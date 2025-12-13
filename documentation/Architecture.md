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
      property-definition.types.ts # PropertyDefinition, PropertyType, NumberConstraint
      column-config.types.ts       # ColumnVisualizationConfig, ScaleConfig
      visualization-type.intf.ts   # VisualizationType enum
      time-granularity.intf.ts     # TimeGranularity enum
      visualization-options.intf.ts # UI options for menus/cards
      visualization.types.ts       # Data structures for visualizations
      date-anchor.types.ts         # Date anchor types
    commands/
      index.ts                     # Command registration
      capture-command.ts           # Property capture command
    services/
      date-anchor.service.ts       # Extract dates from entries (filename, properties)
      data-aggregation.service.ts  # Aggregate data for visualizations
      frontmatter.service.ts       # Read/write frontmatter properties
      chart-aggregation.utils.ts   # Chart-specific aggregation
      date-grouping.utils.ts       # Time period grouping
    view/
      life-tracker-view.ts         # Main BasesView (visualizations)
      table-view/
        table-view.ts              # Table BasesView (spreadsheet editing)
        table-view-options.ts      # Table view options
      grid-view/
        grid-view.ts               # Grid BasesView (card editing)
        grid-view-options.ts       # Grid view options
      view-options.ts              # Life tracker view options
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
      editing/
        property-editor.ts         # Property editor factory
        text-editor.ts             # Text/dropdown editor
        number-editor.ts           # Number/slider editor
        boolean-editor.ts          # Toggle/checkbox editor
        date-editor.ts             # Date/datetime editor
        list-editor.ts             # Pill/chip list editor
        validation.utils.ts        # Validation functions
        dirty-state.service.ts     # Track unsaved changes
      modals/
        property-capture-modal.ts  # Capture/edit modal
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

- Registers three BasesViews: life-tracker, life-tracker-table, life-tracker-grid
- Manages immutable settings with immer
- Notifies views on settings changes
- Registers capture command

### Base Views

#### LifeTrackerView (`view/life-tracker-view.ts`)

- Extends `BasesView`
- Renders grid of visualization cards
- Delegates to services for data processing
- Creates visualization instances per property

#### TableView (`view/table-view/table-view.ts`)

- Spreadsheet-style editing interface
- One row per note, one column per property definition
- Inline editors for all property types
- Per-row Save/Reset buttons (disabled when clean)
- Highlights rows with missing/invalid values

#### GridView (`view/grid-view/grid-view.ts`)

- Card-based editing interface
- One card per note with all property fields
- Full-size editors (not compact)
- Per-card Save/Reset buttons
- Visual indicators for dirty/invalid state

### Property Editors

Factory pattern (`property-editor.ts`) creates type-specific editors:

- **TextEditor**: Plain input or dropdown if `allowedValues` defined
- **NumberEditor**: Number input with optional slider for ranges
- **BooleanEditor**: Toggle switch or compact checkbox
- **DateEditor**: Native date/datetime-local picker
- **ListEditor**: Pill/chip interface with autocomplete suggestions

All editors:

- Validate input against property definitions
- Report changes via `onChange` callback
- Support compact mode for table cells

### Services

- **DateAnchorService**: Resolves date for each entry (filename pattern > property > file metadata)
- **DataAggregationService**: Groups data by time granularity, produces visualization-ready structures
- **FrontmatterService**: Read/write frontmatter, validate against property definitions
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
