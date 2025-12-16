# Configuration

## Plugin Settings (Global)

Stored in plugin data, applies to all views.

| Setting                | Type                          | Default | Description                                       |
| ---------------------- | ----------------------------- | ------- | ------------------------------------------------- |
| `visualizationPresets` | PropertyVisualizationPreset[] | `[]`    | Auto-apply visualization by property name pattern |
| `animationDuration`    | number                        | `3000`  | Chart animation duration (ms)                     |

## Life Tracker View Options (Per-View)

Configured via Obsidian's view options UI.

| Option               | Type            | Default    | Description                                                 |
| -------------------- | --------------- | ---------- | ----------------------------------------------------------- |
| `granularity`        | TimeGranularity | `daily`    | Time grouping for aggregation                               |
| `timeFrame`          | TimeFrameId     | `all_time` | Filter data range (all_time, last_7_days, this_month, etc.) |
| `dateAnchorProperty` | property        | (none)     | Override date anchor property                               |
| `embeddedHeight`     | number          | `400`      | Height in embedded mode (px)                                |
| `cellSize`           | number          | `12`       | Heatmap cell size (px)                                      |
| `showEmptyDates`     | boolean         | `true`     | Show dates with no data                                     |
| `showDayLabels`      | boolean         | `true`     | Show day labels on heatmaps                                 |
| `showMonthLabels`    | boolean         | `true`     | Show month labels on heatmaps                               |
| `heatmapColorScheme` | string          | `green`    | Heatmap color preset                                        |
| `gridColumns`        | number          | `3`        | Grid columns (1-6)                                          |
| `showLegend`         | boolean         | `true`     | Show chart legends                                          |

## Grid View Options (Per-View)

Configured via Obsidian's view options UI.

| Option          | Type            | Default    | Description                                                |
| --------------- | --------------- | ---------- | ---------------------------------------------------------- |
| `timeFrame`     | TimeFrameId     | `all_time` | Filter notes by date range                                 |
| `hideNotesWhen` | BatchFilterMode | `required` | Hide notes when properties are filled (required/all/never) |

## Time Frame Options

Available time frames for filtering visualization data:

| ID              | Description        |
| --------------- | ------------------ |
| `all_time`      | All available data |
| `last_7_days`   | Last 7 days        |
| `last_30_days`  | Last 30 days       |
| `last_90_days`  | Last 90 days       |
| `last_365_days` | Last 365 days      |
| `this_week`     | Current week       |
| `this_month`    | Current month      |
| `this_quarter`  | Current quarter    |
| `this_year`     | Current year       |
| `last_week`     | Previous week      |
| `last_month`    | Previous month     |
| `last_quarter`  | Previous quarter   |
| `last_year`     | Previous year      |

## Per-Column Config (Per-View)

Stored in view config under `columnConfigs` key.

| Field               | Description                       |
| ------------------- | --------------------------------- |
| `propertyId`        | Bases property ID                 |
| `visualizationType` | Selected visualization            |
| `displayName`       | Cached property name              |
| `configuredAt`      | Timestamp                         |
| `scale`             | Optional {min, max}               |
| `colorScheme`       | Optional color scheme             |
| `showLegend`        | Optional per-column legend toggle |
| `showGridLines`     | Optional per-column grid toggle   |

## Scale Presets

Available via context menu: `0-1`, `0-5`, `1-5`, `0-10`, `1-10`, `0-100`, or auto-detect.

## Heatmap Color Schemes

`green` (default), `blue`, `purple`, `orange`, `red`
