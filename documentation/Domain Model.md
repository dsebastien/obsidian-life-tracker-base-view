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
- `displayName`: Cached display name
- `scale`: Optional ScaleConfig
- `colorScheme`: Optional color scheme override
- `heatmapCellSize`: Optional heatmap cell size override
- `heatmapShowMonthLabels`: Optional heatmap month labels visibility
- `heatmapShowDayLabels`: Optional heatmap day labels visibility

**Note**: A property can have multiple visualizations, each independently configurable. The `ColumnConfigMap` stores arrays of configs per property.

### PropertyVisualizationPreset

Global preset (plugin settings) auto-applied by property name pattern:

- `propertyNamePattern`: Case-insensitive match
- `visualizationType`: Visualization to use
- `scale`: Optional scale
- `colorScheme`: Optional color scheme

## Data Structures

### VisualizationDataPoint

Single data point for visualization:

- `entry`: Source BasesEntry
- `dateAnchor`: Resolved date (or null)
- `value`: String representation
- `normalizedValue`: Numeric extraction (or null)

### HeatmapData / ChartData / TagCloudData / TimelineData

Aggregated data ready for rendering. Contains cells/points grouped by time period with min/max ranges.

## Configuration Hierarchy

1. **Per-view column config** (stored in view config) - highest priority
2. **Global presets** (plugin settings) - matched by property name
3. **Unconfigured** - shows config card for user selection
