# Usage

## Setting Up a Life Tracker View

### Create a Base

1. Create a new Base in your vault (or use an existing one)
2. Add property columns for the data you want to track
3. Ensure your notes have frontmatter properties matching these columns

### Switch to Life Tracker View

1. Open your Base
2. Click the view selector (dropdown)
3. Choose **Life Tracker**
4. The view displays a grid of visualization cards

### Configure Visualizations

Each property appears as a card. Unconfigured properties show a selection interface:

1. Click on an unconfigured card
2. Choose a visualization type from the grid
3. The visualization renders with your data

## View Controls

### Time Granularity

Control how data is grouped over time:

- **Daily**: One data point per day
- **Weekly**: Aggregated by week
- **Monthly**: Aggregated by month
- **Quarterly**: Aggregated by quarter
- **Yearly**: Aggregated by year

### Time Frame

Filter visualizations to show specific date ranges:

| Time Frame    | Description        |
| ------------- | ------------------ |
| All time      | All available data |
| Last 7 days   | Previous 7 days    |
| Last 30 days  | Previous 30 days   |
| Last 90 days  | Previous 90 days   |
| Last 365 days | Previous year      |
| This week     | Current week       |
| This month    | Current month      |
| This quarter  | Current quarter    |
| This year     | Current year       |
| Last week     | Previous week      |
| Last month    | Previous month     |
| Last quarter  | Previous quarter   |
| Last year     | Previous year      |

### Grid Layout

Adjust the number of columns (1-6) to control card density.

### Animation Controls

- **Play/Pause**: Control chart animations
- **Duration**: Set in plugin settings (default: 3000ms)

## Context Menu

Right-click any visualization card to access:

- **Change visualization**: Switch to a different chart type
- **Configure scale**: Set min/max values (auto-detect or presets)
- **Configure color scheme**: Choose from 5 color palettes
- **Reference line**: Add a horizontal target line
- **Add visualization**: Create another visualization for the same property
- **Remove visualization**: Delete this visualization (if multiple exist)
- **Maximize**: Expand to full view
- **Reset**: Clear configuration and return to selection

## Maximize Mode

Click the maximize icon or use the context menu to expand any visualization:

- View details in full screen
- Press **Escape** to exit
- All other cards are hidden while maximized

## Interactivity

### Click to Navigate

Click on chart elements (bars, points, areas) to open the source note for that data point.

### Tooltips

Hover over chart elements to see detailed information:

- Property name and value
- Date of the data point
- Source file name

## Date Anchoring

The plugin determines dates for entries using this priority:

1. **Filename pattern**: YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq
2. **Date anchor property**: Configured in view settings
3. **File metadata**: Creation or modification time

## Multiple Visualizations

You can add multiple visualization cards for the same property:

1. Right-click an existing visualization
2. Select **Add visualization**
3. A new card appears with copied settings
4. Configure each card independently

This lets you compare different views of the same data (e.g., heatmap vs line chart).
