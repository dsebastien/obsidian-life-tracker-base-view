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

Priority order for resolving an entry's date when the view has **no** date anchor property set (the automatic chain):

1. Filename pattern — custom patterns first (in configured order), then the built-ins (YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY)
2. The `date` property, then the `created` property
3. File metadata (ctime)

When a Life Tracker view sets a date anchor property, that property comes **first**, then the filename, then ctime. The setting is an explicit per-view choice, and per-view configuration beats automatic defaults (see Configuration Priority); a property chosen by the user that a filename could silently override would be a setting that does nothing on dated notes. The Grid view has no date anchor option and always uses the automatic chain.

## Filename Date Patterns

Custom filename date patterns (issue #139) let users map their own naming conventions to dates:

- Patterns use `{{token}}` placeholders — `{{date}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{week}}`, `{{quarter}}` — plus `*` as a wildcard for arbitrary text. Same token vocabulary as the other plugins in this family, so users learn it once.
- Patterns match the whole basename (anchored), case-insensitively. Literal text is regex-escaped.
- A pattern containing `/` is a **path** pattern: it is matched against the note's vault-relative path minus its extension, so `daily/{{date}}` only matches notes inside `daily/` (issue #152). Patterns without `/` keep matching the basename alone, wherever the note lives.
- Custom patterns are tried before the built-in formats, in the order configured; the built-ins always remain as a fallback so vaults with no configuration keep working unchanged.
- Granularity is inferred from the tokens, never configured: `{{date}}` or year+month+day → daily; year+`{{week}}` → weekly; year+`{{quarter}}` → quarterly; year+month → monthly; year alone → yearly.
- Validation rules: a pattern needs `{{date}}` or `{{year}}`; `{{day}}` needs `{{month}}`; `{{week}}`, `{{quarter}}` and month/day tokens are mutually exclusive; `{{date}}` cannot be combined with other date tokens; a token can appear only once.
- Impossible calendar dates (e.g. `2026-02-31`) never match.
- Invalid patterns are rejected in the settings UI and skipped (logged as a warning) at parse time — one bad entry must never break date resolution for the rest.

## Configuration Priority

1. Per-view column config overrides global presets
2. Global presets match by case-insensitive property name
3. Unconfigured properties show selection card

## Heatmap Date Span

- A heatmap spans the full period covered by the view's entries, not just the periods that carry a value for the visualized property (issue #153). Optional properties otherwise made the grid start at the first day that happened to be filled in, hiding the beginning of the selected range.
- The span is computed from the date anchors of all entries left after time-frame filtering, before any per-property value filtering.
- The span can only widen, never narrow: data points outside the view range are still drawn.
- `showEmptyValues` still governs whether periods without data render as cells or as blank placeholders — it never changes the span.

## Visualization Types

- Scale-supporting types: Heatmap, BarChart, LineChart, AreaChart, RadarChart, ScatterChart, BubbleChart
- Non-scale types: PieChart, DoughnutChart, PolarAreaChart, TagCloud, Timeline
- Color scheme-supporting types: Heatmap, BarChart, LineChart, AreaChart, PieChart, DoughnutChart, RadarChart, PolarAreaChart, ScatterChart, BubbleChart, Timeline
- Non-color scheme types: TagCloud, Progress
- Target-supporting types: Progress, LineChart, BarChart, AreaChart (see [Goals and Targets](#goals-and-targets))
- Heatmap and chart schemes are drawn from separate lists (see [Heatmap Color Schemes](#heatmap-color-schemes)); only heatmaps can carry an inline custom scheme

## Maximize State

- Maximize state is keyed by **visualization ID**, never by property ID: one property can back several visualizations, and maximizing one must not affect its siblings (issue #151)
- At most one visualization is maximized at a time
- Only configured cards (with `data-visualization-id`) participate in maximize/minimize
- Unconfigured cards are hidden when another card is maximized, but never receive maximize state
- Escape key minimizes the currently maximized card
- Overlay visualizations use their overlay ID as both `data-property-id` and `data-visualization-id`, allowing them to be maximized independently
- Each overlay is treated as an independent visualization for maximize purposes
- When overlays are maximized/minimized, they receive the maximize state but are not re-rendered (overlays use pre-aggregated chart data)
- Only the visualization being maximized (or the one being restored) is re-rendered

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
- Saving or deleting an overlay from its edit modal forces a full render: the incremental path re-aggregates against the existing overlay config and would show the edit only after the Base is reopened
- Only cartesian chart types support overlay mode: LineChart, BarChart, AreaChart — plus RangeChart, which exists ONLY as an overlay (issue #81)
- Legends are always shown for overlay charts (to identify each property's line/bar)
- When a property in an overlay is removed from Base, it is automatically removed from the overlay
- If an overlay drops below 2 properties after cleanup, the overlay is deleted entirely
- By default, overlays render after all individual property visualizations. Once the user reorders cards via drag-and-drop, overlays follow the saved manual order (see Card Ordering)
- Overlays can optionally hide individual property visualizations via `hideIndividualVisualizations` setting
- When a property is in multiple overlays, it is hidden if ANY overlay has `hideIndividualVisualizations` enabled
- Data points are still cached for hidden properties (needed for overlay rendering)

## Range Charts

- A range chart (issue #81) is an overlay-only type drawing one floating bar per period from a **start** property's value to an **end** property's value (e.g. "To Bed" → "Wake Up"). It requires exactly 2 properties; start and end are positional — the first selected property is the start
- Overlay-only types never appear in single-property type pickers or the preset dropdown: a single property cannot render them
- Value parsing per entry: a bare time of day ("23:30"), the time part of an ISO datetime, then the plain numeric value. The raw string is read before the numeric value because a text property with a value mapping coerces unmapped strings to 0
- A missing or empty value is never coerced: it stays null (no data) even when a value mapping is configured. Only non-empty text that matches no mapping key becomes 0
- If any value is a time of day, the whole chart runs in time mode: y-axis ticks and tooltips read as HH:mm, wrapping past midnight
- Midnight handling in time mode: an end earlier than its start crosses midnight and is pushed into the next day (+24h). When the starts themselves spread over more than half a day, the small-hours starts are pushed into the next day too, so all bars cluster on one continuous band
- A period missing either side yields no bar, never a made-up value; a period with several entries uses the first parseable value per side
- Per-period aggregation options (average/sum), reference lines, targets, and legends do not apply to range charts
- CSV export writes the formatted clock times in time mode — it serializes what the chart displays

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
- Line/area datasets with more than 40 non-null points render without point markers (`pointRadius: 0`, hover radius 4, hit radius 8; was 500 before 3.4.0, lowered because 170 sessions drew overlapping dots that hid the line). Outlier markers always stay visible, and so does a point that gap breaks leave without a line on either side (radius 3, per-point `pointRadius`; see Line Gaps). Dense scatter charts (above 500 points) shrink their dots. No data points are ever dropped
- Chart.js' decimation plugin is deliberately not enabled: it requires a linear/time x scale with `parsing: false`, while most of these charts use a category scale of formatted period labels
- The incremental fast path only re-aggregates data against the **existing** visualization configs. Every view setting baked into those configs — time frame, grid columns, time granularity, control-bar visibility, trend and streak toggles — MUST therefore invalidate the fast path in `canDoIncrementalUpdate`, or the change only appears after the Base is reopened (issue #146). A setting added to the view options without a matching guard is silently ignored until reload

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

## Chart X-Axis Source

- Line, bar, and area charts can plot note names on the x-axis instead of time periods (`xAxisSource: 'note-name'`, issue #69) — one point per note, for Bases whose notes aren't date-shaped (books, projects, people)
- On the note-name axis, points follow the Base view's own sort order: the user controls the axis by sorting the view. Entries need no date anchor
- There is no time grouping on this axis, so the aggregation method does not apply; missing values stay null gaps (issue #92); moving average, running total, and the trend indicator operate over notes instead of periods
- List-valued properties keep the time-based presence aggregation: the option is hidden for them rather than shown inert
- An unknown stored `xAxisSource` value falls back to the date axis
- Radar charts share the cartesian aggregation path but keep the date axis: their spokes are periods by design
- `xAxisSource: 'date-per-note'` (3.4.0) plots one point per note at its own date anchor on a time-proportional axis: no per-period aggregation (two notes on one day are two points), gaps show as distance. Points are in date order (stable, so same-day notes keep the view order); the moving average and the trend read notes in that order
- On the date-per-note axis, notes with a value but no date anchor are skipped and counted in the trend row ("N notes without a date"; the accessible label starts with the count). Notes without a value draw nothing (never a 0) and are not counted
- Notes sharing one instant (filename dates all land on local midnight) are spread within their day in note order: the first keeps its instant, a group of k gets slots of (time to the end of the day) / k. Otherwise the second point sits on the first and can never be hovered or opened. Tooltips and CSV still show the same date
- The date-per-note axis picks points with `nearest` mode on both axes (`intersect: false`): `index` mode resolves to the first of two close notes. Its tooltip therefore lists the nearest point only. Period and note-name axes keep `index` mode (every series at the hovered period)
- Bars on the date-per-note axis: no Chart.js `offset` (on a linear scale it reserves room per tick and squeezes the data toward the middle); the axis gets half a day of room at each end instead. Bar width is 80% of the smallest pixel gap between notes, clamped to 3–16 px, set right before the bars are laid out (Chart.js would size every bar from the smallest gap and draw hairlines, with no minimum of its own). Lines get 2% of the span at each end
- On the per-note axes (date-per-note and note-name) the trend row compares notes: "vs previous 7 notes", "Per-note trend" with a running total
- The date-per-note axis is a Chart.js linear scale over epoch-ms values with calendar-aligned ticks (day, week, month, quarter, year) built by the plugin: no Chart.js date adapter is bundled, and adding one would be a new runtime dependency. Labels stay horizontal and are auto-skipped; the tooltip title is "date · note name" Two-/three-day and two-week ticks count from a fixed calendar origin (local 1970-01-01), so they stay on the same days when an earlier note is added; months align to January, years to multiples of the step
- On the note-name axis, tick labels drop one trailing `(…)` suffix (`2025-06-24 (Running Session)` → `2025-06-24`), start horizontal, rotate at most 45° and are auto-skipped. Tooltips and CSV keep the full note name. A name that is only a suffix is kept whole
- On both note axes the moving average is labelled per note (`7-note average`)

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
- **Ownership split for a linked definition**: Starter Kit owns the structure — `name`, `type`, `allowedValues`, `numberRange`, `defaultValue`, `required`, `description`, and `mappings`. Life Tracker owns `id`, `order`, `displayName`, `valueMapping`, `polarity`, `valueEmojis`, `showInQuickAdd`, `captureTargetId`. A sync never touches a Life-Tracker-owned field
- **`displayName` belongs to Life Tracker**: it is presentation, and Starter Kit defaults it to the raw property name. A label the user customized (one that differs from the raw name) is kept; an empty or raw-name label takes Starter Kit's, which is how a freshly imported property gets a sensible one. Validated against a real vault where the naive rule would have renamed 90 labelled properties back to `health_energy_level` and friends
- The same property name can legitimately exist in many Starter Kit note types (one real vault has `rating` in 22 of them), while Life Tracker has **one definition per frontmatter key**. The first source to claim a name wins and the rest are conflicts, naming the note type that holds it so the user can choose
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
- Starter Kit name affixes are read untrimmed (only an all-whitespace affix counts as absent): `" (Strength Session)"` must keep its leading space
- A source is not importable when its property name is blank, or when its note type has **no enabled mappings**. Starter Kit treats "no enabled mappings" as matching _nothing_, while Life Tracker treats an empty mapping list as applying to _every_ note — importing would silently invert the scope and write frontmatter into unrelated notes
- Starter Kit property types Life Tracker lacks (`select`, `url`, `time`, and the legacy `multitext` / `boolean` aliases) are normalized on import — all are string-typed, so unknown types become `text` rather than being stored verbatim
- Life Tracker's mapping matching is case-insensitive where Starter Kit's is case-sensitive, so a linked property can apply to marginally more notes than Starter Kit would recognize. Left as-is: changing shared matching semantics for every user to serve this integration would be the worse trade
- Sync runs once on `onLayoutReady` (not `onload`, where Starter Kit may not be registered yet), plus on demand from the settings tab. There is no live subscription to Starter Kit changes

## Plugin Lifecycle

- If the plugin is unloaded while `onload` awaits the settings (hot reload, a quick disable), `onload` stops there and registers nothing: views, commands and the `obsidian://` handler registered on an unloaded component are never cleaned up, and the next enable fails with "Action … is already registered"

## View Settings Persistence

- The `.base` view config is the only source of truth for a view's grid settings (`timeFrame`, `gridColumns`) and every other view option (issue #189). The view reads them on each render; an in-memory copy is never written back
- A grid setting differing from the one rendered (the file was edited, or Bases reloaded it) invalidates the incremental path: the full render re-reads them and rebuilds the control bar
- The view writes a grid setting only on a user action in its control bar, and only the setting the user changed, compared with the config as it is at that moment. Never on load, reload, or hot reload
- Still written outside a user action: the legacy column-config migration and the orphaned-config cleanup (see Property Removal Cleanup), each only when it has something to fix

## Settings Persistence

- Settings writes are serialized through a queue (`createSerialQueue`): editors call `updateSettings` on every keystroke, and two overlapping `saveData` calls can otherwise land out of order, persisting the _older_ snapshot — a corruption that only surfaces after a restart
- Each queued write persists the settings as they are when it runs, not when it was queued, so the last write always reflects the newest state
- A failed write rejects for its own caller but does not wedge the queue
- An external change to `data.json` (Sync, git, hand edit) is reloaded via `onExternalSettingsChange` and views get a `full` refresh. The reload never saves: writing back would turn a reload into an overwrite
- An open settings tab is redrawn after such a reload (it is not a settings listener: it would redraw under the cursor on every keystroke)
- A changed `data.json` that cannot be parsed (caught mid-write by a sync tool) or is missing keeps the current settings: resetting to defaults would let the next save wipe every property definition

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

- Week grouping (weekly granularity buckets), heatmap week columns, and "this week"/"last week" time frames honor a configurable first day of the week (`weekStartsOn`: Monday default, Sunday or Saturday optional) — issues #99, #162. Stored values other than 0, 1, 6 are ignored on load (Monday is kept)
- ISO week parsing and labels (`YYYY-Www` filenames, week numbers) remain Monday-based per ISO-8601 regardless of the setting.

## Heatmap Streaks

- A period is streak-active when its cell value is non-null and non-zero — consistent with heatmap rendering where 0 on a 0-based scale shows as absence (issue #87)
- The current streak counts only when the trailing run reaches the current period or the immediately preceding one (today's data may not be captured yet)
- Consecutiveness is calendar-based per granularity (cells can be sparse)

## Number Quick Entry

- Number editors show −/+ buttons except in compact mode (grid cells), where the plain input is kept (issue #125)
- Steps use the property's configured step, falling back to 1; results are clamped to the property's range and rounded to 6 decimals to avoid float drift
- From an empty field: a range with min > 0 lands on its minimum either way. Otherwise + gives one step up from 0 (clamped), and − gives the range minimum, or 0 when unbounded (never negative from empty for unbounded). A 0-based counter's first + therefore logs 1, not a 0 that looks like no-op (issue #122); a deliberate 0 is one − tap
- The −/+ buttons commit immediately (one tap = one saved value); the buttons disable at the range bounds

## Property Descriptions

- The capture dialog shows a property's description with its line breaks kept (`white-space: pre-line`), so a one-line-per-value description stays one line per value
- Single-line inputs use the description as their placeholder, lines joined with `·` (an input would drop the breaks and glue the lines together); with no description the placeholder is the display label

## Capture Modal Swipe Navigation

- On touch/pen input, swiping the card left moves to the next property and right to the previous one — identical to the arrow buttons (issue #140)
- A gesture is a swipe when it travels ≥60px horizontally, horizontal travel ≥1.5× vertical travel, and it completes within 800ms
- Gestures starting on an interactive control (input, textarea, select, button, link, contenteditable) are ignored so sliders and text selection keep working
- Mouse input never swipes: a horizontal mouse drag in a modal means text selection
- Swipes never trigger the boundary actions ("Done" / "Next file"); those stay button-only

## Capture Modal Auto-Advance

- Opt-in setting `autoAdvanceOnPick`, off by default. When on, picking a value from a closed set (text dropdown, number emoji button, checkbox/toggle) moves to the next property after `AUTO_ADVANCE_DELAY_MS`, through the same validate-and-save path as Enter
- Typing and slider drags never auto-advance: there is no point at which a typed value is "done"
- Picking the empty dropdown option never advances, and the last property never advances: "Done" / "Next file" stay explicit
- Any navigation or close cancels a pending auto-advance, so it can never fire on a different card
- A later pick replaces a pending auto-advance; a pick that does not advance (empty option) cancels it
- Dropdown changes from the keyboard (arrow keys, type-ahead on a closed select) never auto-advance; only a pointer pick does. Keyboard users confirm with Enter

## Data Entry Safety

- Pending debounced edits MUST be flushed to disk before any editor teardown (re-render, unload) — typed values are never silently discarded (issue #90)
- Invalid non-empty values never reach disk; writing an empty value clears the property (issue #91)
- Failed frontmatter writes are surfaced to the user via a Notice
- "Use default" writes the default **through the editor**, not just into the modal's pending value: validation asks the editor for its own value, so an empty required field would otherwise reject its own default with "This field is required" (issue #145)

## Batch Capture Provider Resolution

- File providers (views supplying files for batch capture) are kept in a recency-ordered registry; the most recently interacted-with view wins (issue #96)
- Views register on creation, bump on pointer/focus interaction, and unregister only themselves on unload

## Moving Average

- Only line and area charts support the moving average overlay; offered windows are 7, 14, and 30 periods
- Only single-dataset numeric charts get the overlay (list data and overlay charts already carry multiple datasets)
- Missing periods are skipped inside the window, never counted as 0
- When on, the average is the main line (3.4.0): solid, 2.5 px, full dataset color, no points, drawn on top and listed first in the legend and tooltip (Chart.js `order`). The raw series becomes a 1 px line at 35% opacity, without fill, with small faded points (none above 40 points). Without a moving average, the series styling is unchanged
- The average is computed on real values, never on values clamped to the axis edge (see Chart Outliers); it can leave the axis and is clipped by the chart area. With "Leave outliers out of the average" on, the outliers are left out of the window (see Chart Outliers)
- The average is computed per segment between gap breaks (see Line Gaps): a window never reaches across a gap
- A click opens the first clicked element that has notes behind it: the average (and outlier markers) come first in `order` and carry none

## Line Gaps

- Line and area charts on a date axis (period axis, and date-per-note) break the line between two consecutive points further apart than max(3 × the median gap between consecutive points, 14 days) (issue #185). A flat segment across months without data read as a stable trend
- Points are the slots with a value; empty period slots draw nothing and already break the line. The period axis measures from each period's start date (`periodTimes`), the date-per-note axis from the note's x position
- A point no segment reaches (gap or empty slot on both sides, once a series has breaks) gets its own marker on the raw series and on the moving average, since lines above 40 points hide their markers
- With "Show empty dates", the empty slots between the last point before a gap and the break stay empty: the slots a running total or moving average filled there are cleared (`clearGapStretches`), so neither runs on across the gap
- Both the raw line and the moving average break; area fill breaks with them. Drawn with Chart.js `segment` styles (the crossing segment is transparent), so indices, tooltips, clicks, markers and CSV are untouched
- On by default; per card `breakLineAcrossGaps: false` (menu "Break line across gaps") turns it off. Absent reads as on, so cards saved before the option get it. Only `false` is stored
- Not applied: the note-name axis (no time), bar charts, list data, overlays

## Trend Indicator

- Shown automatically on single-dataset cartesian charts (line, bar, area) with enough data for two comparison windows
- Compares the mean of the last N periods (N = min(7, half the data)) against the previous N; changes below 2% read as flat
- The arrow color follows the property's polarity (issue #21): green when the metric is improving, red when worsening, muted when the property is `neutral` or has no definition. A flat trend is always muted — below the meaningful-change threshold there is nothing to judge
- Color is never the only channel: the arrow glyph (↑/↓/→) and the wording ("improving" / "worsening" in the tooltip and trend row) carry the same meaning
- Overlay charts combine several properties, so they have no single polarity and stay neutral

## Personal Records

- A personal record (issue #56) is the best **raw entry value** ever recorded for a property — never a period aggregate: "longest meditation: 30 min" is a single session, not a daily average
- Polarity is the opt-in and decides the direction: `higher-is-better` records the maximum, `lower-is-better` the minimum, and `neutral` (or no definition) shows nothing, per the no-judgement rule
- Ties keep the earliest entry: a record is set by whoever reached it first
- Boolean series never get a record (issue #161): the best possible value is always `true`, so every ticked entry ties for "best" and the chip carries no information
- Whether a series is boolean is read from the **values**, never from the property definition: the definition is optional, can be stale, and its name match ignores the `note.` / `formula.` namespace, so a checkbox definition can land on a numeric property. A series is boolean when at least one entry carries a boolean reading and no entry carries a non-boolean number — a numeric property that happens to hold only 0 and 1 keeps its record
- Boolean series get a "✅ Checked: 42/90 days (47%)" completion chip in the record's slot, on both charts and heatmaps
- Completion counts the **periods the visualization renders** — heatmap cells, or the chart's dataset — not the raw entries. Raw entries would make the denominator "periods you wrote the property down", so a habit logged only on the days it was done would read a meaningless "42/42 (100%)". A period counts as ticked when it holds a value other than 0, matching heatmap rendering and streaks
- Completion carries no judgement, so unlike a record it needs no polarity. It is hidden only when there are no periods at all: "0/0 (0%)" is noise
- Shown as a "🏆 Record: value (date)" chip on single-dataset cartesian charts (in the trend row, independent of the trend toggle) and on heatmaps (in the streak row, independent of the streak toggle)
- A "🏆 New record!" notice fires when a data update strictly beats the record displayed earlier in the session. The first render never announces — reopening a view must stay silent — and one property + value announces at most once across all visualizations showing it

## Visualization Export

- CSV export serializes exactly what the visualization displays (aggregated values), not raw frontmatter
- CSV export keeps raw numbers whatever the value format (`387`, not `6:27`): a spreadsheet can compute on numbers, not on duration strings. Range charts in time mode are the exception (see Range Charts)
- Values clamped to the axis edge are exported with their real value
- The date-per-note axis exports one row per note: `Date` (yyyy-MM-dd), `Note` (full name), then the series
- Export file names use the card title (see Card Titles)
- Image export requires a canvas, so it is only offered for Chart.js types
- Exports are written to the vault's attachment folder via `getAvailablePathForAttachment`

## Capture Today Command

- Resolves today's note by matching the note path against any daily-granularity filename pattern — built-in (YYYY-MM-DD) or custom (issue #139)
- Notes matched by a custom pattern beat notes matched only by a built-in pattern: a configured (possibly folder-scoped) pattern states where the user's daily notes live (issue #152)
- Within the same group, the most recently modified note wins
- When no note exists, the command offers to create one (issue #160). Opt-in (`createMissingNotes`, off by default) and always confirmed: this writes a new file, and the location comes from another plugin's configuration

## Quick Add

- Issue #122. A panel (command "Quick add" + ribbon icon) listing one day's quick-add properties at once, each saved as it changes; no Next / Done. The capture carousel stays the place for a full check-in
- Panel day: the open note's date when it is a daily note (back-filling in place), today otherwise. ‹ › step one day; a "Today" button appears on any other day
- Day lookup is the Capture Today resolution (custom pattern beats built-in, then freshest), for any date. A missing note offers creation through the same opt-in, confirmed flow (`createMissingNotes`); nothing is created silently
- `showInQuickAdd` on a property definition is **opt-in**: only `true` shows it; absent means hidden. A type default (all numbers and checkboxes) produced a 71-row panel in a real vault with synced health metrics. The panel also respects note filtering (mappings)
- Panel saves follow Data Entry Safety: invalid values are not written, pending debounced edits are flushed before a day change or close
- Link `obsidian://life-tracker-quick-add?property=<name>&<action>[&date=YYYY-MM-DD]` applies one action with no UI. Actions: `increment[=n]`, `decrement[=n]` (numbers), `toggle` (checkboxes), `set=<value>` (any non-list type). Exactly one action. A bare increment/decrement moves one step like the −/+ buttons; an explicit amount adds to the current value (empty = 0). Results are clamped to the range, then validated; invalid writes are refused with a notice
- Links target `date` or today, **never the open note**: a home-screen shortcut must do the same thing whatever is open. `date` is parsed as local midnight and rolled-over dates (2026-02-31) are rejected
- Property lookup: exact name, then case-insensitive name or display name. A property whose mappings exclude the day's daily note is refused, not written. A property that goes to a capture target is not checked against its mappings: the target decides (see Capture Targets)
- A link with no `property` and no action opens the panel on `date` or today
- `append=<value>` adds one entry to a list or tags property (e.g. `reps@weight`), after the existing entries, which are kept as they are (numbers and objects are not stringified; empty entries are dropped); refused on every other type and when the value is empty. Any non-empty value is accepted, `true` included. The new list is validated like any other write
- Links and the panel write each property into the note of its capture target (see Capture Targets); the daily note when it has none
- The panel groups its rows by destination (daily note, then each target in settings order). A destination is listed when at least one quick-add property resolves to it. When the daily note is the only destination, the panel has no group header and looks as before

## Creating Missing Notes

- Location is **read, never invented**, in a fixed order: the Starter Kit note type mapped to the granularity, then the Periodic Notes plugin, then no creation at all. Starter Kit ranks first because it also supplies the note type's mandatory tags, so a created note is correct rather than merely present. Core Daily Notes is deliberately unsupported — Periodic Notes supersedes it
- The Starter Kit is only ever **read**, preserving the rule above. Life Tracker performs its own vault writes; the Starter Kit exposes no creation method on its public API in any case
- The folder to create is the **dirname of the resolved path**, not the configured folder: a `{{token}}` folder and a moment format can both contribute subdirectories, and `vault.create` throws on a missing parent
- `{{year}}` is the calendar year and `{{isoyear}}` the ISO week-numbering year, matching the Starter Kit exactly (its 1.8.0 rule: week layouts want `{{isoyear}}/{{week}}`, since `{{year}}/{{week}}` splits a week across two folders at New Year). Agreeing with the Starter Kit matters more than being right in isolation — a folder that disagrees puts the note where nothing looks
- Starter Kit name affixes may contain date expressions and keep their leading/trailing spaces, both matching Starter Kit behaviour
- The default basename per granularity is the inverse of Life Tracker's own built-in parse formats, and the weekly one uses **ISO** week tokens (`GGGG-[W]WW`). Locale tokens (`gggg-[W]ww`) name a different week than they mean: an en locale makes Sunday 2026-08-30 week 36 while ISO makes it week 35
- A resolved path is refused if it is unsafe: a `..` segment, a control or reserved character (`\ : * ? " < > |`), or a segment ending in a dot or space. A leading `/` is normalized away instead, matching Obsidian's own `normalizePath`
- Only Periodic Notes' flat 0.x settings shape is understood. A 1.x `calendarSets` layout parses to nothing and degrades to "not available" rather than being misread. An absent `enabled` counts as **disabled**, matching Periodic Notes and failing closed on an operation that writes files
- A note is never overwritten: an existing file at the target path is reused (daily notes). Capture targets never reuse a file only because it sits at the resolved path — see Capture Targets
- **A template is applied exactly once.** When Templater is configured to template new files itself (`trigger_on_file_creation` with `trigger_on_file_creation_mode: 'folder'` and a covering folder template, outside `ignore_folders_on_creation`), the note is created plainly and Templater does the work — applying the configured template on top would duplicate the whole note. Otherwise Templater is driven explicitly, and Templater skips files it created itself, so that path cannot double-fire either. The legacy `enable_folder_templates` / `enable_file_templates` booleans are consulted only when the mode key is absent; in Templater 2.25 they merely drive settings-pane visibility
- Frontmatter is written only after templating has settled. Templater's creation hook sleeps before writing, so a capture that wrote immediately would race it and lose data
- A note created through Templater's `create_new_note_from_template` is kept marked as Templater's own (`files_with_pending_templates`) until 700 ms after the call. Templater 2.26 removes the mark when the template ends, but its creation hook only checks it 300 ms after the create event: after a fast template the hook would template the note again (folder template on an empty body) or re-parse and rewrite it, losing a frontmatter write made meanwhile. The mark is only added when Templater does not hold the path itself, and is removed on a timer. When the set is not reachable (another Templater version), creation waits 350 ms, then for Templater's `templater:all-templates-executed` event (at most 2 s), before anything is written. Applies to daily notes and capture targets
- Creation returns only once the metadata cache has indexed the templated note (bounded wait). The vault reports Templater's write before the cache has parsed it; a capture opened in that gap sees no tags, every tag-mapped property definition fails to apply, and the modal reports "No matching properties" on a note that is complete on disk. An untemplated note has nothing to index and does not wait
- With no Templater, or a template that fails or is missing, the note is still created and still receives its properties: capture is the point of the operation
- Creation warns, but does not refuse, when the resolved filename is one Life Tracker cannot parse back (a name prefix, a format like `DD-MM-YYYY`, locale week tokens). Such a note is invisible in every view — issue #160 reintroduced — but the configuration is the user's, and a matching filename date pattern (issue #139) fixes it

## Capture Targets

- A capture target is a named destination for captured values other than the daily note: a note type (a Starter Kit note type, or a standalone folder + file name pattern + tags), a match filter (`property = value` pairs), an optional template and a date property (`date` by default)
- Which target a property uses: an explicit target on the definition; `daily-note` forces the daily note; otherwise, for a Starter Kit-linked definition, the one target whose note type equals the link's note type (zero or several → none); otherwise the daily note. A definition naming a deleted target falls back to the automatic rule. Existing settings have no targets, so every property keeps going to the daily note
- A property is still defined once (one definition per frontmatter key); the target says where that one key is written, it never duplicates the definition
- Lookup scans only the target's folder rendered for the date (e.g. `Sessions/{{year}}` → that year), recursively, never the whole vault
- A note belongs to a Starter Kit target when one of the note type's enabled mappings matches (OR, copied semantics as in Starter Kit Integration); a note type with no enabled mapping matches nothing. A standalone target requires every configured tag; with no tags, the folder alone decides
- Every complete filter pair must match: trimmed, case-insensitive string comparison; a list value matches when one of its items matches. A pair without a property or without a value is ignored for matching and never written (it would otherwise match notes lacking the property and write `property: ''`); the settings page lists such rows as problems. Filters are what tell two notes of one type apart on the same day (a Garmin gym session and the through-the-day session)
- A note's date is its date property when it names a day (`YYYY-MM-DD`, a datetime starting with one, a wikilink `[[YYYY-MM-DD]]` or `[[path/YYYY-MM-DD|alias]]`, or a Date from a YAML parser, read by its UTC calendar day); otherwise (empty, or naming no day) the date read from its file name (filename patterns, then a leading `YYYY-MM-DD`). Several matches: the most recently modified wins
- **A file at the resolved path is never reused** for a target: it may be a different note of the same type. Creation takes the next free name, with a counter right after the date part (`2026-11-03 2 (Strength Session)`). A standalone file name pattern must contain `{{date}}`; the counter goes right after it, never after a later token
- Name of a Starter Kit target's note: `<type prefix><date><type suffix>`. When the target's file name pattern is non-empty and contains `{{date}}` (any case: `{{DATE}}` too), it sets the text around the date: `<type prefix><pattern up to and including {{date}}><pattern after {{date}}><type suffix>` (pattern trimmed). A typed copy of the type affixes is dropped so neither is doubled (case-insensitive): a trailing suffix when the tail ends with the whole suffix, or with the trimmed suffix at a word boundary (preceded by nothing, a space or punctuation, or the suffix starts with punctuation; suffix ` Log` leaves `Backlog` alone); a leading prefix the same way, mirrored. Spaces next to a dropped affix are trimmed only when the affix itself brings a space there (suffix `_S`: `Gym _S` stays). Folder, template and tags still come from the type. An empty pattern or `{{date}}` alone gives the type's plain name. A pattern without `{{date}}` is ignored and listed under **Problems**. Lookup never depends on the name (type, filters, date property)
- Note type target: the file name pattern names a file, never folders: `/` or `\` in a used pattern (one with `{{date}}`) makes the target unusable, with its own **Problems** message, and capture refuses it with the same message. Date formats (`{{date:YYYY}}`) are not supported
- Standalone target: capture behaves exactly as in 3.5.0. A `/` in its pattern makes subfolders (`{{year}}/{{date}}`), and `# ^ [ ]` or a trailing `.` are accepted; never refused, no **Problems** entry
- **Problems** lists what capture would refuse: the layout is rendered for today with `resolveFreeTargetPath(layout, date, () => false)` and a null result is reported, with the same message capture uses. Refused for every target (as in 3.5.0): an unknown `{{token}}` (incl. `{{date:...}}`) or a character a path cannot hold (`\ : * ? " < > |`). Refused only for a note type target (`TargetLayout.strictName`): link-breaking `# ^ [ ]` and a name ending in `.`. "No free name" (every counter taken) has its own message
- One-time settings migrations run on load, keyed by id in `completedMigrations` (in `data.json`, so once per vault); a recorded id never runs again, ids already run this session are kept even when an external `data.json` (older version through Sync) drops the field, and a fresh install records every id without running anything. Migrated settings are saved right away. `note-type-target-file-name-pattern`: 3.5.0 hid File name for note type targets, so a pattern kept from a standalone setup was hidden; it is reset to `{{date}}` on every target with a note type, once
- Creation is refused, with the reason, when the planned note would not be found again by the target (no note type filter matches it with the tags creation writes, or it would carry no readable date): otherwise every capture would create another note. When the new note is still not recognized after the cache wait (a template moved it, dropped its tags), a notice says so
- Creation follows Creating Missing Notes (opt-in, confirmed, template applied once). Templater creates the file at its final name in its final folder, so a template sees the dated title. The target's template overrides the note type's
- A target's template (its own, else the note type's) is **always driven explicitly** through Templater's `create_new_note_from_template`, even when Templater has a folder template covering the folder. Templater marks the file as pending before its creation hook checks it, so the hook skips it and the template still runs once. Leaving it to the folder template let a vault-wide note type picker template the note instead. A target with no template at all leaves Templater's own trigger alone
- After creation the plugin writes the date property (unless the note already names that day, e.g. a template's datetime or `[[YYYY-MM-DD]]`, which is kept), every complete filter pair, and the mandatory tags (a one-string `tags` value is split first; tags under the singular `tag` key count as present) (Starter Kit type tags or standalone tags, merged into `tags`), so the note is found again even when no template ran (no Templater, or a template that failed)
- After that write, capture waits until the metadata cache **shows those values** (type, filters, date), bounded. Waiting for the next `changed` event is not enough: a new note is indexed several times and the first event after the write can belong to an earlier write
- The destination of a target decides: quick add, its links and `Capture today: <target>` do not filter the target's properties by their mappings
- A cache miss is checked against the disk before creation is offered, so a note the cache has not indexed yet is never created a second time. Only likely notes are read (`cachedRead`): a name holding the day's ISO date, a note with no cached frontmatter, or one modified in the last 10 minutes. A folder without `{{year}}` can hold thousands of notes, and this runs on phones. The quick-add panel's Create note button goes through the same check
- One creation per target and day at a time: a request while one is pending (confirmation open, template running) joins it instead of offering another note. A creation that fails settles to null, so it never blocks that target and day
- Quick-add link values are computed inside `processFrontMatter`, from the note as it is at write time, not from the metadata cache: two quick taps, or two requests joining one creation, both count (increments add up, appended entries are both kept)
- Capture target settings edits (and "Capture into") send the `capture-targets-changed` change, which views ignore; the per-target command sync is debounced (500 ms)
- The "will not appear in your views" warning is not shown for a target with a date property: the note is dated by that property. A target with an empty date property falls back to the filename check
- `Capture today` keeps its id and only lists the properties whose destination is the daily note. Each target adds a command `Capture today: <name>` (id `capture-today-target-<target id>`), re-registered whenever targets change; a removed target's command is removed
- Opening `Capture properties` on a note is unchanged: the open note, every applicable property

## High Contrast Mode

- Opt-in global setting (Settings → Visualizations → Accessibility), off by default (issue #137).
- While on, chart palettes and gradient heatmap schemes are replaced by maximum-contrast palettes, overriding whatever scheme the view or preset selected — legibility is the point of the mode.
- Discrete heatmap schemes are never overridden: they map specific values to specific colors on purpose, and replacing them would destroy the meaning the user encoded.
- Structural changes (thicker card and cell borders, no dimmed affordances, stronger focus rings and grid rules) come from the `lt-high-contrast` class the Life Tracker and Grid views put on their container.
- Toggling it redraws the Life Tracker view (canvas colors are baked in at render time); the Grid view only re-applies the class.

## Goals and Targets

- A target (issue #6) reads as one sentence: "<metric> of <property> per <period> must be <direction> <value>". `{ metric: 'count', period: 'weekly', direction: 'at-least', value: 3 }` is "do it on 3 days a week".
- Metrics: `count` (entries with a non-zero value), `days` (distinct days with at least one non-zero entry), `sum`, `average`, `latest`. `days` exists because several notes can share a day (a gym session and a through-the-day session): `count` would read two notes as two days. `count` keeps its meaning; stored configs are never rewritten. `days` accumulates from zero and is measurable when empty, like `count`. `count` deliberately excludes zero — a note recording `push_ups: 0` says the exercise was _not_ done, and counting it would make any "N days a week" target trivially true for anyone who logs daily.
- Targets are stored per visualization, so one property can carry several (e.g. squats: days-per-week on one card, reps-per-week on another).
- Supported by the progress ring and by cartesian charts, which draw the target as a reference line. A target and an explicitly configured reference line are BOTH drawn (issue #156) — they answer different questions; the target line uses a tighter dash pattern and anchors its label at the left edge while reference labels anchor at the right, so the two stay readable even at the same value.
- Targets read from a `.base` file are validated field by field; anything malformed is dropped whole rather than half-applied — a ring silently measuring the wrong thing is worse than no ring.
- When the chart plots a running total, the target line accumulates with it (issue #158): it slopes from `value` at the first period to `value × periods` at the last, and its label says "(cumulative)". This only holds when the target's period matches the plotted granularity — a "per week" goal has no honest slope on a daily axis, so a period-mismatched target is not drawn at all under a running total rather than drawn wrong. Explicit reference lines are unaffected: a user-configured horizontal threshold stays horizontal.
- On the date-per-note axis (3.4.0), a cumulative target slopes over the time the notes span: `span / period length + 1` periods (average lengths: 1, 7, 365.25/12, 365.25/4, 365.25 days), whatever the target's period, since a time axis gives every period an honest slope. With no notes there is no span and no line. On the note-name axis, which has no time, a cumulative target is not drawn: notes are not periods
- Target labels on charts: `count` and `days` targets stay plain numbers under a duration format ("Target: 3", never "Target: 0:03")

## Progress Ring

- The ring shows the period the _view's last day_ falls in, not an average of the range: it is the only number still actionable (issue #126).
- When the view ends on a period with no entries at all, the ring shows zero rather than falling back to the last period with data. A week where nothing was logged is a week the target was missed.
- That synthesized empty period is not counted in the hit rate — only periods that actually contain entries are.
- Status drives color: `met` (green), `close` (yellow, at or above the warn threshold, default 50% of the target), `behind` (red), `no-data` (neutral).
- `no-data` applies to `average` and `latest` targets only: a period with nothing recorded is _unknown_, not zero. Without it, "at most 80 kg" would read as met in every week the user forgot to weigh themselves. `count`, `days` and `sum` treat an empty period as a real zero — doing nothing all week genuinely is 0 days and 0 reps.
- A `no-data` period is never counted as met, and is excluded from the hit rate's denominator.
- The ring's title carries the goal (`Squats · ≥ 3 days/week`) because one property can carry several goals. The goal suffix follows the card title, own or property name (see Card Titles). The `/period` suffix is only added for `count`, `days` and `sum`, the metrics that accumulate — "≤ 80 kg per week" would read as a rate.
- Streaks count periods that **met** the target, not periods with any data: two squats in a three-a-week goal is not a week of the habit. Same present-reaching rule as the heatmap's streaks (issue #100).
- The history strip shows the last 26 periods, stretched to the card width.
- `close` only applies to at-least targets. An at-most target that is not met has already been exceeded — there is nothing close about it.
- The ring fills as a fraction of the target for both directions, so a full ring on an at-most target means the budget is spent.
- A progress card with no target renders a "set a target" prompt, never an empty state: the user must not be sent looking for missing data.

## Card Reordering

- The drag handle is hidden while a card is maximized: a maximized card fills the view alone, so there is nothing to reorder it against.

## Touch Interaction

- On touch input (finger or pen), the first tap on a chart data point or heatmap cell only inspects it: the tooltip shows and nothing is opened. A second tap on the same target within 5 seconds opens the underlying note (issue #154).
- Mouse and keyboard interaction is unchanged: a click or Enter opens the note straight away.
- The pointer type is read from `pointerdown` on the canvas / heatmap grid, so a device switching between mouse and touch behaves correctly without any setting.
- Tapping a different target re-arms that one instead of navigating; a re-render disarms.
- Heatmap tooltips replace their subtitle with "Tap again to open" while a cell is armed, so the two-step interaction is discoverable where hover does not exist.

## Reduced Motion

- Decorative animations (confetti, Chart.js animations, CSS keyframe animations) MUST respect the OS-level `prefers-reduced-motion` setting (issue #109)

## Reference Lines

- Reference lines are only supported for cartesian chart types: LineChart, BarChart, AreaChart
- Reference lines are disabled by default and must be explicitly enabled per property
- For overlay charts, each property can have its own independent reference line
- Reference line colors match the dataset color for visual consistency
- Default label format is "Reference: {value}" if no custom label is provided — "Target:" is the goal target line's prefix, and the two must not read alike (issue #156)

## Value Format

- `valueFormat` per visualization (and per overlay), stored in the `.base` view config, so it travels with the Base. No plugin setting (3.4.0)
- `number` (default, absent): unchanged behavior. `duration-mm-ss`: the value is seconds, shown `m:ss`, `h:mm:ss` from one hour (330 → `5:30`). `duration-h-mm`: the value is minutes, shown `h:mm` (95 → `1:35`). Rounded to the unit shown
- Negative or non-finite values fall back to the number format: they have no duration reading
- Display only: aggregation, trend, records, targets and CSV keep working on the raw number. The trend row keeps its percentage
- Applies to y-axis ticks, tooltips (moving average included), default reference-line and target labels (custom labels stay as typed), records and record notices, heatmap tooltips, numeric keys of a discrete heatmap legend, and progress ring amounts
- Progress: only `sum`, `average` and `latest` amounts are formatted; `count` and `days` count entries or days, never the property's unit
- Duration axes tick on a duration ladder (seconds: 1/2/5/10/15/30 s, 1/2/5/10/15/30 min, 1/2/3/6/12/24 h; minutes: 1/2/5/10/15/30 min, 1/2/3/6/12/24 h), the smallest step covering the range in at most 6 intervals
- Line and area charts with a duration format fit the y-axis to their data instead of starting at 0: a pace of 5:00–7:00 drawn from 0:00 flattens every change. Bars always start at 0 (a bar from a non-zero baseline lies about its length). Number-format charts keep starting at 0. An explicit scale wins
- Offered for heatmap, line, bar, area, scatter, bubble and progress cards. Pie, doughnut, polar and radar plot counts of values; tag cloud and timeline show no numbers
- An unknown stored value reads as `number`

## Card Titles

- A configured card shows its own `title` when it is a non-empty string, else the property's current display name, as before 3.4.0. Several cards on one property ("Run days", "Distance per run (km)") stay distinguishable
- `title` is set from "Card title…" in the card's right-click menu (or by hand in the `.base` file); applying an empty field removes it
- `displayName` is never used as the title: it is written automatically at configuration time (the property name then), so every existing card carries one, and showing it froze each card on the name its property had back then. It keeps its old meaning
- Overlays keep using their own `displayName`, which the user chooses in the overlay modal
- The title is used for the card header, maximized view, progress goal suffix (`Run days · ≥ 3 days/week`), empty states, record notices, series label and export file names. Data points keep the property's display name

## Chart Outliers

- Line, bar and area charts (and line/bar/area overlays) with no explicit scale fit the y-axis to the bulk of the data (3.4.0, default `outliers: fit`). One bad entry (49997 among ~380) otherwise set the axis to 0–50,000
- Outliers are values beyond Tukey's far-out fences, Q1 − 3·IQR and Q3 + 3·IQR (linear-interpolated quartiles), computed per series. Fences apply only with at least 8 values and when they actually exclude something
- IQR = 0 (issue #187: 10, 10, 10 … plus one typo of 1000 kept a 0–1000 axis): fences fall back to median ± 3.5 · 1.4826 · MAD (modified z-score > 3.5); when the MAD is 0 too, only values above 10 × the median are outliers (median > 0; no lower fence: a 0 or a short session among equal values is a real value, not a typo). Equal quartiles put more than half the values on the median, so the MAD is 0 as well and the ratio rule decides in practice
- Series whose values are only 0 and 1, and checkbox (boolean) series even once averaged or summed per period (single cards and each overlay series, `ChartDataset.isBoolean`), are exempt from outlier detection: no fitting, no markers, nothing left out of the average. A yes/no habit has no outliers
- Fitted series: real per-period or per-note values. Never fitted: the moving average, running totals (one jump carries into every later point), list (0/1) data
- Axis range when fitting: in-fence values of every series, plus every reference/target line value, plus 0 when the axis starts at 0; rounded out to a nice step (duration ladder for duration formats, 1/2/5 × 10ⁿ otherwise). Bounds and step are set explicitly
- Values beyond the axis are drawn at its edge and get a triangle marker (up above, down below) in the series color, from a separate marker dataset: always visible, never in the legend or the tooltip. The tooltip of the series shows the real value plus "(outside the scale)"
- A value beyond the fences but inside the rounded axis is drawn as is
- The moving average, trend, records and CSV use real values, never clamped ones
- `excludeOutliersFromAverage: true` (card menu "Leave outliers out of the average", issue #186; default off, absent = off; line, bar and area cards, not list data) computes the moving average and the trend without the values beyond the fences (same fences as the axis, computed on the series the average or trend reads). The points are still drawn: as edge markers when fitted, in place with `show-all` or an explicit scale. A running total is averaged as is (it has no outliers of its own); the per-period trend of a running total leaves them out. Not offered on overlays
- `outliers: show-all` (card menu "Outliers", overlay modal) restores the full range. An explicit scale (`min` or `max` set) always wins: no fitting
- Hiding a series from the legend hides its outlier markers too
- Incremental updates copy the markers' positions and directions and the point radii along with the data, so a marker follows its outlier and markers come back when a series drops to 40 points or fewer. A different set of marker datasets (outliers appearing or disappearing) rebuilds the chart
