# Overlay Charts

Overlay charts combine multiple properties on a single visualization, making it easy to spot correlations and patterns.

## Creating an Overlay

1. Click **Create overlay** in the view controls
2. Select 2 or more properties from the list
3. Choose a name for the overlay (e.g., "Sleep vs Mood")
4. Select a chart type (Line, Bar, or Area)
5. Click **Create**

The overlay appears as a new card in your grid.

## Supported Chart Types

Only cartesian charts support overlays:

- **Line Chart**: Best for comparing trends
- **Bar Chart**: Best for comparing values
- **Area Chart**: Best for comparing volume

## Editing an Overlay

Right-click the overlay card and select **Edit overlay** to:

- Change the display name
- Switch chart type
- Add or remove properties
- Configure reference lines per property
- Toggle individual visualization hiding

## Hide Individual Visualizations

When you combine properties into an overlay, you may want to hide their separate cards to reduce visual clutter.

In the overlay edit modal:

1. Enable **Hide individual visualizations**
2. The separate cards for each property in the overlay will be hidden
3. Only the combined overlay chart is shown

**Note**: If a property is in multiple overlays, it's hidden if ANY overlay has this option enabled.

## Reference Lines in Overlays

Each property in an overlay can have its own reference line:

1. Edit the overlay
2. In the **Reference lines** section, toggle each property
3. Enter target values for enabled properties
4. Lines are color-coded to match each property's dataset

## Legend

Overlay charts always show a legend to identify each property's line/bar/area. The legend uses the property display names.

## Data Requirements

- All properties must have compatible numeric data
- Data is aligned by time period based on the view's granularity
- Missing data points show gaps in the visualization

## Use Cases

### Health Correlations

Combine sleep, mood, and energy to see how they relate:

- **Properties**: sleep_hours, mood, energy_level
- **Chart type**: Line
- **Insight**: See if poor sleep affects next-day mood

### Exercise Impact

Track exercise against recovery metrics:

- **Properties**: exercise_duration, soreness, recovery_score
- **Chart type**: Area
- **Insight**: Find optimal exercise frequency

### Habit Stacking

Monitor related habits together:

- **Properties**: meditation_minutes, journal_completed, water_intake
- **Chart type**: Bar
- **Insight**: See which habits you're consistent with

### Work-Life Balance

Compare work and personal metrics:

- **Properties**: work_hours, personal_time, stress_level
- **Chart type**: Line
- **Insight**: Identify when work impacts personal life

## Tips

- **Start with 2-3 properties**: Too many lines become hard to read
- **Use similar scales**: Properties with vastly different ranges may need separate overlays
- **Consider color schemes**: Choose schemes where colors are easy to distinguish
- **Name overlays descriptively**: Makes it easy to understand at a glance
- **Hide individuals when focused**: Use the hide option when you only care about correlations
