### Charts that stay readable on real data

My running Base has about 170 session notes, and its pace card was unreadable.
One mistyped value (49997 seconds) set the scale to 0 to 50,000, so every real
run sat in a flat line at the bottom. 170 point markers overlapped. Every label
on the axis was a long, rotated note name like `2025-06-24 (Running Session)`.
And my pace read 387 instead of 6:27.

This release fixes each of those. Three changes apply to your charts on their
own: outliers no longer set the scale, note-name labels get shorter, and dense
lines drop their point markers. The rest is opt-in from the card's right-click
menu.

### Durations read as times

New **Value format** setting in the card's right-click menu:

- **Duration: seconds as m:ss**: a pace of 387 reads `6:27`. From one hour on,
  you get `h:mm:ss` (3725 reads `1:02:05`).
- **Duration: minutes as h:mm**: 95 minutes of sleep reads `1:35`.

The format shows everywhere the card shows a value: axis ticks (on round times
such as 5:00, 5:30, 6:00), tooltips, the moving average, reference line and
target labels, the record chip ("Record: 5:12"), heatmap tooltips and progress
ring amounts. On line and area charts, a duration axis fits your data instead
of starting at zero, so a pace between 5:00 and 7:00 fills the chart.

It's offered on heatmap, line, bar, area, scatter, bubble and progress cards,
and on overlays (in the overlay editor). It's saved in the `.base` file as
`valueFormat: duration-mm-ss` or `valueFormat: duration-h-mm`.

### One bad value no longer sets the scale

Line, bar and area charts with an **Auto-detect** scale now fit their axis to
the bulk of your data. A value far outside it is drawn at the edge, with a small
triangle (pointing up for a value above, down for a value below). Hover it to
see the real value, marked "outside the scale". Click it to open the note and
fix the typo.

"Far" means more than three interquartile ranges beyond the middle half of the
values, checked from 8 values on. Ordinary highs and lows stay on the scale.

Want the full range back? Set **Outliers** to **Show all values** in the card's
right-click menu or in the overlay editor (`outliers: show-all` in the `.base`
file). A preset or custom scale always wins.

### Date, one point per note

New choice under **X-axis** for line, bar and area charts: **Date, one point
per note** (`xAxisSource: date-per-note`). Every note sits at its own date, on
an axis where distance is time. Nothing is grouped: two runs on one day are two
points, and a three-week break shows as a three-week gap. Date labels are
short, horizontal, and never overlap.

- Notes without a date can't be placed. The card says how many were left out
  ("3 notes without a date").
- Two notes from the same day sit side by side within that day, so you can
  hover and open each one.
- The tooltip shows the date and the note name.
- Bar charts get bars 3 to 16 pixels wide.
- The moving average and the trend follow your notes in date order.
- Export CSV writes one row per note: its date, its full name, then the value.

### Shorter labels, fewer markers, a clearer average

- **Note name** axis: labels leave off a trailing type suffix
  (`2025-06-24 (Running Session)` reads `2025-06-24`) and are thinned out
  instead of overlapping. The tooltip keeps the full name.
- Line and area charts with more than 40 points draw just the line, without
  point markers (the limit was 500). The point under your cursor still shows,
  with its tooltip.
- With a **moving average** on, the average becomes the main line: solid,
  thicker, on top, and first in the legend and tooltip. Your raw values stay
  visible as a thin, faded line behind it. On the per-note axes it's a "7-note
  average".

### Card titles

Several cards on one property (a "Run days" heatmap, a progress ring, a
"Distance per run (km)" chart) all showed the same name. Now you can right-click
a card, choose **Card title…**, type a title and select **Apply**. Leave it
empty to show the property name again. A card without a title keeps showing
the property's current name, as before.

The title shows in maximized mode and names your exports, and a progress ring
still adds its goal after it ("Run days · ≥ 3/week"). It's saved as `title` on
the card in the `.base` file.

### Fixes

- On the **Note name** axis, the trend row compares notes: "vs previous 7
  notes", not "periods".
- Edits to an overlay (value format, outliers, aggregation, reference lines)
  show as soon as you save, without reopening the Base.
- With a running total on the **Note name** axis, the cumulative target line
  isn't drawn anymore: that axis has no time, so the line had no honest slope.

### Good to know

- Export CSV keeps the raw numbers (387, not 6:27), so a spreadsheet can still
  compute with them. Values drawn at the edge of the axis are exported with
  their real value.
- Every card has a `displayName` in the `.base` file, written automatically.
  It isn't shown as the card's title. To name a card, use **Card title…**.
- On the **Date, one point per note** axis, the tooltip shows the point
  nearest to your cursor.
- Two known limits: a series that is nearly always the same value (10, 10, 10
  and one 1000) still gets the full axis (#187), and an open Base can write its
  old settings over a hand edit of the `.base` file, so close it before you
  edit the file (#189).
