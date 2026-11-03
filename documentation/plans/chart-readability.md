# Chart readability (3.4.0)

Make cartesian cards readable on real data. Trigger: a running tracker over ~170
session notes whose pace card (`pace_seconds_per_kilometer`, seconds) was
unreadable: one bad value (49997) set the y-axis to 0–50,000, 170 overlapping
markers, long rotated labels like `2025-06-24 (Running Session)`, and seconds
instead of `6:27`. Several cards on one property all showed the property name.

Status: **done** on `feat/chart-readability` (all build steps below shipped;
`bun run tsc`, `bun run lint`, `bun test`, `bun run build` clean). Needs manual
verification in a live vault (see Verification). Not merged or released.

## Features

| #   | Feature                    | Config key (per card, `columnConfigs`)                   | Default                    |
| --- | -------------------------- | -------------------------------------------------------- | -------------------------- |
| 1   | Value format               | `valueFormat: number \| duration-mm-ss \| duration-h-mm` | `number` (absent)          |
| 2   | Card titles                | `title` (new; set from "Card title…")                    | property display name      |
| 3   | Outliers don't set scale   | `outliers: fit \| show-all`                              | `fit` (absent)             |
| 4   | Date, one point per note   | `xAxisSource: date-per-note`                             | `date` (absent)            |
| 5   | Note-name axis labels      | none                                                     | always on                  |
| 6   | Point markers above 40 pts | none                                                     | always on                  |
| 7   | Moving average emphasis    | existing `movingAveragePeriod`                           | only when an average is on |

Overlays (`overlayConfigs`) also take `valueFormat` and `outliers`, set from the
overlay edit modal.

## Decisions

| Question                                  | Decision                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the format lives                    | Per visualization in the `.base` view config (portable). No plugin setting.                                                                                                                                                                                             |
| Duration units                            | `duration-mm-ss`: value is seconds (330 → `5:30`, ≥ 3600 → `h:mm:ss`). `duration-h-mm`: value is minutes (95 → `1:35`). Rounded to the unit shown.                                                                                                                      |
| Unformattable values                      | Negative or non-finite values fall back to the number format.                                                                                                                                                                                                           |
| Duration ticks                            | Fixed step from a duration ladder (seconds: 1/2/5/10/15/30 s, 1/2/5/10/15/30 min, 1/2/3/6/12/24 h; minutes: 1/2/5/10/15/30 min, 1/2/3/6/12/24 h), at most 6 intervals.                                                                                                  |
| Duration baseline                         | Line/area charts with a duration format fit the y-axis to the data instead of starting at 0 (a pace of 5:00–7:00 from 0:00 flattens every change). Bars always start at 0. Number-format cards keep starting at 0 (backward compatible). An explicit scale always wins. |
| Where the format applies                  | y ticks, tooltips, moving average, reference line / target labels, progress ring numbers (sum/average/latest metrics only: count/days are counts), records, heatmap tooltip, discrete heatmap legend. Trend row keeps its percentage. CSV keeps raw numbers.            |
| Card title                                | Card `title` when set (menu "Card title…", empty clears), else the property display name. `displayName` is auto-saved on every card and keeps its old meaning. Progress keeps its goal suffix. Exports use the title.                                                   |
| Outlier rule                              | Tukey fences Q1 − 3·IQR / Q3 + 3·IQR, per series, only with ≥ 8 points, IQR > 0, and when the fences exclude something. Linear-interpolated quartiles.                                                                                                                  |
| Which series are fitted                   | Line/bar/area numeric series and each overlay series. Not list (0/1) data, not running totals (a cumulative series carries one jump into every later point), not the moving average.                                                                                    |
| Axis when fitting                         | Range = bulk of every fitted series ∪ reference/target values ∪ 0 when the baseline is 0, rounded out to a nice step. Explicit `min`/`max`/`stepSize`.                                                                                                                  |
| Clamped points                            | Plotted at the axis edge, plus a triangle marker (up above, down below) in an extra marker dataset (no legend, no tooltip row). The tooltip of the series shows the real value and "outside the scale".                                                                 |
| Moving average / trend with outliers      | Computed on real values (not clamped). The average can leave the axis; Chart.js clips it.                                                                                                                                                                               |
| Date-per-note axis                        | Linear x axis over timestamps (no Chart.js date adapter is bundled), date ticks built in `afterBuildTicks` (day/week/month/quarter/year units), horizontal, auto-skipped. Notes sorted by date anchor (stable).                                                         |
| Date-per-note: notes without date / value | Skipped. The skipped-for-no-date count is shown in the trend row ("N notes without a date").                                                                                                                                                                            |
| Date-per-note tooltip title               | `MMM d, yyyy · note name`.                                                                                                                                                                                                                                              |
| Note-name labels                          | Tick labels strip one trailing `(…)` suffix; horizontal first, rotate up to 45°, auto-skip. Tooltip and CSV keep the full name.                                                                                                                                         |
| Point markers                             | Hidden above 40 points per dataset on line/area (`pointRadius: 0`, hover radius 4, hit radius 8). Was 500.                                                                                                                                                              |
| Moving average emphasis                   | Average: solid, 2.5 px, full color, drawn on top, first in legend/tooltip (`order`). Raw series: 1 px, 35% opacity, no fill, small faded points (hidden above 40). Click handling picks the first element that has notes, since `order` reorders elements.              |

## Build sequence (all done)

1. `ValueFormat` type + normalization, `src/utils/value-format.utils.ts` (+ spec): duration formatting, tick step ladder.
2. Wire the format into chart ticks/tooltips/reference labels/records, heatmap tooltip/legend, progress ring; card menu + overlay modal + view action.
3. `resolveCardTitle` (+ spec); view passes the card title to visualizations and exports.
4. `src/app/services/outlier.utils.ts` (+ spec): quartiles, fences. `chart/y-axis-plan.utils.ts` (+ spec): range, nice step, clamping, outlier list.
5. Cartesian dataset building in `chart/cartesian-datasets.utils.ts` (+ spec): marker datasets, point radius threshold, moving-average emphasis.
6. Outlier menu option + overlay modal option; initial render and incremental update use the same plan.
7. `aggregateForDatePerNoteChart` (+ spec), `chart/date-ticks.utils.ts` (+ spec), linear x axis, menu option, skipped count.
8. `stripNoteTypeSuffix` (+ spec) on the note-name axis.
9. Point markers hidden above 40 points (`POINT_MARKER_THRESHOLD`), moving average emphasis (`cartesian-datasets.utils.ts`).
10. Business rules, technical docs, README and `docs/`.

## Verification (manual, in a vault)

Agents cannot run Obsidian: everything below needs a look in a vault.

- Pace card with `valueFormat: duration-mm-ss`: y ticks `5:00, 5:30, 6:00…`, tooltip `6:27`, record `Record: 5:12`, reference line label formatted.
- Same card with the 49997 value: axis stays on the bulk, the outlier is a triangle at the top edge, tooltip shows `13:53:17 (outside the scale)`; `outliers: show-all` restores the full range.
- `xAxisSource: date-per-note`: points spaced by date, short horizontal date labels, gaps visible, notes without a date counted in the trend row.
- Note-name axis: `2025-06-24` labels, tooltip keeps `2025-06-24 (Running Session)`.
- 170-point line: no markers until hover; a 20-point line keeps markers.
- Moving average on: average solid and first in legend, raw thin and faded; clicking a point opens its note.
- Three cards on one property, each given a title with "Card title…": each shows its own title; progress keeps `· ≥ N days/week`; clearing the title brings back the property name.
- Incremental update (edit a pace value in a note while the view is open): axis, markers and the "notes without a date" count follow; adding or removing the outlier rebuilds the card.
- Play animation on a date-per-note chart: points appear left to right, no console error.
- Overlay with `valueFormat`/`outliers` set from the edit modal: ticks, tooltips and markers follow; range charts ignore both.
- Heatmap and progress ring with `duration-mm-ss` / `duration-h-mm`: tooltip, record chip, ring center, goal and strip tooltips formatted; count/days targets stay plain numbers.
- Mobile: tap a clamped point shows its real value; second tap opens the note.

## Follow-ups (not done)

- ~~The moving average uses real values, so one outlier pulls the average off the axis for a window.~~ Done in #186: per-card "Leave outliers out of the average".
- Number-format line charts still start at 0 when auto-scaled (backward compatible); a "fit to data" baseline option could help non-duration metrics too.

## Review fixes

An adversarial review found these; all fixed with specs:

- Same-day notes on the date-per-note axis were unreachable: notes sharing an instant are spread within their day, and that axis uses `nearest` interaction on both axes.
- Bars on that axis: no `offset`, half a day of room at each end, 3–16 px bars from the smallest gap.
- Overlay edits now force a full render.
- Card titles moved from the auto-saved `displayName` to an explicit `title` key with a "Card title…" menu item.
- Incremental updates copy marker rotation and point radii; hiding a series in the legend hides its markers.
- Cumulative targets: time-span periods on the date-per-note axis, not drawn on the note-name axis. Count/days target labels stay numbers.
- "Notes without a date" counts only notes with a value; its accessible label carries the count. Trend row says "notes" on per-note axes.
- Multi-day ticks anchored to a calendar origin; folds instead of `Math.min(...arr)`.
