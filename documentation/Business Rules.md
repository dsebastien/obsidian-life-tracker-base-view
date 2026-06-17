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
- By default, overlays render after all individual property visualizations. Once the user reorders cards via drag-and-drop, overlays follow the saved manual order (see Card Ordering)
- Overlays can optionally hide individual property visualizations via `hideIndividualVisualizations` setting
- When a property is in multiple overlays, it is hidden if ANY overlay has `hideIndividualVisualizations` enabled
- Data points are still cached for hidden properties (needed for overlay rendering)

## Card Ordering

- Default order: Obsidian's property order (from `BasesViewConfig.getOrder()`), followed by overlay cards in their stored order
- Users can override the default by drag-and-drop on any card (property or overlay) using the grip handle in the card's top-left corner. The override is saved per Base view (in `manualOrder` under the view's config), so different `.base` files and different views of the same `.base` file each have their own order
- Reconciliation rules when a manual order is present:
    - Entries in the manual order whose target no longer exists (property removed from Base, overlay deleted) are dropped silently
    - New properties or overlays that aren't in the manual order yet are appended at the end of the natural order, so they're always discoverable
- A "Reset order" button appears in the controls bar whenever a manual order is set; clicking it clears `manualOrder` and reverts to the default
- Drag-and-drop uses Pointer events so it works identically on desktop (mouse) and mobile (touch)

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

## Missing Values in Charts

- Missing (null) values are skipped during aggregation, never coerced to 0 — a 0 would skew averages and render fake dips (issue #92)
- Periods that exist but contain only empty entries yield `null` data points, rendered as gaps by Chart.js
- Scatter and bubble charts skip valueless entries entirely (no point/bubble at 0)

## Heatmap Aggregation

- Multiple entries falling in the same cell period are combined via the configured aggregation method: `average` (default, preserves prior behavior) or `sum` for counter-style tracking (calories, sessions per day) — issue #98. Same `average | sum` model as charts (#89). Cell min/max (and therefore color scaling) follow the aggregated value.

## Week Start

- Week grouping (weekly granularity buckets), heatmap week columns, and "this week"/"last week" time frames honor a configurable first day of the week (`weekStartsOn`: Monday default, Sunday optional) — issue #99.
- ISO week parsing and labels (`YYYY-Www` filenames, week numbers) remain Monday-based per ISO-8601 regardless of the setting.

## Heatmap Streaks

- A period is streak-active when its cell value is non-null and non-zero — consistent with heatmap rendering where 0 on a 0-based scale shows as absence (issue #87)
- The current streak counts only when the trailing run reaches the current period or the immediately preceding one (today's data may not be captured yet)
- Consecutiveness is calendar-based per granularity (cells can be sparse)

## Data Entry Safety

- Pending debounced edits MUST be flushed to disk before any editor teardown (re-render, unload) — typed values are never silently discarded (issue #90)
- Invalid non-empty values never reach disk; writing an empty value clears the property (issue #91)
- Failed frontmatter writes are surfaced to the user via a Notice

## Batch Capture Provider Resolution

- File providers (views supplying files for batch capture) are kept in a recency-ordered registry; the most recently interacted-with view wins (issue #96)
- Views register on creation, bump on pointer/focus interaction, and unregister only themselves on unload

## Moving Average

- Only line and area charts support the moving average overlay; offered windows are 7, 14, and 30 periods
- Only single-dataset numeric charts get the overlay (list data and overlay charts already carry multiple datasets)
- Missing periods are skipped inside the window, never counted as 0
- Rendered as a thin dashed line in the dataset's color, without points or fill

## Trend Indicator

- Shown automatically on single-dataset cartesian charts (line, bar, area) with enough data for two comparison windows
- Compares the mean of the last N periods (N = min(7, half the data)) against the previous N; changes below 2% read as flat
- The arrow color stays neutral: whether "up" is good depends on the tracked metric (see issue #21)

## Visualization Export

- CSV export serializes exactly what the visualization displays (aggregated values), not raw frontmatter
- Image export requires a canvas, so it is only offered for Chart.js types
- Exports are written to the vault's attachment folder via `getAvailablePathForAttachment`

## Capture Today Command

- Resolves today's note by exact basename match on the daily filename pattern (YYYY-MM-DD)
- When several notes match, the most recently modified one wins

## Reduced Motion

- Decorative animations (confetti, Chart.js animations, CSS keyframe animations) MUST respect the OS-level `prefers-reduced-motion` setting (issue #109)

## Reference Lines

- Reference lines are only supported for cartesian chart types: LineChart, BarChart, AreaChart
- Reference lines are disabled by default and must be explicitly enabled per property
- For overlay charts, each property can have its own independent reference line
- Reference line colors match the dataset color for visual consistency
- Default label format is "Target: {value}" if no custom label is provided
