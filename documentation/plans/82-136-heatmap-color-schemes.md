# Custom heatmap color schemes (#82) + colorblind-friendly palettes (#136)

Status: **done** — implemented 2026-07-30, pending manual runtime verification in a
vault. See `documentation/history/2026-07-30.md` for what shipped and why the
issue's step 5 (settings migration) turned out to be unnecessary.

## Goal

1. **#82** — let a heatmap map _specific values_ to _specific colors_ (`1 → red`, …,
   `5 → green`) instead of only shading one hue by intensity. Mood-style 1..5 data
   reads badly as a single-hue gradient.
2. **#136** — ship color-vision-deficiency-safe palettes for both heatmaps
   (sequential) and charts (categorical), and seed new custom mappings from a
   CVD-safe ramp so the #82 editor produces accessible output by default.

## Design

### Scheme shape

`HeatmapColorScheme` becomes a discriminated union:

- `{ kind: 'gradient', empty, levels: [5] }` — today's behavior, unchanged.
- `{ kind: 'discrete', empty, mapping: Record<string, string>, fallback? }` — exact
  value → color.

Keys are strings (`String(value)`): JSON settings round-trip cleanly and it leaves
room for categorical values later.

Discrete mode ignores min/max normalization entirely. Gradient mode keeps the
CSS-variable + level-class rendering it uses today; only discrete cells get an
inline `background-color`, because arbitrary mappings cannot be pre-declared as
CSS classes.

### Storage

The per-visualization `colorScheme` field currently holds a preset _name_
(`ChartColorScheme`). It widens to `StoredColorScheme = ChartColorScheme |
HeatmapPresetName | HeatmapColorScheme` — a name, or an inline custom scheme.

No settings migration is needed: no `{ empty, levels }` object has ever been
persisted (presets are code constants; view config stores names). Instead,
`normalizeHeatmapColorScheme()` validates whatever is read from the `.base` file
at point of use, and upgrades a bare `{ empty, levels }` to `kind: 'gradient'`
for free. Charts narrow with `asChartColorScheme()` so a heatmap's inline object
can never leak into `ChartConfig`.

### Palettes (#136)

- Heatmap gradients gain **viridis** and **cividis** (both CVD-safe sequential;
  cividis is specifically optimized for deuteranopia).
- Charts gain a **colorblind** categorical scheme (Okabe–Ito 8-color palette, the
  standard CVD-safe qualitative set).
- New discrete mappings seed from a CVD-safe 5-step ramp, and the "add entry"
  button cycles Okabe–Ito colors — accessible by default, not by opt-in.

Heatmaps and charts no longer share one options list: `HEATMAP_COLOR_SCHEME_OPTIONS`
(gradient presets + "Custom mapping…") vs `COLOR_SCHEME_OPTIONS` (chart schemes).

## Steps

1. `visualization.types.ts` — split `HeatmapColorScheme` into the union.
2. `column-config.types.ts` — `StoredColorScheme`; widen `colorScheme` on
   `ColumnVisualizationConfig` and `OverlayVisualizationConfig`.
3. `color.utils.ts` — `kind: 'gradient'` on every preset; viridis/cividis;
   Okabe–Ito chart scheme; `resolveHeatmapCellColor`, `isDiscreteHeatmapScheme`,
   `normalizeHeatmapColorScheme`, `asChartColorScheme`, `createDefaultDiscreteScheme`,
   `nextDiscreteEntryColor`; `getHeatmapColor`/`applyHeatmapColorScheme` narrow to
   gradient.
4. `heatmap-renderer.ts` — one `applyCellColor()` helper used by **all five**
   granularity paths (the plan in the issue only covered the daily one).
5. `heatmap-visualization.ts` — same helper on the in-place update path (must clear
   any inline background when switching back to gradient); discrete legend.
6. `visualization-config.helper.ts` — resolve name vs inline object; narrow charts.
7. `card-context-menu.ts` — heatmap-specific "Colors" dropdown + mapping editor modal.
8. Plumbing: `CardMenuAction`, `saveColumnConfig`, preset settings dropdown.
9. Tests next to each changed module; docs; history entry.

## Open questions

- Range mappings (`1-2 → red`) are out of scope until asked for; exact values cover
  the issue as filed.
- Non-numeric (categorical) mapping keys already type-check, but `HeatmapCell.value`
  is `number | null`, so nothing produces them yet.
