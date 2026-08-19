---
title: Visualizations
nav_order: 12
---

# Visualizations

Life Tracker supports 12 visualization types, each suited for different kinds of data.

## Cartesian Charts

These charts plot data over time with X and Y axes.

### Line Chart

Best for: Tracking trends over time

- Shows data points connected by lines
- Ideal for continuous numeric data
- Supports multiple datasets (overlays)
- Good for: mood tracking, weight, temperature

### Bar Chart

Best for: Comparing discrete values

- Vertical bars for each time period
- Good for counts and totals
- Supports multiple datasets (overlays)
- Good for: exercise duration, calories, steps

### Area Chart

Best for: Showing volume over time

- Filled area under the line
- Emphasizes magnitude of change
- Supports multiple datasets (overlays)
- Good for: sleep hours, screen time, reading time

### Scatter Chart

Best for: Showing distribution

- Individual points without connections
- Plotted against a real date axis, so points sit at their actual position in time and the tooltip shows the exact date
- Good for sparse or irregular data
- Shows data density patterns
- Good for: irregular measurements, event occurrences

### Bubble Chart

Best for: Multi-dimensional data

- Points with variable size
- Size represents a third dimension
- Good for: data with magnitude variations
- Hovering a bubble shows the value and the exact number of entries in that period

Chart tooltips show whole-number values without trailing decimals, so counts like habit completions read as `3` rather than `3.00`.

## Circular Charts

These charts show proportions and distributions.

**Colors match the heatmap**: when the segments are numeric values (a 1-5 mood, a rating), pie, doughnut, and polar area charts color each segment with the same value → color scale a heatmap of that property uses — the view-wide heatmap color scheme, or the default derived from the property's value direction — so the same value looks the same in both visualizations. Picking an explicit color scheme on the chart card overrides this, and non-numeric values (categories, tags) keep the regular chart palette.

### Pie Chart

Best for: Part-to-whole relationships

- Circular chart divided into slices
- Shows percentage of total
- Best with 2-6 categories
- Good for: time allocation, category distribution

### Doughnut Chart

Best for: Part-to-whole with emphasis

- Pie chart with hollow center
- Center can show total or label
- More modern appearance
- Good for: budget breakdown, task categories

### Polar Area Chart

Best for: Comparing magnitudes

- Like pie but segments have equal angles
- Radius shows magnitude
- Good for comparing values across categories
- Good for: ratings, scores, performance metrics

### Radar Chart

Best for: Multi-variable comparison

- Spider/web chart pattern
- Each axis represents a variable
- Shows balance across dimensions
- Good for: skill assessments, balanced scorecards

## Specialized Visualizations

### Heatmap

Best for: Daily patterns over time

- GitHub-style contribution graph
- Color intensity shows value magnitude
- Shows gaps and streaks clearly
- Good for: habit tracking, daily ratings, streaks

**Color schemes**: Green, Blue, Purple, Orange, Red, plus **Viridis** and **Cividis** — two colorblind-friendly gradients that also stay readable in grayscale.

**Custom color mapping**: for scales where each value means something specific (mood 1-5, energy levels, a rating), a single-hue gradient makes 2 and 3 nearly indistinguishable. Right-click the card, set **Colors** to **Custom mapping…**, and give each value its own color. A new mapping starts with values 1-5 on a colorblind-friendly ramp, so it is usable straight away. Values you have not mapped use the **fallback color**, and the legend lists one labelled swatch per entry instead of the "Less → More" ramp. The mapping belongs to that card, so two heatmaps of the same property can be colored differently.

**Aggregation**: when several notes fall in the same cell period, their values are combined by **Average** (default) or **Sum**. Use Sum for counter-style tracking like calories or sessions per day. Set it from the card's right-click menu.

**Streak stats**: a compact row below the legend shows your current streak, best streak, and total active periods. A period counts toward a streak when it has a recorded value other than 0 (matching the heatmap rendering, where 0 on a 0-based scale shows as empty). The current streak still counts if today's data isn't captured yet. Toggle the row with the **Show streak stats** view option.

### Tag Cloud

Best for: Text/tag frequency

- Words sized by frequency
- Shows most common values
- Great for tags and categories
- Good for: tags, activities, locations

### Timeline

Best for: Event sequences

- Events plotted on a time axis
- Shows when things happened
- Good for sparse events
- Good for: milestones, achievements, events

### Progress Ring

Best for: Goals you either hit or miss

- Circular progress toward a target for the period you are **currently in**
- Green when met, yellow when most of the way there, red when behind
- The hit rate and your current/best streak sit below the ring, with a strip of
  bars for the last 26 periods
- Good for: "3 days a week", "150 reps a week", "10 000 steps a day", "at most
  80 kg"

A progress ring needs a target — see [Goals and Targets](#goals-and-targets)
below. Until one is set, the card shows a prompt instead of a chart.

## List Property Support

For properties containing arrays/lists (like tags):

**Circular charts** (Pie, Doughnut, Polar Area):

- Count occurrences of each unique value
- Show distribution across all entries

**Cartesian charts** (Line, Bar, Area, Radar):

- Create one dataset per unique value
- Show 0/1 presence per time period
- Legend identifies each value

## Scale Configuration

For numeric visualizations, configure the Y-axis scale:

| Preset | Range    | Use Case                  |
| ------ | -------- | ------------------------- |
| Auto   | Dynamic  | Let the chart determine   |
| 0-1    | 0 to 1   | Percentages, ratios       |
| 0-5    | 0 to 5   | 5-point scales            |
| 1-5    | 1 to 5   | Rating scales (no zero)   |
| 0-10   | 0 to 10  | 10-point scales           |
| 1-10   | 1 to 10  | Rating scales (no zero)   |
| 0-100  | 0 to 100 | Percentages, large ranges |

## Color Schemes

Available for all chart types (except Tag Cloud):

- **Green**: Default, nature-inspired
- **Blue**: Cool, calming
- **Purple**: Creative, premium
- **Orange**: Warm, energetic
- **Red**: Bold, attention-grabbing
- **Colorblind-friendly**: eight colors chosen to stay distinguishable with any
  common form of color vision deficiency — use it whenever a chart shows several
  series at once, since the other schemes vary only in lightness

Heatmaps have their own list instead: the five schemes above plus **Viridis** and
**Cividis** (both colorblind-friendly), and **Custom mapping…** for exact
value-to-color control. See [Heatmap](#heatmap).

## Reference Lines

For cartesian charts only (Line, Bar, Area):

- Add horizontal lines at target values
- Useful for goals and thresholds
- Custom labels (defaults to "Target: {value}")
- Color matches the dataset

Example uses:

- Weight goal line
- Minimum sleep target
- Exercise duration target

## Goals and Targets

Set a goal on any card through the right-click menu → **Configure target**. A
target reads as one sentence:

> _\<measure\>_ per _\<period\>_ must be _\<at least / at most\>_ _\<value\>_

| Measure               | Meaning                  | Example goal                 |
| --------------------- | ------------------------ | ---------------------------- |
| Entries with a value  | Days you actually did it | "Push-ups on 3 days a week"  |
| Total of the values   | Volume added up          | "150 squats a week"          |
| Average of the values | Mean over the period     | "Average mood of at least 7" |
| Most recent value     | The last reading         | "At most 80 kg"              |

Days logged as `0` do not count toward "entries with a value" — writing
`push_ups: 0` records that you did **not** do it, so a "3 days a week" goal is
not satisfied by logging zeros every day.

Targets belong to a visualization, not to a property, so one property can carry
two goals side by side: a consistency ring (days a week) and a volume ring (reps
a week). The goal appears in the card title so the two stay distinguishable.

Supported by the progress ring and by Line, Bar and Area charts, which draw the
target as a horizontal reference line. An explicitly configured reference line
takes precedence over the target's.

### Periods with nothing recorded

For "entries with a value" and "total of the values", an empty period is a real
zero: doing nothing all week genuinely is 0 days and 0 reps, and the ring turns
red.

For "average" and "most recent value" it is _unknown_ instead. A week you forgot
to weigh yourself shows a grey ring and a dash — not a weight of 0 kg, which
would otherwise satisfy an "at most 80 kg" goal every time you skipped the
scale. Those periods are left out of the hit rate as well.

## Moving Average

For line and area charts, enable a moving average from the card's right-click menu (7, 14, or 30 periods). It renders as a thin dashed line in the chart's color, smoothing noisy daily metrics like mood, weight, or steps. Each point is the mean of the recorded values in the trailing window — missing periods are skipped, not counted as 0.

## Running Total

For line and area charts, switch **Running total** to **Enabled** in the card's right-click menu to plot the cumulative total instead of the per-period value. A `pages_read` of 20, 15, then 30 is drawn as 20 → 35 → 65, so you can see progress toward a long-term goal instead of session-by-session values. It works for any numeric property: pages read, distance covered, money saved, tasks completed.

A few details worth knowing:

- Values recorded in the same period are combined by the **Aggregation** setting first, then the periods accumulate. "Sum" is usually what you want here.
- The total starts from zero at the left edge of the visible range, so a time frame like **Last 30 days** totals just that month rather than carrying in earlier history.
- A note that exists but records no value holds the line flat rather than breaking it, since your total has not changed. Periods with no note at all are not plotted — they are not part of the chart either way, with or without a running total.
- The legend and CSV export label the series `(running total)`, since it no longer shows the raw property value.
- A reference line now reads as a target total, which is handy for goals like "500 pages this year".
- The trend arrow keeps describing your per-period rate, not the total, and the trend row is labeled **Per-period trend** to make that explicit. A cumulative line always climbs when the values are positive, so a trend taken from it would only restate that; "steady 10 a day" reports as flat, which is what you want to know. A ↓ next to a rising total is not a contradiction: your total grew, but by less than in the previous periods.
- Clicking a point opens a note from that period, not from everything the total has accumulated so far.
- Only numeric properties get this option. List-valued properties are charted as one line per value, which has no total to accumulate.

## Trend Indicator

Single-dataset line, bar, and area charts show a small ↑ / ↓ / → arrow next to the card title, plus a trend row below the chart (e.g. `Trend: ↑ +12.3% · vs previous 7 periods`), comparing the average of the most recent periods (up to 7) against the previous ones. Hover the arrow for the same detail. The display stays neutral in color, since whether "up" is good depends on what you track. Toggle it with the **Show trend** view option.

## Exporting

Right-click any visualization card (long-press on mobile) to export it:

- **Export image**: saves a PNG of the chart in its current state. Available for chart types (line, bar, area, pie, doughnut, radar, polar area, scatter, bubble).
- **Export CSV**: saves the data exactly as displayed — chart periods and values, heatmap dates/values/entry counts, tag frequencies, or timeline points.

Files are saved to your vault's attachment folder, and a notice shows the exact path.
