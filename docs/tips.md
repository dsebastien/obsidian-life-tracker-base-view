# Tips and Best Practices

## Data Organization

### Consistent Property Names

Use consistent naming across your vault:

- Good: `mood`, `energy_level`, `sleep_hours`
- Avoid: `Mood`, `energy`, `sleepHours` (mixing styles)

### Use Presets for Common Properties

If you track the same properties across multiple Bases:

1. Create visualization presets in settings
2. Use consistent property names
3. Visualizations auto-configure when you add columns

### Date-Based File Names

For best date resolution, name files with dates:

- Daily notes: `2024-01-15.md`
- Weekly notes: `2024-W03.md`
- Monthly notes: `2024-01.md`

## Visualization Selection

### Choose the Right Chart

| Data Type               | Recommended          |
| ----------------------- | -------------------- |
| Daily ratings (1-5)     | Heatmap              |
| Continuous measurements | Line chart           |
| Duration/counts         | Bar chart            |
| Habits (yes/no)         | Heatmap              |
| Tags/categories         | Tag cloud, Pie chart |
| Multi-property trends   | Overlay (Line)       |
| Distribution            | Pie, Doughnut        |

### Heatmap for Streaks

Heatmaps excel at showing:

- Consistency (no gaps)
- Streaks (consecutive days)
- Patterns (weekday vs weekend)

### Overlays for Correlations

Use overlays when you want to answer:

- Does X affect Y?
- Are these metrics related?
- When do patterns align?

## Performance

### Large Vaults

For vaults with many notes:

- Use time frame filters to limit data
- Start with monthly/quarterly granularity
- Add specific date ranges as needed

### Many Visualizations

If you have many properties:

- Increase grid columns for better overview
- Use maximize mode for detailed analysis
- Consider hiding individual cards via overlay option

## Workflow Tips

### Morning Review

1. Open your Life Tracker view
2. Set time frame to "This week"
3. Scan heatmaps for gaps
4. Use capture command to fill missing data

### Weekly Review

1. Set time frame to "Last week"
2. Review trends and patterns
3. Look at overlays for correlations
4. Note insights in a weekly review note

### Data Entry Routine

1. Open yesterday's note (or today's)
2. Run capture command
3. Fill properties in order
4. Let auto-save handle persistence

## Troubleshooting

### Visualizations Not Showing Data

Check:

1. Properties have values in frontmatter
2. Date anchoring is working (check filename or property)
3. Time frame includes the dates with data
4. Property column exists in the Base

### Wrong Dates

If data appears on wrong dates:

1. Check filename date format
2. Configure date anchor property in view settings
3. Ensure consistent date formats across notes

### Empty Heatmap

If heatmap shows all empty:

1. Verify property has numeric values
2. Check scale settings (auto-detect vs preset)
3. Ensure dates fall within view time frame

### Overlay Not Showing All Properties

If some properties are missing from overlay:

1. Ensure all properties have data in the time range
2. Check that properties exist in the Base
3. Verify property IDs haven't changed

## Advanced Usage

### Multiple Views per Base

Create multiple Life Tracker views for different purposes:

- Dashboard view: All properties, 3 columns
- Focus view: Specific properties, maximized
- Correlation view: Just overlays

### Embedded Views

Embed Life Tracker views in notes:

1. Create a Base with your tracking data
2. Set up Life Tracker view
3. Use Obsidian's embed syntax to include in other notes

### Property Definitions as Templates

Use property definitions to:

- Standardize tracking across the vault
- Set sensible defaults
- Limit input to valid values (constraints)
