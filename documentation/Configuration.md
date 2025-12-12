# Configuration

## Plugin Settings (Global)

Stored in plugin data, applies to all views.

| Setting                | Type                          | Default | Description                                       |
| ---------------------- | ----------------------------- | ------- | ------------------------------------------------- |
| `visualizationPresets` | PropertyVisualizationPreset[] | `[]`    | Auto-apply visualization by property name pattern |
| `animationDuration`    | number                        | `3000`  | Chart animation duration (ms)                     |

## View Options (Per-View)

Configured via Obsidian's view options UI.

| Option               | Type            | Default | Description                   |
| -------------------- | --------------- | ------- | ----------------------------- |
| `granularity`        | TimeGranularity | `daily` | Time grouping for aggregation |
| `dateAnchorProperty` | property        | (none)  | Override date anchor property |
| `embeddedHeight`     | number          | `400`   | Height in embedded mode (px)  |
| `cellSize`           | number          | `12`    | Heatmap cell size (px)        |
| `showEmptyDates`     | boolean         | `true`  | Show dates with no data       |
| `showDayLabels`      | boolean         | `true`  | Show day labels on heatmaps   |
| `showMonthLabels`    | boolean         | `true`  | Show month labels on heatmaps |
| `heatmapColorScheme` | string          | `green` | Heatmap color preset          |
| `gridColumns`        | number          | `3`     | Grid columns (1-6)            |
| `cardMinHeight`      | number          | `300`   | Card minimum height (px)      |
| `showLegend`         | boolean         | `true`  | Show chart legends            |

## Per-Column Config (Per-View)

Stored in view config under `columnConfigs` key.

| Field               | Description            |
| ------------------- | ---------------------- |
| `propertyId`        | Bases property ID      |
| `visualizationType` | Selected visualization |
| `displayName`       | Cached property name   |
| `configuredAt`      | Timestamp              |
| `scale`             | Optional {min, max}    |

## Scale Presets

Available via context menu: `0-1`, `0-5`, `1-5`, `0-10`, `1-10`, `0-100`, or auto-detect.

## Heatmap Color Schemes

`green` (default), `blue`, `purple`, `orange`, `red`
