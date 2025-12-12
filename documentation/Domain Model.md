# Domain Model

## Enums

### VisualizationType

Rendering type for data: `Heatmap`, `LineChart`, `BarChart`, `AreaChart`, `PieChart`, `DoughnutChart`, `RadarChart`, `PolarAreaChart`, `ScatterChart`, `BubbleChart`, `TagCloud`, `Timeline`

### TimeGranularity

Time grouping: `Daily`, `Weekly`, `Monthly`, `Quarterly`, `Yearly`

## Core Types

### ScaleConfig

Min/max bounds for numeric visualizations. `null` = auto-detect from data.

### ColumnVisualizationConfig

Per-property visualization settings stored in view config:

- `propertyId`: Bases property ID
- `visualizationType`: Selected visualization
- `displayName`: Cached display name
- `scale`: Optional ScaleConfig

### PropertyVisualizationPreset

Global preset (plugin settings) auto-applied by property name pattern:

- `propertyNamePattern`: Case-insensitive match
- `visualizationType`: Visualization to use
- `scale`: Optional scale

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
