# Custom Heatmap Colorschemes Implementation Plan

Tracks: [Issue #82](https://github.com/dsebastien/obsidian-life-tracker-base-view/issues/82)

## Overview

Heatmaps currently map values to color by bucketing the numeric range into 5 levels and looking each level up in a single-hue palette (gradient). This does not fit categorical-feeling numeric data such as mood scores (1..5) where each value benefits from a **distinct hue** rather than a shade of the same color.

Add a second color-scheme **mode** — `discrete` — that maps specific values directly to specific colors, alongside the existing `gradient` mode. Both modes coexist; users choose per visualization.

## User Requirements

- Keep existing gradient presets working unchanged (no regression for current users).
- Allow defining a custom mapping of `value → color` for a heatmap (e.g. `1 → red`, `2 → orange`, `3 → yellow`, `4 → light green`, `5 → green`).
- Configurable per visualization (the per-viz `colorScheme` override path already exists).
- Fall back gracefully when a cell's value has no mapping entry.

## Design Decisions

- **Two kinds of scheme**, discriminated union — not a flag on the existing scheme. Discrete mode does not have meaningful `levels`, so reusing the same shape would force `null`s and confuse consumers.
- **Discrete mapping keys are strings**, even for numeric values. JS object keys are strings anyway; storing `Record<string, string>` avoids round-tripping issues in JSON settings and keeps the door open for future categorical (string) values.
- **Discrete mode bypasses min/max normalization**. Renderer still computes them (cheap) but `resolveHeatmapCellColor` ignores them in discrete mode.
- **Inline `backgroundColor` for discrete cells, CSS classes stay for gradient cells.** Discrete colors are unbounded — we cannot pre-declare CSS classes for every possible mapping. Gradient mode keeps the existing class-based approach to avoid churn.
- **One-time normalization on settings load** for legacy `{ empty, levels }` objects → `{ kind: 'gradient', empty, levels }`. No migration ceremony beyond that.

## Implementation Steps

### 1. Extend the color scheme type

**File:** `src/app/types/visualization/visualization.types.ts` (around line 167)

Replace the existing `HeatmapColorScheme` interface with a discriminated union:

```typescript
export interface GradientHeatmapColorScheme {
    kind: 'gradient'
    empty: string
    levels: [string, string, string, string, string]
}

export interface DiscreteHeatmapColorScheme {
    kind: 'discrete'
    empty: string
    /** Map of stringified value → color. Numeric values become "1", "2", ... */
    mapping: Record<string, string>
    /** Color used when a cell value has no entry in `mapping`. Defaults to `empty`. */
    fallback?: string
}

export type HeatmapColorScheme = GradientHeatmapColorScheme | DiscreteHeatmapColorScheme
```

### 2. Update presets and color resolution

**File:** `src/utils/color.utils.ts`

- Add `kind: 'gradient'` to every entry in `HEATMAP_PRESETS` (lines 22-40), to `DEFAULT_HEATMAP_COLORS` (line 6), and to `DARK_HEATMAP_COLORS` (line 14).
- Add a new resolver function (the single entry point the renderer should use):

```typescript
export function resolveHeatmapCellColor(
    value: number | null,
    scheme: HeatmapColorScheme,
    min: number,
    max: number
): string {
    if (value === null || value === undefined) return scheme.empty

    if (scheme.kind === 'discrete') {
        return scheme.mapping[String(value)] ?? scheme.fallback ?? scheme.empty
    }

    const level = getColorLevelForValue(value, min, max)
    return getHeatmapColor(level, scheme)
}
```

- Update `getHeatmapColor` (line 45) signature to accept only `GradientHeatmapColorScheme` (narrow with a type guard at call sites if any remain outside the resolver).
- Update `applyHeatmapColorScheme` (line 264) to only set CSS vars when `scheme.kind === 'gradient'`; no-op for discrete (cells get inline colors).

### 3. Update the heatmap renderer

**File:** `src/app/components/visualizations/heatmap/heatmap-renderer.ts` (lines 121-123)

Replace:

```typescript
const level = getColorLevelForValue(cell?.value ?? null, data.minValue, data.maxValue)
cellEl.classList.add(`lt-heatmap-cell--level-${level}`)
```

with mode-aware coloring:

```typescript
if (config.colorScheme.kind === 'discrete') {
    const color = resolveHeatmapCellColor(
        cell?.value ?? null,
        config.colorScheme,
        data.minValue,
        data.maxValue
    )
    cellEl.style.backgroundColor = color
} else {
    const level = getColorLevelForValue(cell?.value ?? null, data.minValue, data.maxValue)
    cellEl.classList.add(`lt-heatmap-cell--level-${level}`)
}
```

Keep the `lt-heatmap-cell--has-data` class branch as-is — it controls hover/border styling, not fill.

Note on the "no static inline styles" lint rule: this is a computed value, not a literal RHS, so the rule does not fire (same pattern as the existing `setCssProps` calls in this file).

### 4. Wire up per-visualization config

**File:** `src/app/types/column/column-config.types.ts` (lines 31-54)

The per-viz `colorScheme` field currently accepts a `ChartColorScheme` string. Widen it so a heatmap viz can carry an inline custom scheme:

```typescript
colorScheme?: ChartColorScheme | HeatmapColorScheme
```

**File:** `src/app/view/visualization-config.helper.ts` (lines 41-43)

When resolving the heatmap config:

- If the override is a string preset → look up in `HEATMAP_PRESETS`.
- If the override is an object → use as-is (assume already normalized to the union shape).
- If absent → fall through to global setting / default.

### 5. Normalize legacy settings on load

**File:** wherever settings are loaded (likely `src/main.ts` or a settings-loader module — confirm during implementation)

On `loadData()`, walk visualization presets and global heatmap config; for any `colorScheme` matching the legacy `{ empty, levels }` shape (no `kind` field), rewrite to `{ kind: 'gradient', empty, levels }`. Done via `updateSettings(draft => ...)` per the immer rule (see `AGENTS.md` — never mutate `this.plugin.settings` directly).

### 6. Settings UI — color mode selector + mapping editor

**File:** `src/app/view/view-options.ts` (around lines 98-109)

- Replace the single "Color scheme" dropdown with two controls inside the Heatmap group:
    - **Color mode**: dropdown `Gradient (preset)` / `Custom mapping`.
    - **When Gradient**: existing preset dropdown (`Green`, `Blue`, `Purple`, `Orange`, `Red`).
    - **When Custom mapping**: render a mapping editor — a list of rows each with:
        - Value text input (e.g. `1`)
        - `<input type="color">` for the color
        - Remove button
    - Plus an "Add entry" button below the list, and an "Empty/fallback color" picker.

All writes through `this.plugin.updateSettings(draft => ...)`.

### 7. Heatmap legend (if present)

Search for an existing heatmap legend component. If found:

- Gradient mode → existing "less ←→ more" rendering.
- Discrete mode → render one labelled swatch per `mapping` entry, in entry order.

If no legend exists yet, skip.

### 8. Tests

Add `.spec.ts` files next to the changed modules:

- `src/utils/color.utils.spec.ts` (extend existing):
    - `resolveHeatmapCellColor` returns the mapped color for known values in discrete mode.
    - Returns `fallback` for unknown values; returns `empty` when no fallback set.
    - Returns `empty` for `null` / `undefined` regardless of mode.
    - Gradient mode delegates to existing level-based logic (no behavior change).
- Settings normalization: legacy shape becomes `{ kind: 'gradient', ... }`, modern shape passes through unchanged.

### 9. Documentation

- **`README.md`** — short bullet under heatmap features mentioning custom value→color mapping.
- **`docs/`** — short end-user guide section: when to use discrete vs gradient, how to add entries in settings.
- **`documentation/history/<today>.md`** — log the change, the union-type decision, and link this plan.
- **`documentation/Business Rules.md`** — no change required; this is additive.

## Smallest Viable First Cut

If shipping incrementally:

1. Steps 1–5 only: type union, resolver, renderer branch, per-viz override, settings normalization.
2. Defer step 6 (UI editor). A user can still configure discrete mode by editing the per-viz `colorScheme` JSON manually.
3. Once the data + render path is proven end-to-end in a real vault, ship the UI editor.

## Open Questions

- Should the mapping editor support **ranges** (e.g. `1-2 → red`, `3-4 → orange`) in addition to exact values? Defer until a real use case asks for it; exact-value mapping covers the issue as filed.
- Should `mapping` keys ever be non-numeric (true categorical strings)? Type already allows it via `Record<string, string>`. Renderer reads `String(cell.value)` so this works _if_ upstream data ever produces non-numeric values. Out of scope for this plan — currently `HeatmapCell.value` is `number | null`.

## Verification Checklist (Definition of Done)

- [ ] `bun run tsc` passes
- [ ] `bun run lint` passes with zero warnings
- [ ] `bun test` passes, new specs added for discrete-mode resolution + settings normalization
- [ ] `bun run build` succeeds
- [ ] Manual runtime check in Obsidian: existing gradient presets unchanged; discrete mapping visibly colors cells per the mapping; unmapped values fall back to `fallback`/`empty`
- [ ] `README.md` + `docs/` updated
- [ ] Today's `documentation/history/<date>.md` updated; this plan closed or status-updated
