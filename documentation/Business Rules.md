# Business Rules

This document defines the core business rules. These rules MUST be respected in all implementations unless explicitly approved otherwise.

---

## Documentation Guidelines

When a new business rule is mentioned:

1. Add it to this document immediately
2. Use a concise format (single line or brief paragraph)
3. Maintain precision - do not lose important details for brevity
4. Include rationale where it adds clarity

---

## Date Anchor Resolution

Priority order for resolving an entry's date:

1. Filename pattern (YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq)
2. Configured date anchor property
3. File metadata (ctime, mtime)

## Configuration Priority

1. Per-view column config overrides global presets
2. Global presets match by case-insensitive property name
3. Unconfigured properties show selection card

## Visualization Types

- Scale-supporting types: Heatmap, BarChart, LineChart, AreaChart, RadarChart, ScatterChart, BubbleChart
- Non-scale types: PieChart, DoughnutChart, PolarAreaChart, TagCloud, Timeline
- Color scheme-supporting types: Heatmap, BarChart, LineChart, AreaChart, PieChart, DoughnutChart, RadarChart, PolarAreaChart, ScatterChart, BubbleChart, Timeline
- Non-color scheme types: TagCloud

## Maximize State

- Only configured cards (with `data-property-id`) participate in maximize/minimize
- Unconfigured cards are hidden when another card is maximized, but never receive maximize state
- Escape key minimizes the currently maximized card
- Overlay visualizations use their overlay ID as the data-property-id, allowing them to be maximized independently
- Each overlay is treated as an independent visualization for maximize purposes
- When overlays are maximized/minimized, they receive the maximize state but are not re-rendered (overlays use pre-aggregated chart data)

## Property Types in Visualizations

All property types are supported for visualization rendering:

- `note.*` - frontmatter properties from notes (e.g., `note.energy_level`)
- `formula.*` - computed formula columns in Bases (e.g., `formula.weekly_average`)
- `file.*` - file metadata (e.g., `file.ctime`, `file.mtime`, `file.size`)

## Animation and State Transitions

- Ongoing animations must be stopped before maximizing or minimizing a visualization

## Capture Command Dataset

When the "Capture properties" command is invoked from a custom base view (Life Tracker or Life Tracking Grid):

- The file list passed to the capture modal MUST respect the view's configured time frame
- Only files within the selected time frame are included in the batch
- Entries without date anchors are included (not filtered out)
- This ensures users only capture data for the period they're currently viewing

## Release Tags

- Tags MUST NOT have 'v' prefix per Obsidian plugin spec (e.g., `1.0.0` not `v1.0.0`)

## Overlay Charts

- Overlay visualizations require at least 2 properties
- Only cartesian chart types support overlay mode: LineChart, BarChart, AreaChart
- Legends are always shown for overlay charts (to identify each property's line/bar)
- When a property in an overlay is removed from Base, it is automatically removed from the overlay
- If an overlay drops below 2 properties after cleanup, the overlay is deleted entirely
- Overlays are rendered after all individual property visualizations
- Overlays can optionally hide individual property visualizations via `hideIndividualVisualizations` setting
- When a property is in multiple overlays, it is hidden if ANY overlay has `hideIndividualVisualizations` enabled
- Data points are still cached for hidden properties (needed for overlay rendering)

## Property Removal Cleanup

- When properties are removed from Base, orphaned column configs are automatically cleaned up
- Cleanup runs after each full view re-render (not during incremental updates)
- Both individual property configs and overlay configs are cleaned

## List Property Visualizations

- List properties (arrays of values) are automatically detected and visualized appropriately
- For pie/doughnut/polarArea charts: counts individual value occurrences across all entries (case-insensitive grouping)
- For cartesian charts (line/bar/area/radar): creates one dataset per unique value showing 0/1 presence per time period
- Case-insensitive matching: "Running", "running", "RUNNING" are grouped together
- Display labels use capitalized first letter (e.g., "Running" not "running")
- Legends are always shown when multiple datasets exist (list data, overlays)

## Reference Lines

- Reference lines are only supported for cartesian chart types: LineChart, BarChart, AreaChart
- Reference lines are disabled by default and must be explicitly enabled per property
- For overlay charts, each property can have its own independent reference line
- Reference line colors match the dataset color for visual consistency
- Default label format is "Target: {value}" if no custom label is provided
