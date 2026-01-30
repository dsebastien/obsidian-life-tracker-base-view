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
- Good for sparse or irregular data
- Shows data density patterns
- Good for: irregular measurements, event occurrences

### Bubble Chart

Best for: Multi-dimensional data

- Points with variable size
- Size represents a third dimension
- Good for: data with magnitude variations

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
