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

**Color schemes**: Green, Blue, Purple, Orange, Red

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

## Moving Average

For line and area charts, enable a moving average from the card's right-click menu (7, 14, or 30 periods). It renders as a thin dashed line in the chart's color, smoothing noisy daily metrics like mood, weight, or steps. Each point is the mean of the recorded values in the trailing window — missing periods are skipped, not counted as 0.

## Trend Indicator

Single-dataset line, bar, and area charts show a small ↑ / ↓ / → arrow next to the card title, plus a trend row below the chart (e.g. `Trend: ↑ +12.3% · vs previous 7 periods`), comparing the average of the most recent periods (up to 7) against the previous ones. Hover the arrow for the same detail. The display stays neutral in color, since whether "up" is good depends on what you track. Toggle it with the **Show trend** view option.

## Exporting

Right-click any visualization card (long-press on mobile) to export it:

- **Export image**: saves a PNG of the chart in its current state. Available for chart types (line, bar, area, pie, doughnut, radar, polar area, scatter, bubble).
- **Export CSV**: saves the data exactly as displayed — chart periods and values, heatmap dates/values/entry counts, tag frequencies, or timeline points.

Files are saved to your vault's attachment folder, and a notice shows the exact path.
