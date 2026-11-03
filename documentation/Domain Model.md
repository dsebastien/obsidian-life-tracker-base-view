# Domain Model

## Enums

### VisualizationType

Rendering type for data: `Heatmap`, `LineChart`, `BarChart`, `AreaChart`, `PieChart`, `DoughnutChart`, `RadarChart`, `PolarAreaChart`, `ScatterChart`, `BubbleChart`, `TagCloud`, `Timeline`

### TimeGranularity

Time grouping: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`

### TimeFrame

Date range filter for visualizations: `all_time`, `last_7_days`, `last_30_days`, `last_90_days`, `last_365_days`, `this_week`, `this_month`, `this_quarter`, `this_year`, `last_week`, `last_month`, `last_quarter`, `last_year`

## Core Types

### ScaleConfig

Min/max bounds for numeric visualizations. `null` = auto-detect from data.

### ColumnVisualizationConfig

Per-visualization settings stored in view config. Multiple visualizations can exist per property.

- `id`: Unique visualization ID (UUID)
- `propertyId`: Bases property ID
- `visualizationType`: Selected visualization
- `displayName`: Cached display name (written at configuration time)
- `title`: Card title (3.4.0); absent or empty = the property's display name
- `scale`: Optional ScaleConfig
- `colorScheme`: Optional color scheme override
- `heatmapCellSize`: Optional heatmap cell size override
- `heatmapShowMonthLabels`: Optional heatmap month labels visibility
- `heatmapShowDayLabels`: Optional heatmap day labels visibility
- `xAxisSource`: `date` | `note-name` | `date-per-note` (cartesian charts)
- `valueFormat`: `ValueFormat` — `number` | `duration-mm-ss` | `duration-h-mm` (3.4.0)
- `outliers`: `OutlierMode` — `fit` | `show-all` (3.4.0)
- `excludeOutliersFromAverage`: boolean — moving average and trend without outliers (#186); absent = off
- `breakLineAcrossGaps`: boolean — `false` keeps the line whole across gaps (#185); absent = on

**Note**: A property can have multiple visualizations, each independently configurable. The `ColumnConfigMap` stores arrays of configs per property.

### PropertyVisualizationPreset

Global preset (plugin settings) auto-applied by property name pattern:

- `propertyNamePattern`: Case-insensitive match
- `visualizationType`: Visualization to use
- `scale`: Optional scale
- `colorScheme`: Optional color scheme

### FilenameDatePattern

User-defined filename date pattern (plugin settings) used for date anchoring:

- `id`: Unique pattern ID (UUID)
- `pattern`: Template with `{{date}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{week}}`, `{{quarter}}` tokens and `*` wildcards (e.g. `Journal {{date}}`)

Compiled to a `CompiledFilenameDatePattern` (anchored regex + inferred `TimeGranularity` + capture-group token order) before use.

## Data Structures

### VisualizationDataPoint

Single data point for visualization:

- `entry`: Source BasesEntry
- `dateAnchor`: Resolved date (or null)
- `value`: String representation
- `normalizedValue`: Numeric extraction (or null)

### HeatmapData / ChartData / TagCloudData / TimelineData

Aggregated data ready for rendering. Contains cells/points grouped by time period with min/max ranges.

`ChartData` on the date-per-note axis (3.4.0) also carries `xValues` (epoch ms per point; `labels` then hold full note names) and `skippedWithoutDate` (notes left out for lacking a date anchor).

### YAxisPlan (3.4.0)

Output of `planYAxis` (`chart/y-axis-plan.utils.ts`): optional explicit `min`/`max`/`stepSize`, the data each series plots (outliers clamped to the axis edge), and the `clamped` points per series (index, real value, side). `buildCartesianModel` turns it into Chart.js datasets plus one outlier marker dataset per series with clamped points.

## Configuration Hierarchy

1. **Per-view column config** (stored in view config) - highest priority
2. **Global presets** (plugin settings) - matched by property name
3. **Unconfigured** - shows config card for user selection
