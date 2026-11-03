### Lines stop at gaps in your data

On line and area charts with a date axis (**Date**, or **Date, one point per
note**), the line now stops when two points are far apart in time. Before,
a break from December to March drew a long straight line, and a moving average
drew a flat stretch that looked like a stable trend.

"Far apart" means more than three times the usual time between your points,
and at least 14 days. For daily data, a break of more than two weeks stops the
line. For monthly data, a break of more than about three months does.

- The raw line, the area below it, and the moving average all stop at the gap.
- The moving average starts again after the gap. It never mixes values from
  before and after the break.
- This is on by default, also for your existing cards. To keep one continuous
  line, set **Break line across gaps** to **Off** in the card's right-click
  menu (`breakLineAcrossGaps: false` in the `.base` file).
- The **Note name** axis has no dates, so its line never breaks.
- Overlay charts keep one continuous line for now, and the two new switches
  are not in the overlay editor.

### Leave outliers out of the average

New switch in the card's right-click menu, next to **Outliers**: **Leave
outliers out of the average**. It is off by default.

When it is on, the moving average and the trend ignore the far-off values (the
same values the fitted scale leaves out). One bad entry, such as a
treadmill run with a pace of 49997 seconds per kilometer, no longer pulls the
average off the chart for a whole window. The far-off points stay on the chart,
and records and CSV export still use them.

It is offered on line, bar and area cards (`excludeOutliersFromAverage: true`
in the `.base` file).

### Outliers in series that barely change

Outlier detection skipped a series when most of its values were the same. A
meditation log of 10 minutes nearly every day, plus one typo of 1000, still got
a 0 to 1000 axis. Now, when the middle half of the values has no spread, a value
more than 10 times the usual value counts as an outlier. It still needs at
least 8 values. Low values never count: a missed day or a short session is real
data.

Checkbox properties, and any series with only 0s and 1s, never have outliers. A
yes/no habit is drawn and averaged exactly as you logged it.

### Edits to the .base file are kept

When a Life Tracker view was open and you edited its `.base` file (for example,
you added `timeFrame: last-365-days`), the view kept its old settings and could
later write them back over your edit. Now the view reads its time frame and
number of columns from the file every time it redraws, and it saves a value
only when you change it in the view's toolbar, and only that value.
