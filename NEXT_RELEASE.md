### Lines stop at gaps in your data

Take a running pace card with no runs from December to February. The chart
used to draw one straight line across the whole winter, and a moving average
turned it into a flat stretch.

Now, line and area charts on a date axis (**Date**, or **Date, one point per
note**) stop the line when two points are further apart than 3 times the usual
spacing, or 14 days, whichever is longer. For daily data, that's a break of more
than two weeks.

- The line, the area below it and the moving average all stop at the gap. The
  average starts again after it, and never mixes values from both sides.
- It's on by default, for your existing cards too. To keep one continuous line,
  set **Break line across gaps** to **Off** in the card's right-click menu
  (`breakLineAcrossGaps: false` in the `.base` file).
- Overlays keep one continuous line for now, and the overlay editor doesn't
  have the two new switches.

### Leave outliers out of the average

One bad entry (a treadmill run logged at 49997 seconds per kilometer) could
drag the moving average off the chart for a whole window. New switch in the
card's right-click menu, next to **Outliers**: **Leave outliers out of the
average** (`excludeOutliersFromAverage: true`). It's off by default.

When it's on, the moving average and the trend ignore the outliers. They stay
on the chart (as triangles at the edge on a fitted scale), and records and CSV
export still use them. Line, bar and area cards have it.

### Outliers when most values are the same

Meditation minutes of 10, 10, 10 … plus one typo of 1000 still got a 0 to 1000
axis. Now, when most values are equal, a value more than 10 times the usual one
counts as an outlier. Only high values count: a missed day is real data.

Checkbox properties, and any series of only 0s and 1s, never have outliers. A
yes/no habit is drawn exactly as you logged it.

### Edits to the .base file stick

If you edited a `.base` file while its Life Tracker view was open (say, adding
`timeFrame: last-365-days`), the view could later write its old settings back
over your edit. Now it re-reads its time frame and number of columns on every
redraw, and saves a setting only when you change it in the view's toolbar (and
only that one).
