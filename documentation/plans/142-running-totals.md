# #142 — Running totals for numeric properties

Show the cumulative total of a numeric property over time instead of the
per-period value, so a `pages_read: 42` per session can be read as progress
toward a long-term goal.

## Decisions

| Question                   | Decision                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config shape               | A separate `runningTotal?: boolean`, **not** a third `AggregationMethod`. Composes with `sum`/`average`: values inside one period combine as configured, then periods accumulate. |
| Series                     | Replaces the plotted series (one dataset), as the issue asks — not an extra overlay dataset.                                                                                      |
| Baseline with a time frame | Accumulation starts at 0 at the left edge of the visible window. No data is read from outside it.                                                                                 |
| Visualization types        | Line and area charts only.                                                                                                                                                        |
| Presets / overlays         | Out of scope, mirroring `movingAveragePeriod` (#101), which is per-visualization config only.                                                                                     |

## Semantics

- Values within one period combine via the existing `aggregationMethod`, then the
  periods accumulate left to right.
- A period that exists but holds no value carries the previous total forward (a
  flat segment): the accumulated total genuinely has not changed. It is not a
  gap, and not a drop to zero.
- Periods before the first value stay `null`, so nothing is drawn before there is
  anything to accumulate.
- The dataset label gains a ` (running total)` suffix. The series no longer means
  what its bare property name says, and the label is what the legend and the CSV
  export both show.
- Moving average, if also enabled, is computed on the cumulative series — that is
  the series actually plotted.
- The trend row keeps working on the plotted series. On a cumulative series it
  trends upward by construction; `showTrendInfo` already turns it off.

## Status

Done — all ten steps below shipped, `bun run validate` and `bun run build` clean.
The GUI parts still need a look in a live vault; see Verification.

## Build sequence

1. `types/column/column-config.types.ts` — `runningTotal?: boolean` on
   `ColumnVisualizationConfig`; `RUNNING_TOTAL_SUPPORTED_TYPES` (line, area) and
   `supportsRunningTotal()`.
2. `types/column/index.ts`, `types/index.ts` — re-export both.
3. `types/visualization/visualization.types.ts` — `runningTotal?: boolean` on
   `ChartConfig`.
4. `types/ui/card-menu-action.intf.ts` — `{ type: 'configureRunningTotal';
runningTotal: boolean }`.
5. `services/chart-aggregation.utils.ts` — `computeRunningTotal()`, pure, with
   the null handling above. Unit-tested.
6. `components/visualizations/chart/chart-visualization.ts` — apply it in the
   numeric branch of both `render()` and `updateCartesianChart()`, before
   `applyMovingAverage()`. The list-data branch is untouched.
7. `components/ui/card-context-menu.ts` — a "Running total" dropdown in the
   Options column, gated on `supportsRunningTotal()`.
8. `view/visualization-config.helper.ts` — carry the flag from stored column
   config into `ChartConfig`.
9. `view/life-tracker-view.ts` — pass the current value to the popover, handle
   `configureRunningTotal`.
10. Tests next to the code; `README.md` and `docs/` for the new option.

## Verification

`computeRunningTotal` and the aggregation path are unit-testable and will be
covered by specs. The popover control and the redrawn chart are GUI and need a
live vault: check the toggle on a line and an area chart, with `sum` and with
`average`, with a gap in the middle of the range, alongside a moving average,
and that the setting survives a reload.
