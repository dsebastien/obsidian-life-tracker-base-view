# Life Tracker Base View - Implementation Plan

## Overview

Custom Obsidian Base View that visualizes data as GitHub-contribution-style heatmaps, charts, tag clouds based on auto-detected data types.

## File Structure

```
src/
  main.ts                                    # Unchanged (re-export only)
  app/
    plugin.ts                                # MODIFY: register BasesView
    types/
      plugin-settings.intf.ts                # MODIFY: expanded settings
      visualization.types.ts                 # NEW: viz data structures
      value-types.ts                         # NEW: detected type definitions
      date-anchor.types.ts                   # NEW: date anchoring types
    settings/
      settings-tab.ts                        # MODIFY: settings UI
    services/
      type-detection.service.ts              # NEW: data type detection
      date-anchor.service.ts                 # NEW: date extraction
      data-aggregation.service.ts            # NEW: aggregate for viz
    domain/
      detected-type.enum.ts                  # NEW: Boolean, Number, Date, Tags, etc.
      time-granularity.enum.ts               # NEW: Daily, Weekly, Monthly, Quarterly, Yearly
      visualization-type.enum.ts             # NEW: Heatmap, LineChart, BarChart, TagCloud
    view/
      life-tracker-view.ts                   # NEW: main BasesView implementation
      view-options.ts                        # NEW: getViewOptions() definition
  components/
    visualizations/
      base-visualization.ts                  # NEW: abstract base class
      heatmap/
        heatmap-visualization.ts             # NEW: GitHub-style heatmap
        heatmap-renderer.ts                  # NEW: DOM rendering
      chart/
        chart-visualization.ts               # NEW: Chart.js wrapper
      tag-cloud/
        tag-cloud-visualization.ts           # NEW: tag frequency cloud
      timeline/
        timeline-visualization.ts            # NEW: date timeline
    ui/
      tooltip.ts                             # NEW: shared tooltip
      empty-state.ts                         # NEW: no data state
  utils/
    date-utils.ts                            # NEW: date parsing/formatting
    value-extractors.ts                      # NEW: extract from Value types
    color-utils.ts                           # NEW: color scale generation
  styles.src.css                             # MODIFY: visualization styles
```

## Implementation Phases

### Phase 1: Foundation

**1.1 Enums and Types**

- `src/app/domain/detected-type.enum.ts` - Boolean, Number, Date, Tags, List, String, Unknown
- `src/app/domain/time-granularity.enum.ts` - Daily, Weekly, Monthly, Quarterly, Yearly
- `src/app/domain/visualization-type.enum.ts` - Heatmap, LineChart, BarChart, TagCloud, Timeline
- `src/app/types/value-types.ts` - PropertyAnalysis interface
- `src/app/types/date-anchor.types.ts` - DateAnchorSource, ResolvedDateAnchor
- `src/app/types/visualization.types.ts` - VisualizationDataPoint, HeatmapData, ChartData, TagCloudData

**1.2 Utilities**

- `src/utils/date-utils.ts` - Parse YYYY-MM-DD, YYYY-Www from filenames; date arithmetic
- `src/utils/value-extractors.ts` - Extract boolean/number/tags from Obsidian Value types
- `src/utils/color-utils.ts` - Generate color scales for heatmaps

**1.3 Services**

- `src/app/services/type-detection.service.ts`
    - `analyzeProperty(entries, propertyId)` → PropertyAnalysis
    - Check `instanceof BooleanValue`, `NumberValue`, `ListValue`, `DateValue`
    - Map detected type → suggested visualization

- `src/app/services/date-anchor.service.ts`
    - Priority: filename → properties (date, created) → file metadata (ctime, mtime)
    - Support patterns: YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq
    - `resolveAnchor(entry, config)` → ResolvedDateAnchor | null

- `src/app/services/data-aggregation.service.ts`
    - Group data by time granularity
    - Calculate min/max for normalization
    - Produce visualization-ready data structures

### Phase 2: Core View

**2.1 View Registration** (`src/app/plugin.ts`)

```typescript
this.registerBasesView('life-tracker', {
    name: 'Life Tracker',
    icon: 'activity',
    factory: (controller, containerEl) => new LifeTrackerView(controller, containerEl, this),
    options: getLifeTrackerViewOptions
})
```

**2.2 View Options** (`src/app/view/view-options.ts`)

- `dateAnchorProperty` - property selector for manual date anchor
- `granularity` - dropdown: Daily/Weekly/Monthly/Quarterly/Yearly
- `embeddedHeight` - slider 200-800px
- Grouped heatmap options: cellSize, showMonthLabels, showDayLabels
- Grouped chart options: chartType, showLegend

**2.3 Main View** (`src/app/view/life-tracker-view.ts`)

```typescript
class LifeTrackerView extends BasesView {
    type = 'life-tracker'

    onDataUpdated(): void {
        // 1. For each property in this.config.getOrder():
        //    - Detect type via TypeDetectionService
        //    - Resolve date anchors via DateAnchorService
        // 2. Aggregate data via DataAggregationService
        // 3. Create/update visualization components
        // 4. Render to containerEl
    }
}
```

### Phase 3: Visualizations

**3.1 Base Class** (`src/components/visualizations/base-visualization.ts`)

- Abstract: `render()`, `update()`, `destroy()`
- Shared: `showEmptyState()`, `createTooltip()`

**3.2 Heatmap** (`src/components/visualizations/heatmap/`)

- GitHub-contribution style grid
- Support all granularities:
    - Daily: 7 rows (days) × N columns (weeks)
    - Weekly: 1 row × N columns
    - Monthly: 4 rows (weeks) × 12 columns (months)
    - Quarterly: 3 rows (months) × 4 columns (quarters)
    - Yearly: single row
- Color intensity based on value normalization
- Tooltip on hover showing date + value + entry count
- Click to open related notes

**3.3 Charts** (`src/components/visualizations/chart/`)

- Add `chart.js` dependency
- Line chart for continuous numeric data
- Bar chart for categorical/discrete data
- Responsive, theme-aware colors via Obsidian CSS vars

**3.4 Tag Cloud** (`src/components/visualizations/tag-cloud/`)

- Font size proportional to frequency
- Click tag to filter/search
- Sort by frequency or alphabetical

**3.5 Timeline** (`src/components/visualizations/timeline/`)

- Horizontal timeline for date properties
- Show entry distribution over time

### Phase 4: Settings & Styling

**4.1 Plugin Settings** (`src/app/types/plugin-settings.intf.ts`)

```typescript
interface PluginSettings {
    enabled: boolean
    defaultGranularity: TimeGranularity
    heatmapColorScheme: { empty: string; levels: string[] }
    chartColorPalette: string[]
    dateFormats: string[] // parsing patterns
    autoDetectTypes: boolean
    showEmptyDates: boolean
}
```

**4.2 Settings Tab** (`src/app/settings/settings-tab.ts`)

- Default granularity dropdown
- Color scheme customization
- Date format patterns

**4.3 CSS** (`src/styles.src.css`)

- `.lt-container` - main view container
- `.lt-heatmap-grid`, `.lt-heatmap-cell` - heatmap structure
- `.lt-chart-container` - Chart.js wrapper
- `.lt-tag-cloud`, `.lt-tag-item` - tag cloud
- Use Obsidian CSS variables for theme compatibility

## Data Flow

```
BasesEntry[] (from Obsidian)
    ↓
TypeDetectionService.analyzeProperty() → PropertyAnalysis
    ↓
DateAnchorService.resolveAnchor() → ResolvedDateAnchor per entry
    ↓
DataAggregationService.aggregate() → HeatmapData | ChartData | TagCloudData
    ↓
Visualization.render() → DOM
```

## Type Detection → Visualization Mapping

| Detected Type | Primary Visualization | Alternative           |
| ------------- | --------------------- | --------------------- |
| Boolean       | Heatmap               | Bar chart             |
| Number        | Line chart            | Bar chart, Heatmap    |
| Date          | Timeline              | -                     |
| Tags/List     | Tag cloud             | Bar chart (frequency) |
| String        | Bar chart (frequency) | -                     |

## Dependencies

Add to `package.json`:

```json
"dependencies": {
  "chart.js": "^4.4.0"
}
```

## Critical Implementation Notes

1. **Value Extraction**: Obsidian's Value types are wrappers. Use `instanceof` checks and `toString()` or `isTruthy()` to extract primitives.

2. **Date Parsing Priority**:
    - Filename: `/(\d{4})-(\d{2})-(\d{2})/` → daily
    - Filename: `/(\d{4})-W(\d{2})/` → weekly
    - Property: `entry.getValue('note.date')` if DateValue
    - Fallback: `entry.file.stat.ctime`

3. **Strict TypeScript**: All array access returns `T | undefined`. Check before use.

4. **Cleanup**: Use `this.register*()` methods for event listeners. Destroy Chart.js instances in `onunload()`.

5. **Theming**: Use Obsidian CSS variables (`var(--text-normal)`, `var(--background-modifier-border)`) for colors.

## Files to Modify

- `src/app/plugin.ts` - Add `registerBasesView()` call
- `src/app/types/plugin-settings.intf.ts` - Expand settings interface
- `src/app/settings/settings-tab.ts` - Add settings controls
- `src/styles.src.css` - Add visualization styles
- `package.json` - Add chart.js dependency

## Files to Create (in order)

1. `src/app/domain/detected-type.enum.ts`
2. `src/app/domain/time-granularity.enum.ts`
3. `src/app/domain/visualization-type.enum.ts`
4. `src/app/types/value-types.ts`
5. `src/app/types/date-anchor.types.ts`
6. `src/app/types/visualization.types.ts`
7. `src/utils/date-utils.ts`
8. `src/utils/value-extractors.ts`
9. `src/utils/color-utils.ts`
10. `src/app/services/type-detection.service.ts`
11. `src/app/services/date-anchor.service.ts`
12. `src/app/services/data-aggregation.service.ts`
13. `src/components/visualizations/base-visualization.ts`
14. `src/components/ui/tooltip.ts`
15. `src/components/ui/empty-state.ts`
16. `src/app/view/view-options.ts`
17. `src/app/view/life-tracker-view.ts`
18. `src/components/visualizations/heatmap/heatmap-visualization.ts`
19. `src/components/visualizations/heatmap/heatmap-renderer.ts`
20. `src/components/visualizations/chart/chart-visualization.ts`
21. `src/components/visualizations/tag-cloud/tag-cloud-visualization.ts`
22. `src/components/visualizations/timeline/timeline-visualization.ts`

---

## Phase 2 Outline: User Customization (Future)

### 2.1 Override Visualization Type

Allow users to force a specific visualization for any column, overriding auto-detection.

**View Options Extension:**

```typescript
{
  type: 'group',
  displayName: 'Column overrides',
  items: [
    {
      type: 'property',
      key: 'overrideProperty',
      displayName: 'Property',
    },
    {
      type: 'dropdown',
      key: 'overrideVisualization',
      displayName: 'Force visualization',
      options: {
        auto: 'Auto-detect',
        heatmap: 'Heatmap',
        lineChart: 'Line chart',
        barChart: 'Bar chart',
        tagCloud: 'Tag cloud'
      }
    }
  ]
}
```

**Data Model:**

```typescript
interface VisualizationOverride {
    propertyId: BasesPropertyId
    visualizationType: VisualizationType
    config?: Partial<VisualizationConfig>
}

// Store in view config
this.config.set('overrides', overrides)
```

### 2.2 Multiple Visualizations per Column

Show multiple viz types for a single property (e.g., heatmap + line chart for same numeric data).

**Approach:**

- Add "Add visualization" button per property
- Each property can have N visualization instances
- Store as array in config: `propertyVisualizations: { propertyId, vizType, config }[]`

### 2.3 Per-Visualization Configuration

Allow customizing each visualization instance independently.

**Heatmap Customization:**

- Color scheme picker (presets + custom)
- Cell size, gap, border radius
- Show/hide labels
- Date range selection

**Chart Customization:**

- Chart type (line/bar/area)
- Axis labels, grid lines
- Legend position
- Smooth vs stepped lines
- Stacked vs grouped bars

**Tag Cloud Customization:**

- Font size range
- Color scheme
- Layout algorithm (spiral, rectangular)
- Max tags to show

### 2.4 Drag-and-Drop Reordering

Allow users to reorder visualizations within the view.

**Implementation:**

- Use native HTML5 drag-and-drop API
- Store order in config
- Persist across sessions

---

## Tailwind CSS Styling Guide

### Heatmap Styling

```css
/* src/styles.src.css */

/* Container */
.lt-heatmap {
    @apply flex flex-col gap-2;
}

/* Grid wrapper with month labels */
.lt-heatmap-wrapper {
    @apply flex gap-1;
}

/* Week column */
.lt-heatmap-week {
    @apply flex flex-col gap-0.5;
}

/* Individual cell */
.lt-heatmap-cell {
    @apply w-3 h-3 rounded-sm cursor-pointer;
    @apply transition-all duration-150;
    @apply hover:ring-2 hover:ring-offset-1;
    background-color: var(--background-modifier-border);
    /* Ring uses Obsidian accent */
    --tw-ring-color: var(--interactive-accent);
    --tw-ring-offset-color: var(--background-primary);
}

.lt-heatmap-cell--has-data {
    @apply hover:scale-110;
}

/* Color levels - override via CSS custom properties */
.lt-heatmap-cell--level-0 {
    background-color: var(--lt-heatmap-empty, var(--background-modifier-border));
}
.lt-heatmap-cell--level-1 {
    background-color: var(--lt-heatmap-level-1, #9be9a8);
}
.lt-heatmap-cell--level-2 {
    background-color: var(--lt-heatmap-level-2, #40c463);
}
.lt-heatmap-cell--level-3 {
    background-color: var(--lt-heatmap-level-3, #30a14e);
}
.lt-heatmap-cell--level-4 {
    background-color: var(--lt-heatmap-level-4, #216e39);
}

/* Month labels */
.lt-heatmap-months {
    @apply flex text-xs gap-1;
    color: var(--text-muted);
}

/* Day labels (Mon, Wed, Fri) */
.lt-heatmap-days {
    @apply flex flex-col gap-0.5 text-xs pr-1;
    color: var(--text-muted);
}

/* Legend */
.lt-heatmap-legend {
    @apply flex items-center gap-1 text-xs mt-2;
    color: var(--text-muted);
}
```

### Chart Container Styling

```css
/* Chart wrapper */
.lt-chart {
    @apply w-full rounded-lg p-4;
    background-color: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
}

.lt-chart-header {
    @apply flex items-center justify-between mb-3;
}

.lt-chart-title {
    @apply text-sm font-medium;
    color: var(--text-normal);
}

.lt-chart-canvas {
    @apply w-full;
    /* Height set via config */
}

/* Chart.js theme overrides via CSS variables */
.lt-chart {
    --chart-grid-color: var(--background-modifier-border);
    --chart-text-color: var(--text-muted);
    --chart-line-color: var(--interactive-accent);
}
```

### Tag Cloud Styling

```css
/* Tag cloud container */
.lt-tag-cloud {
    @apply flex flex-wrap gap-2 p-4 rounded-lg;
    background-color: var(--background-secondary);
}

/* Individual tag */
.lt-tag {
    @apply px-2 py-1 rounded-full cursor-pointer;
    @apply transition-all duration-150;
    @apply hover:scale-105;
    background-color: var(--background-modifier-hover);
    color: var(--text-normal);
}

.lt-tag:hover {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

/* Size variants (applied via inline style or class) */
.lt-tag--xs {
    @apply text-xs;
}
.lt-tag--sm {
    @apply text-sm;
}
.lt-tag--md {
    @apply text-base;
}
.lt-tag--lg {
    @apply text-lg;
}
.lt-tag--xl {
    @apply text-xl;
}
```

### Timeline Styling

```css
/* Timeline container */
.lt-timeline {
    @apply relative py-4;
}

/* Horizontal line */
.lt-timeline-line {
    @apply absolute left-0 right-0 h-0.5;
    top: 50%;
    background-color: var(--background-modifier-border);
}

/* Timeline point */
.lt-timeline-point {
    @apply absolute w-3 h-3 rounded-full cursor-pointer;
    @apply transition-all duration-150;
    @apply hover:scale-150;
    top: 50%;
    transform: translateY(-50%);
    background-color: var(--interactive-accent);
}

/* Timeline labels */
.lt-timeline-label {
    @apply absolute text-xs whitespace-nowrap;
    color: var(--text-muted);
}
```

### Shared Components

```css
/* Section header */
.lt-section {
    @apply mb-6;
}

.lt-section-header {
    @apply flex items-center justify-between mb-3 pb-2;
    border-bottom: 1px solid var(--background-modifier-border);
}

.lt-section-title {
    @apply text-sm font-semibold uppercase tracking-wide;
    color: var(--text-muted);
}

/* Tooltip (positioned via JS) */
.lt-tooltip {
    @apply absolute z-50 px-3 py-2 rounded-lg shadow-lg;
    @apply text-sm pointer-events-none;
    @apply opacity-0 transition-opacity duration-150;
    background-color: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
}

.lt-tooltip--visible {
    @apply opacity-100;
}

.lt-tooltip-title {
    @apply font-medium mb-1;
}

.lt-tooltip-value {
    color: var(--text-accent);
}

/* Empty state */
.lt-empty {
    @apply flex flex-col items-center justify-center py-12 text-center;
    color: var(--text-muted);
}

.lt-empty-icon {
    @apply w-12 h-12 mb-4 opacity-50;
}

.lt-empty-text {
    @apply text-sm;
}

/* Loading state */
.lt-loading {
    @apply flex items-center justify-center py-8;
}

.lt-loading-spinner {
    @apply w-6 h-6 animate-spin;
    border: 2px solid var(--background-modifier-border);
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
}
```

### Responsive Adjustments

```css
/* Embedded view (smaller space) */
.lt-embedded .lt-heatmap-cell {
    @apply w-2.5 h-2.5;
}

.lt-embedded .lt-chart {
    @apply p-2;
}

/* Mobile adjustments */
@media (max-width: 640px) {
    .lt-heatmap-cell {
        @apply w-2 h-2;
    }

    .lt-tag-cloud {
        @apply gap-1;
    }

    .lt-tag {
        @apply px-1.5 py-0.5 text-xs;
    }
}
```

### Dark Mode Considerations

Obsidian CSS variables automatically handle dark mode. The heatmap color levels can be theme-aware:

```css
/* Light theme (default) */
.theme-light {
    --lt-heatmap-level-1: #9be9a8;
    --lt-heatmap-level-2: #40c463;
    --lt-heatmap-level-3: #30a14e;
    --lt-heatmap-level-4: #216e39;
}

/* Dark theme - slightly brighter for visibility */
.theme-dark {
    --lt-heatmap-level-1: #0e4429;
    --lt-heatmap-level-2: #006d32;
    --lt-heatmap-level-3: #26a641;
    --lt-heatmap-level-4: #39d353;
}
```

### TypeScript Integration

When creating elements in TypeScript, use Tailwind classes directly:

```typescript
// In visualization components
const cell = container.createDiv({
    cls: 'lt-heatmap-cell lt-heatmap-cell--level-2 hover:scale-110'
})

const tag = cloud.createSpan({
    cls: 'lt-tag lt-tag--md',
    text: tagName
})

// Dynamic classes based on state
cell.classList.toggle('lt-heatmap-cell--has-data', hasData)
```
