# Configuration

## Plugin Settings (Global)

Stored in plugin data, applies to all views.

| Setting                 | Type                          | Default | Description                                                  |
| ----------------------- | ----------------------------- | ------- | ------------------------------------------------------------ |
| `visualizationPresets`  | PropertyVisualizationPreset[] | `[]`    | Auto-apply visualization by property name pattern            |
| `animationDuration`     | number                        | `3000`  | Chart animation duration (ms)                                |
| `propertyDefinitions`   | PropertyDefinition[]          | `[]`    | Trackable properties for capture/editing                     |
| `showConfettiOnCapture` | boolean                       | `true`  | Confetti animation when a capture completes                  |
| `weekStartsOn`          | 0 \| 1 \| 6                   | `1`     | First day of the week (0 = Sunday, 1 = Monday, 6 = Saturday) |
| `filenameDatePatterns`  | FilenameDatePattern[]         | `[]`    | Custom `{{token}}` filename date patterns (see below)        |
| `createMissingNotes`    | boolean                       | `false` | Offer to create a missing note when capturing                |
| `dailyNoteTypeId`       | string                        | `''`    | Starter Kit note type used to create daily notes             |
| `captureTargets`        | CaptureTarget[]               | `[]`    | Destinations other than the daily note (see below)           |

### Capture targets

`CaptureTarget` (`src/app/types/plugin/capture-target.types.ts`): `id`, `name`,
`noteTypeId` (Starter Kit; `''` = standalone), `folder`, `fileNamePattern`,
`tags` (standalone), `templatePath` (override), `filters`
(`{ property, value }[]`), `dateProperty` (`date`). Loaded field by field by
`sanitizeCaptureTargets`; malformed entries are defaulted or dropped, duplicate
ids re-minted.

`PropertyDefinition.captureTargetId`: absent = automatic, `'daily-note'` = daily
note, else a target id. Non-string values are dropped on load.

Rules: `documentation/Business Rules.md` → Capture Targets. Plan:
`documentation/plans/capture-targets.md`.

### Filename date patterns

Each entry is `{ id: string; pattern: string }`. Patterns are compiled once on
load and on every settings change (`plugin.applyDateSettings()` →
`setCustomFilenameDatePatterns`), then consulted by `parseDateFromFilename`
before the built-in formats.

| Token         | Matches             | Example    |
| ------------- | ------------------- | ---------- |
| `{{date}}`    | `\d{4}-\d{2}-\d{2}` | 2026-07-30 |
| `{{year}}`    | `\d{4}`             | 2026       |
| `{{month}}`   | `\d{2}`             | 07         |
| `{{day}}`     | `\d{2}`             | 30         |
| `{{week}}`    | `\d{1,2}`           | 31         |
| `{{quarter}}` | `Q[1-4]`            | Q3         |
| `*`           | any text (wildcard) | —          |

Validation and granularity inference rules are in `documentation/Business Rules.md`.
Implementation: `src/utils/filename-date.utils.ts`.

## Life Tracker View Options (Per-View)

Configured via Obsidian's view options UI.

| Option               | Type            | Default    | Description                                                 |
| -------------------- | --------------- | ---------- | ----------------------------------------------------------- |
| `granularity`        | TimeGranularity | `daily`    | Time grouping for aggregation                               |
| `timeFrame`          | TimeFrameId     | `all_time` | Filter data range (all_time, last_7_days, this_month, etc.) |
| `dateAnchorProperty` | property        | (none)     | Date anchor property; when set it comes before the filename |
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

## Card Order & Pins (Per-View)

Stored in the Life Tracker view config, both as `string[]` of `prop:<id>` /
`overlay:<id>` entries (see `card-order.types.ts`).

| Key           | Description                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| `manualOrder` | Drag-and-drop card order; cleared by the **Reset order** button                |
| `pinnedCards` | Cards pinned to the top of the grid (issue #123); cleared when the last is off |

Pins are applied after the manual/natural order is reconciled, so pinned cards
always come first (see `documentation/Business Rules.md`).

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

Stored in view config under `columnConfigs` key as `Record<PropertyId, ColumnVisualizationConfig[]>`.

**Multiple visualizations per property**: Each property can have multiple visualizations, each independently configurable. Right-click a visualization to add a new one (copies settings from source) or remove it (only if 2+ exist for the property).

| Field                    | Description                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `id`                     | Unique visualization ID (UUID)                                                              |
| `propertyId`             | Bases property ID                                                                           |
| `visualizationType`      | Selected visualization                                                                      |
| `displayName`            | Cached property name (written at config time; not shown)                                    |
| `title`                  | Card title (3.4.0); absent or empty = property display name. Set from "Card title…"         |
| `configuredAt`           | Timestamp                                                                                   |
| `scale`                  | Optional {min, max}                                                                         |
| `colorScheme`            | Optional color scheme                                                                       |
| `heatmapCellSize`        | Optional heatmap cell size override                                                         |
| `heatmapShowMonthLabels` | Optional heatmap month labels visibility                                                    |
| `heatmapShowDayLabels`   | Optional heatmap day labels visibility                                                      |
| `referenceLine`          | Optional `{ enabled, value, label? }`                                                       |
| `aggregationMethod`      | `average` (default) \| `sum`                                                                |
| `movingAveragePeriod`    | Rolling mean window (7, 14, 30); absent = off                                               |
| `runningTotal`           | Plot the cumulative total                                                                   |
| `target`                 | Goal target (see Business Rules → Goals and Targets)                                        |
| `xAxisSource`            | `date` (default) \| `note-name` \| `date-per-note` (3.4.0)                                  |
| `valueFormat`            | `number` (default) \| `duration-mm-ss` (seconds → m:ss) \| `duration-h-mm` (minutes → h:mm) |
| `outliers`               | `fit` (default) \| `show-all` — whether outliers may set the auto-scaled y-axis (3.4.0)     |

Unknown `xAxisSource`, `valueFormat` and `outliers` values are ignored (default
behavior). Rules: `documentation/Business Rules.md` → Value Format, Card Titles,
Chart Outliers, Chart X-Axis Source.

Example (`.base` YAML, one card):

```yaml
columnConfigs:
    note.pace_seconds_per_kilometer:
        - id: 8c0f…
          propertyId: note.pace_seconds_per_kilometer
          visualizationType: line-chart
          displayName: Pace
          title: Pace (min/km)
          configuredAt: 1730000000000
          xAxisSource: date-per-note
          valueFormat: duration-mm-ss
          movingAveragePeriod: 7
          # outliers: show-all   # opt out of fitting the scale to the bulk
```

## Overlay Config (Per-View)

Stored in view config under `overlayConfigs` key as `Record<OverlayId, OverlayVisualizationConfig>`.

| Field                          | Description                                               |
| ------------------------------ | --------------------------------------------------------- |
| `id`                           | Unique overlay ID (UUID)                                  |
| `propertyIds`                  | Array of property IDs (minimum 2)                         |
| `visualizationType`            | Chart type (LineChart, BarChart, AreaChart only)          |
| `displayName`                  | User-defined overlay name                                 |
| `configuredAt`                 | Timestamp                                                 |
| `scale`                        | Optional {min, max} for Y-axis                            |
| `colorScheme`                  | Optional color scheme                                     |
| `referenceLines`               | Optional per-property reference line configs              |
| `hideIndividualVisualizations` | Hide individual property cards when true (default: false) |
| `aggregationMethod`            | `average` (default) \| `sum`                              |
| `valueFormat`                  | Same values as per-column config (3.4.0)                  |
| `outliers`                     | Same values as per-column config (3.4.0)                  |

## Scale Presets

Available via context menu: `0-1`, `0-5`, `1-5`, `0-10`, `1-10`, `0-100`, or auto-detect.

## Heatmap Color Schemes

`green` (default), `blue`, `purple`, `orange`, `red`
