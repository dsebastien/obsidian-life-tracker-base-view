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

1. Filename pattern — custom patterns first (in configured order), then the built-ins (YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY)
2. Configured date anchor property
3. File metadata (ctime, mtime)

## Filename Date Patterns

Custom filename date patterns (issue #139) let users map their own naming conventions to dates:

- Patterns use `{{token}}` placeholders — `{{date}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{week}}`, `{{quarter}}` — plus `*` as a wildcard for arbitrary text. Same token vocabulary as the other plugins in this family, so users learn it once.
- Patterns match the whole basename (anchored), case-insensitively. Literal text is regex-escaped.
- Custom patterns are tried before the built-in formats, in the order configured; the built-ins always remain as a fallback so vaults with no configuration keep working unchanged.
- Granularity is inferred from the tokens, never configured: `{{date}}` or year+month+day → daily; year+`{{week}}` → weekly; year+`{{quarter}}` → quarterly; year+month → monthly; year alone → yearly.
- Validation rules: a pattern needs `{{date}}` or `{{year}}`; `{{day}}` needs `{{month}}`; `{{week}}`, `{{quarter}}` and month/day tokens are mutually exclusive; `{{date}}` cannot be combined with other date tokens; a token can appear only once.
- Impossible calendar dates (e.g. `2026-02-31`) never match.
- Invalid patterns are rejected in the settings UI and skipped (logged as a warning) at parse time — one bad entry must never break date resolution for the rest.

## Configuration Priority

1. Per-view column config overrides global presets
2. Global presets match by case-insensitive property name
3. Unconfigured properties show selection card

## Visualization Types

- Scale-supporting types: Heatmap, BarChart, LineChart, AreaChart, RadarChart, ScatterChart, BubbleChart
- Non-scale types: PieChart, DoughnutChart, PolarAreaChart, TagCloud, Timeline
- Color scheme-supporting types: Heatmap, BarChart, LineChart, AreaChart, PieChart, DoughnutChart, RadarChart, PolarAreaChart, ScatterChart, BubbleChart, Timeline
- Non-color scheme types: TagCloud
- Heatmap and chart schemes are drawn from separate lists (see [Heatmap Color Schemes](#heatmap-color-schemes)); only heatmaps can carry an inline custom scheme

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

## Card Pinning

- Cards with a rendered visualization (property or overlay) can be pinned to the top of the grid via the star button in their header; property cards additionally offer it in the right-click menu (overlay right-click opens the overlay edit modal instead) (issue #123)
- Unconfigured property cards (the "choose a visualization" card) are not pinnable — there is nothing rendered yet to pin. A configured card showing an empty state has no header either, so its pin is reachable via the right-click menu only
- Pins are per property / per overlay, matching the ordering model: a property with several visualizations is pinned as a group, since its cards always render together
- Pinned cards are hoisted to the front of the effective order, keeping their relative order in that order — pinning does not reorder pins among themselves
- Pins are stored per Base view (`pinnedCards` in the view config), like the manual order, and cleared from the config entirely when the last pin is removed
- Pins referencing properties/overlays that no longer exist are ignored when ordering, and dropped from the config on the next pin toggle
- Dragging a pinned card below unpinned ones does not unpin it: the pin still wins on the next render

## Progressive Rendering

- On a full re-render the grid immediately lays out one skeleton placeholder per pending card, and each skeleton is replaced by its real card as the render batches progress (issue #135)
- Skeletons carry no data, listeners, or card id attribute, so drag-and-drop and maximize ignore them
- Leftover skeletons (items that render no card, e.g. a property hidden by an overlay) are removed when the render finishes
- The previous content height stays reserved for the whole rebuild so the dashboard never collapses; there is no blanket spinner overlay any more

## Rendering Performance

- Heatmap cell interaction uses one delegated listener set on the grid root, detached on `destroy()` — never per-cell listeners (issue #104)
- Tag cloud and timeline updates are skipped when the aggregated content is unchanged, and the tag cloud updates sizes in place when only frequencies changed
- View-config reads in `ColumnConfigService` are memoized per render cycle and invalidated at the start of each cycle (and on every write)
- Line/area datasets above 500 points render without point markers (`pointRadius: 0`, hover and hit radius preserved); dense scatter charts shrink their dots. No data points are ever dropped
- Chart.js' decimation plugin is deliberately not enabled: it requires a linear/time x scale with `parsing: false`, while these charts use a category scale of formatted period labels

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

## Heatmap Color Schemes

- A heatmap color scheme is either a **gradient** (`kind: 'gradient'`, 5 intensity levels bucketed against the cell min/max — the original behavior) or **discrete** (`kind: 'discrete'`, an explicit value → color mapping) — issue #82
- Discrete mode ignores min/max normalization entirely: a value maps to the same color whatever range surrounds it
- A cell whose value has no mapping entry uses `fallback`, then `empty`; a null value always uses `empty`
- Gradient cells are colored by CSS level classes driven by container CSS variables; discrete cells carry an inline `background-color`, because arbitrary mappings cannot be pre-declared as classes. Switching a card back to a gradient must clear that inline color
- The legend follows the scheme: "Less → More" ramp for gradients, one labelled swatch per mapping entry for discrete schemes
- A custom mapping is stored inline on the per-visualization config and wins over any preset name, per-card or view-wide. Presets (settings tab) only ever store scheme _names_
- Charts narrow the shared `colorScheme` field with `asChartColorScheme()`: a heatmap-only name (`viridis`, `cividis`) or an inline scheme object resolves to the default chart palette rather than leaking into a `ChartConfig`

## Accessibility: Color

- Colorblind-friendly palettes are first-class options, not an afterthought (issue #136): charts offer a `colorblind` scheme (Okabe-Ito, 8 colors), heatmaps offer the `viridis` and `cividis` gradients
- New custom heatmap mappings seed from a colorblind-safe blue → orange ramp, and added entries cycle the Okabe-Ito palette. Red → green is deliberately avoided as a default: it is the axis most color vision deficiencies collapse

## Value Polarity

- `polarity` on a property definition is `neutral` (default) | `higher-is-better` | `lower-is-better` — issue #21. Absent or unrecognized reads as `neutral`, so definitions from earlier versions and from the Starter Kit plugin keep working unchanged
- Neutral means the plugin makes **no judgement** anywhere: no colored trend, no polarity-derived palette. This is the default and preserves all prior behavior
- Polarity supplies the _default_ heatmap gradient only (green for higher-is-better, red for lower-is-better, so "more color = more of the thing" reads correctly both ways). Precedence: per-card scheme → view-wide `heatmapColorScheme` → polarity → green. Anything the user picked explicitly always wins
- Chart palettes are **not** polarity-driven: a series color identifies the series, not its goodness. Only the trend indicator carries sentiment
- Polarity and emojis are offered only for properties whose values are numeric: number, checkbox, and text properties that have a value mapping

## Starter Kit Integration

- Life Tracker reads the Obsidian Starter Kit plugin (`obsidian-starter-kit`) through its `plugin.api`, and only ever reads. The integration is entirely optional: absent, disabled, or an API missing an expected method all degrade to "not available", never an error
- **Ownership split for a linked definition**: Starter Kit owns the structure — `name`, `displayName`, `type`, `allowedValues`, `numberRange`, `defaultValue`, `required`, `description`, and `mappings`. Life Tracker owns `id`, `order`, `valueMapping`, `polarity`, `valueEmojis`. A sync never touches a Life-Tracker-owned field
- `polarity` / `valueEmojis` are deliberately **not** mirrored into Starter Kit's schema: it would store them without ever acting on them, and two homes for one value is the drift the link exists to prevent
- A linked definition's `mappings` are **copied** from its note type, never re-derived. Starter Kit's recognition has rules that must not be duplicated (several note types can match one note; tag matches take priority). Life Tracker asks a different question — "does this property apply to this note?" — which is a plain OR over the mappings, so copying is correct; deciding _which single type_ a note is remains Starter Kit's job
- Starter Kit global properties get no mappings, matching their "applies everywhere" semantics
- Import identity is the **property name**: two definitions for one frontmatter key would both write to it. A name already claimed by a definition linked to a _different_ source is a conflict and is skipped — never silently rebound
- Importing over an existing unlinked definition ("adopt") links it and takes structure from Starter Kit, but keeps its polarity, emojis and value mapping
- A linked definition whose source disappears (renamed note type, deleted property, plugin uninstalled) is **kept** with its last-synced structure and flagged in settings. It is never deleted — Starter Kit may simply be mid-edit
- Unlinking keeps the definition and every one of its settings; it only stops future refreshes
- The link resolves on `(noteTypeId, propertyId)` when both sides have Starter Kit's stable property id, falling back to `(noteTypeId, propertyName)` otherwise. The id survives a rename, so renaming a property in Starter Kit flows through to the linked definition instead of orphaning it. The name fallback covers links made before ids existed and a Starter Kit too old to expose them
- The name fallback has one unavoidable hole: a link that has _not yet_ recorded an id can only match by name, so if the property it pointed at is renamed **and** a different property takes over the old name before the first sync, the link binds to the newcomer. One sync hardens the link by recording the id, closing the window. Not fixable while either side lacks an id — the two properties are indistinguishable by the only key available
- The note type must always agree, whatever the id says: the same property under a different note type is a different property
- `planImport` resolves by **link before name**. After a rename the definition still carries the old name until a sync runs, so a name-only lookup would find nothing and plan a duplicate `create` — two definitions writing one frontmatter key
- A rename is refused, by both `planImport` and `syncLinkedDefinitions`, when the new name is already held by a _different_ definition. The rename is reported as a conflict and nothing changes: silently applying it would produce exactly the duplicate-writer state these rules exist to prevent
- A definition that a source will rename releases its **old** name for the same plan, so a new Starter Kit property may legitimately take it
- Names that link-resolved sources will occupy are reserved before planning. A source that merely shares a name cannot claim it first by being earlier in the list — the definition that already belongs to a source has the better claim on its own name
- Only successful entries claim a name. An entry that ends up a conflict changes nothing, so it must not block a later source that legitimately wants that name
- A source is not importable when its property name is blank, or when its note type has **no enabled mappings**. Starter Kit treats "no enabled mappings" as matching _nothing_, while Life Tracker treats an empty mapping list as applying to _every_ note — importing would silently invert the scope and write frontmatter into unrelated notes
- Starter Kit property types Life Tracker lacks (`select`, `url`, `time`, and the legacy `multitext` / `boolean` aliases) are normalized on import — all are string-typed, so unknown types become `text` rather than being stored verbatim
- Life Tracker's mapping matching is case-insensitive where Starter Kit's is case-sensitive, so a linked property can apply to marginally more notes than Starter Kit would recognize. Left as-is: changing shared matching semantics for every user to serve this integration would be the worse trade
- Sync runs once on `onLayoutReady` (not `onload`, where Starter Kit may not be registered yet), plus on demand from the settings tab. There is no live subscription to Starter Kit changes

## Settings Persistence

- Settings writes are serialized through a queue (`createSerialQueue`): editors call `updateSettings` on every keystroke, and two overlapping `saveData` calls can otherwise land out of order, persisting the _older_ snapshot — a corruption that only surfaces after a restart
- Each queued write persists the settings as they are when it runs, not when it was queued, so the last write always reflects the newest state
- A failed write rejects for its own caller but does not wedge the queue

## Editable Map Keys

- Wherever a map key is itself an editable field (`valueMapping`, `valueEmojis`), the row's handlers must track the _current_ key, never the render-time one: `onChange` fires per keystroke, so typing `10` into a fresh row would otherwise leave an orphaned `1` entry and make the sibling field write to a key that no longer exists
- Renaming onto an existing key is rejected and flagged, never silently applied — it would destroy the other entry
- Duplicate detection reads live settings, not the render-time snapshot: sibling rows may have been renamed since this row was drawn

## Value Emojis

- `valueEmojis` maps a value or range to an emoji — issue #22. Keys are an exact value (`3`) or an inclusive range (`1-2`, `1..2`, `-5--1`); reversed ranges are normalized, unparseable keys are ignored at render time and flagged in settings
- Exact keys beat ranges, so `{ "0-10": "🙂", "10": "🎉" }` still celebrates a perfect score. Among overlapping ranges, the first configured one wins
- Distinct from `valueMapping`, which converts text → number for input. `valueEmojis` goes number → emoji for display; a property may use both
- Rendered in heatmap tooltips and in cartesian/scatter/bubble chart tooltips (prefixed to the value), and as one-tap entry buttons under the number editor. Pie/doughnut/polar/radar tooltips show category distributions, not tracked values, so they carry no emoji.
- The button highlighted in the editor is resolved with the same precedence as the tooltip (`findEmojiEntry`), so the selected button and the displayed emoji can never disagree — including for values inside a range. A range button records its lower bound — the only member of a range that can be named unambiguously
- Emoji quick-entry is not rendered in compact grid cells: the row would not fit and cards must stay visually stable

## Heatmap Aggregation

- Multiple entries falling in the same cell period are combined via the configured aggregation method: `average` (default, preserves prior behavior) or `sum` for counter-style tracking (calories, sessions per day) — issue #98. Same `average | sum` model as charts (#89). Cell min/max (and therefore color scaling) follow the aggregated value.

## Week Start

- Week grouping (weekly granularity buckets), heatmap week columns, and "this week"/"last week" time frames honor a configurable first day of the week (`weekStartsOn`: Monday default, Sunday optional) — issue #99.
- ISO week parsing and labels (`YYYY-Www` filenames, week numbers) remain Monday-based per ISO-8601 regardless of the setting.

## Heatmap Streaks

- A period is streak-active when its cell value is non-null and non-zero — consistent with heatmap rendering where 0 on a 0-based scale shows as absence (issue #87)
- The current streak counts only when the trailing run reaches the current period or the immediately preceding one (today's data may not be captured yet)
- Consecutiveness is calendar-based per granularity (cells can be sparse)

## Number Quick Entry

- Number editors show −/+ buttons except in compact mode (grid cells), where the plain input is kept (issue #125)
- Steps use the property's configured step, falling back to 1; results are clamped to the property's range and rounded to 6 decimals to avoid float drift
- From an empty field the first tap lands on the range minimum for bounded properties, on +step for unbounded increments, and on 0 for unbounded decrements (never negative from empty)
- The −/+ buttons commit immediately (one tap = one saved value); the buttons disable at the range bounds

## Capture Modal Swipe Navigation

- On touch/pen input, swiping the card left moves to the next property and right to the previous one — identical to the arrow buttons (issue #140)
- A gesture is a swipe when it travels ≥60px horizontally, horizontal travel ≥1.5× vertical travel, and it completes within 800ms
- Gestures starting on an interactive control (input, textarea, select, button, link, contenteditable) are ignored so sliders and text selection keep working
- Mouse input never swipes: a horizontal mouse drag in a modal means text selection
- Swipes never trigger the boundary actions ("Done" / "Next file"); those stay button-only

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
- The arrow color follows the property's polarity (issue #21): green when the metric is improving, red when worsening, muted when the property is `neutral` or has no definition. A flat trend is always muted — below the meaningful-change threshold there is nothing to judge
- Color is never the only channel: the arrow glyph (↑/↓/→) and the wording ("improving" / "worsening" in the tooltip and trend row) carry the same meaning
- Overlay charts combine several properties, so they have no single polarity and stay neutral

## Visualization Export

- CSV export serializes exactly what the visualization displays (aggregated values), not raw frontmatter
- Image export requires a canvas, so it is only offered for Chart.js types
- Exports are written to the vault's attachment folder via `getAvailablePathForAttachment`

## Capture Today Command

- Resolves today's note by basename match on any daily-granularity filename pattern — built-in (YYYY-MM-DD) or custom (issue #139)
- When several notes match, the most recently modified one wins

## Reduced Motion

- Decorative animations (confetti, Chart.js animations, CSS keyframe animations) MUST respect the OS-level `prefers-reduced-motion` setting (issue #109)

## Reference Lines

- Reference lines are only supported for cartesian chart types: LineChart, BarChart, AreaChart
- Reference lines are disabled by default and must be explicitly enabled per property
- For overlay charts, each property can have its own independent reference line
- Reference line colors match the dataset color for visual consistency
- Default label format is "Target: {value}" if no custom label is provided
