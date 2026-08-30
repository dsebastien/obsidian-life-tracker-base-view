---
title: Configuration
nav_order: 3
---

# Configuration

## Plugin Settings (Global)

Access via **Settings → Life Tracker**.

Settings are grouped into tabs: **Property definitions**, **Visualizations**,
**Dates** and **About**.

### High Contrast

In the **Visualizations** tab, under **Accessibility**. Off by default.

Turn it on for maximum-visibility rendering: thick card and cell borders, strong
saturated chart and heatmap colors, nothing dimmed, and unmistakable focus
outlines. It overrides the color scheme chosen per view or per preset — that is
the point of the mode.

Custom value-to-color heatmap mappings are the one exception: those colors are
your own encoding of what each value means, so they are left untouched.

### First Day of the Week

In the **Dates** tab. Choose whether weeks start on **Monday** (default) or
**Sunday**. Affects weekly grouping, heatmap week columns, and the "this week" /
"last week" time frames. ISO week labels (`YYYY-Www` filenames, week numbers)
stay Monday-based.

### Filename Date Patterns

In the **Dates** tab. Out of the box, the plugin reads dates from filenames such
as `2026-07-30`, `2026-W31`, `2026-07`, `2026-Q3` and `2026`. If your notes are
named differently — `Journal 2026-07-30`, `20260730`, `30.07.2026` — add a
pattern so those notes still land on the right date.

Write patterns with placeholders:

| Placeholder   | Meaning                                             | Example      |
| ------------- | --------------------------------------------------- | ------------ |
| `{{date}}`    | Full ISO date, same as `{{year}}-{{month}}-{{day}}` | `2026-07-30` |
| `{{year}}`    | Four-digit year                                     | `2026`       |
| `{{month}}`   | Two-digit month                                     | `07`         |
| `{{day}}`     | Two-digit day of the month                          | `30`         |
| `{{week}}`    | ISO week number                                     | `31`         |
| `{{quarter}}` | Quarter, including the `Q`                          | `Q3`         |
| `*`           | Any text                                            |              |

Examples:

| Pattern                       | Matches                        |
| ----------------------------- | ------------------------------ |
| `Journal {{date}}`            | `Journal 2026-07-30`           |
| `{{year}}{{month}}{{day}}`    | `20260730`                     |
| `{{day}}.{{month}}.{{year}}`  | `30.07.2026`                   |
| `{{date}}*`                   | `2026-07-30 (Thursday)`        |
| `* {{year}}-W{{week}}`        | `Weekly review 2026-W31`       |
| `{{year}} {{quarter}} review` | `2026 Q3 review`               |
| `daily/{{date}}`              | `daily/2026-07-30.md`          |
| `*/daily/{{date}}`            | `personal/daily/2026-07-30.md` |

Good to know:

- The whole filename must match the pattern — use `*` for the parts that vary.
- A pattern containing `/` matches the note's **path**, not just its name, so
  `daily/{{date}}` only matches notes inside the `daily` folder. Use this when
  the same filename exists in several folders and only one of them holds your
  tracked notes.
- Matching ignores case, so `journal 2026-07-30` matches `Journal {{date}}` too.
- The time period is derived from the placeholders you use: a day (or
  `{{date}}`) means daily notes, `{{week}}` weekly, `{{quarter}}` quarterly,
  a month monthly, a year alone yearly.
- Patterns are tried top to bottom, before the built-in formats. The built-in
  formats always keep working, so nothing breaks if you add none.
- "Capture today" prefers a note matched by one of your own patterns over a
  note that only matched a built-in format, so a folder-scoped pattern reliably
  wins over an identically named note elsewhere.
- Every pattern shows either an example of what it matches or an explanation of
  what's wrong with it, right below the input.
- "Capture today" also uses your patterns to find today's note.

### Creating Missing Notes

In the **Dates** tab.

You skip a day. Life happens. The next time you run "Capture today", there's no
note to capture into, and the plugin just tells you so. Annoying, because the
one thing you wanted to do was record something for that day.

Turn on **Create missing notes when capturing** and the plugin offers to create
the note first, then opens capture on it.

It never invents a location for that note. That matters: a plugin that guesses
where your daily notes go will eventually guess wrong, and you'll find files
scattered in folders you never chose. Instead it reads the folder, the template
and the naming from a plugin you've already set up:

1. **Obsidian Starter Kit**. Pick which note type describes your daily notes in
   the dropdown that appears. The plugin then uses its folder, its template, its
   name prefix and suffix, and its mandatory tags. You get a proper note of that
   type, not an empty file in roughly the right place.
2. **Periodic Notes**. Its daily folder, date format and template.

If you have neither, nothing is created and the plugin says why.

A few things worth knowing:

- **It's off by default.** A plugin shouldn't start writing new files into your
  vault because you updated it.
- **You're always asked first**, and the confirmation shows you the exact path.
- **Nothing is ever overwritten.** If a note is already there, it's reused.
- **Templates go through Templater, exactly once.** If Templater is already set
  up to template new files itself, the plugin steps back and lets it. Applying a
  second template on top would duplicate the whole note.
- **No Templater? The note is still created**, and it still gets your captured
  values. Recording the data is the point.
- If the resulting filename is one the plugin can't read a date from, you're
  warned before anything is created. Such a note won't show up in your views.
  Adding a matching [filename date pattern](#filename-date-patterns) fixes it.

#### If your daily notes live in week folders

This one bites people, so it's worth spelling out.

Pair the **ISO week-numbering year** with the week number. In the Starter Kit
that's `{{isoyear}}/{{week}}`. In a Periodic Notes format it's `GGGG/WW`.

Use the calendar year instead (`{{year}}`, or `YYYY`) and a single week gets
split across two folders every New Year. 2024-12-30 is a Monday, and it belongs
to week 01 of **2025**. With the calendar year it lands in `2024/01`, far away
from the rest of its own week, and sorted before `2024/52` for good measure.

Same story for weekly note names. Use the ISO tokens `GGGG-[W]WW`, not the
locale ones `gggg-[W]ww`. Locale weeks start on Sunday, so every Sunday resolves
to the following week. That's not an edge case once a year. That's 52 times a
year.

### Animation Duration

In the **Visualizations** tab.

Control how long chart animations play (in milliseconds).

- **Default**: 3000ms
- **Range**: 0-10000ms
- **Tip**: Set to 0 to disable animations

### Visualization Presets

Auto-apply visualization settings based on property names.

| Field       | Description                                               |
| ----------- | --------------------------------------------------------- |
| Pattern     | Text to match against property names                      |
| Type        | Visualization type to apply                               |
| Scale       | Optional min/max range                                    |
| Color       | Optional color scheme                                     |
| Aggregation | Average (default) or Sum for line/bar/area/bubble/heatmap |

**Example**: Pattern `mood` with Heatmap type and 1-5 scale applies to all properties containing "mood" in the name.

**Override behavior**: Local per-view configurations always take precedence over presets.

### Property Definitions

Configure trackable properties for the capture command. See [Property Capture](property-capture.md) for details.

## Life Tracker View Options

Configured via the view's settings panel (gear icon).

| Option               | Default  | Description                                                                |
| -------------------- | -------- | -------------------------------------------------------------------------- |
| Granularity          | daily    | Time grouping (daily to yearly)                                            |
| Time frame           | all_time | Date range filter                                                          |
| Date anchor          | (auto)   | Property to use for date resolution                                        |
| Grid columns         | 3        | Number of columns (1-6)                                                    |
| Show legend          | true     | Display chart legends                                                      |
| Legend position      | right    | Where the legend sits on pie/doughnut/polar charts (top/right/bottom/left) |
| Show empty dates     | true     | Include dates with no data (rendered as gaps in charts, not zeros)         |
| Hide header controls | false    | Hide the time frame / overlay / columns toolbar for a compact view         |
| Cell size            | 12       | Heatmap cell size in pixels                                                |
| Show day labels      | true     | Day labels on heatmaps                                                     |
| Show month labels    | true     | Month labels on heatmaps                                                   |
| Show streak stats    | true     | Streak row below heatmaps                                                  |
| Show trend           | true     | Trend arrow and trend row on line/bar/area charts                          |
| Embedded height      | 400      | Height when embedded (pixels)                                              |

## Grid View Options

| Option     | Default  | Description                  |
| ---------- | -------- | ---------------------------- |
| Time frame | all_time | Date range filter for notes  |
| Hide notes | required | When to hide completed notes |

**Hide notes options**:

- `required`: Hide when required properties are filled
- `all`: Hide when all properties are filled
- `never`: Always show all notes

## Per-Visualization Config

Stored per view, per visualization. Access via right-click context menu.

| Setting         | Description                                                                      |
| --------------- | -------------------------------------------------------------------------------- |
| Type            | Visualization type                                                               |
| Scale           | Min/max range (auto or preset)                                                   |
| Color scheme    | Color palette; heatmaps add Viridis/Cividis and a custom value-to-color mapping  |
| Reference line  | Target line with value and label                                                 |
| Aggregation     | Average (default) or Sum — line, bar, area, radar, bubble charts, and heatmaps   |
| Moving average  | Off (default), 7, 14, or 30 periods — line and area charts only                  |
| Running total   | Off (default) or Enabled — plots the cumulative total; line and area charts only |
| X-axis          | Date (default) or Note name — one point per note; line, bar, and area charts     |
| Heatmap options | Cell size, day/month labels (heatmap only)                                       |

Aggregation also applies to overlay charts (set in the overlay's own config,
where it is shared across all of the overlay's properties — see [Overlay Config](#overlay-config)).

## Overlay Config

Stored per view. Access via overlay card context menu.

| Setting                        | Description                                          |
| ------------------------------ | ---------------------------------------------------- |
| Display name                   | User-defined overlay name                            |
| Chart type                     | Line, Bar, or Area                                   |
| Properties                     | Array of property IDs (minimum 2)                    |
| Scale                          | Shared Y-axis min/max                                |
| Color scheme                   | Color palette                                        |
| Reference lines                | Per-property target lines                            |
| Aggregation                    | Average (default) or Sum — applied to all properties |
| Hide individual visualizations | Hide separate cards for overlay props                |

## Scale Presets

Available for numeric visualizations:

| Preset | Range    |
| ------ | -------- |
| Auto   | Dynamic  |
| 0-1    | 0 to 1   |
| 0-5    | 0 to 5   |
| 1-5    | 1 to 5   |
| 0-10   | 0 to 10  |
| 1-10   | 1 to 10  |
| 0-100  | 0 to 100 |

## Color Schemes

Available for all chart types except Tag Cloud:

- `green` (default)
- `blue`
- `purple`
- `orange`
- `red`
- `colorblind` — eight colors that stay distinguishable with any common form of
  color vision deficiency

Heatmaps use their own list: `auto` (the default — follows the property's value
direction), the five schemes above, plus `viridis` and `cividis`
(colorblind-friendly gradients), plus a **custom mapping** that assigns a color to
each specific value. A custom mapping is stored inline on the card rather than as
a name, and takes precedence over the view-wide **Color scheme** setting.

## Date Anchor Resolution

Priority order for determining entry dates:

1. **Filename pattern**: your [custom patterns](#filename-date-patterns) first, then the built-in YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY
2. **Date anchor property**: Configured in view settings
3. **File metadata**: ctime or mtime

## Configuration Priority

For visualization settings:

1. **Per-view column config**: Highest priority
2. **Global preset**: Applied if no local config exists
3. **Default/unconfigured**: Shows selection card
