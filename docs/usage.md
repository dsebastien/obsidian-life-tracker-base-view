---
title: Usage
nav_order: 2
---

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

### Reorder Cards

By default, cards appear in the order defined by your Base's property list, with overlay charts at the end.

To customize the order:

1. Hover over a card — a small grip handle (⋮⋮) appears in the top-left corner
2. Drag the handle to move the card to a new position
3. The new order is saved automatically for the current view

Both property cards and overlay cards can be reordered, so you can place overlays before, between, or after individual property cards. Drag-and-drop works on both desktop (mouse) and mobile (touch).

When a custom order is in effect, a **Reset order** button appears in the controls bar. Click it to revert to the default order. New properties or overlays added later automatically appear at the end of your custom order, so they're never lost.

**Note**: The custom order is saved per view. Different Bases — and different views inside the same Base — keep their own orderings independently.

### Pin Favorite Cards

Click the star in a card's top-right corner to pin it. Pinned cards move to the
top of the grid and stay there whatever the rest of the order is, so your most
important metrics are always the first thing you see. Click the star again to
release it — property cards also offer **Pin to top** / **Unpin** in their
right-click menu.

Property cards and overlay cards can both be pinned, several at a time — pinned
cards keep their relative order. Pins are saved per view, like the custom order.

When a property has several visualizations, they are pinned together: those
cards always render side by side, so the pin applies to the property.

Cards that aren't showing a visualization yet — an unconfigured property, or one
with no data in the selected time frame — have no star; configure them (or
right-click a configured one) to pin.

### On Mobile

There is no hover on a touch screen, so tapping a chart point or a heatmap cell
only _inspects_ it: the tooltip appears and nothing else happens. Tap the same
point or cell again to open the note behind it. Heatmap tooltips say "Tap again
to open" while that second tap is expected.

With a mouse, a single click still opens the note straight away.

### Animation Controls

- **Play/Pause**: Control chart animations
- **Duration**: Set in plugin settings (default: 3000ms)

## Context Menu

Right-click any visualization card to access:

- **Change visualization**: Switch to a different chart type
- **Configure scale**: Set min/max values (auto-detect or presets)
- **Configure color scheme**: Choose a color palette; heatmaps also offer colorblind-friendly gradients and a custom value-to-color mapping
- **Configure target**: Set a goal for this property (see Goals and Targets below)
- **Reference line**: Add a horizontal target line
- **Add visualization**: Create another visualization for the same property
- **Remove visualization**: Delete this visualization (if multiple exist)
- **Maximize**: Expand to full view
- **Reset**: Clear configuration and return to selection

## Goals and Targets

Set a goal on any card through the context menu → **Configure target**. A target
reads as one sentence:

> _\<measure\>_ per _\<period\>_ must be _\<at least / at most\>_ _\<value\>_

| Measure               | Meaning                  | Example goal                 |
| --------------------- | ------------------------ | ---------------------------- |
| Entries with a value  | Days you actually did it | "Push-ups on 3 days a week"  |
| Total of the values   | Volume added up          | "150 squats a week"          |
| Average of the values | Mean over the period     | "Average mood of at least 7" |
| Most recent value     | The last reading         | "At most 80 kg"              |

Days you logged as `0` do not count toward "entries with a value" — writing
`push_ups: 0` records that you did not do it.

Targets are per visualization, so one property can carry two goals at once: a
consistency ring (days a week) and a volume ring (reps a week) side by side.

Line, bar and area charts draw the target as a horizontal reference line.

### Progress Ring

Pick **Progress ring** as the visualization type to see a goal as a circle:

- The ring is the period you are **currently in** — this week, not an average of
  the whole range. It is the only number you can still act on.
- Green means met, yellow means most of the way there, red means behind.
- Underneath: how many periods met the target across the selected range, and a
  strip of bars showing the last twelve periods.
- A week where nothing was logged shows as zero, not as the last week with data.

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

1. **Filename pattern**: YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY — plus any custom patterns you add
2. **Date anchor property**: Configured in view settings
3. **File metadata**: Creation or modification time

If your notes use another naming convention (`Journal 2026-07-30`, `20260730`,
`30.07.2026`, …), add a filename date pattern in **Settings → Life Tracker →
Dates**. See [Filename date patterns](configuration.md#filename-date-patterns).

## Multiple Visualizations

You can add multiple visualization cards for the same property:

1. Right-click an existing visualization
2. Select **Add visualization**
3. A new card appears with copied settings
4. Configure each card independently

This lets you compare different views of the same data (e.g., heatmap vs line chart).
