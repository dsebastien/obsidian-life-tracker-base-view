---
title: Property capture
nav_order: 11
---

# Property Capture

The Property Capture feature provides a streamlined interface for entering data into your notes.

## Property Definitions

Before capturing data, define which properties to track:

1. Open **Settings → Life Tracker → Property definitions**
2. Click **Add definition**
3. Configure each property:

| Field       | Description                                        |
| ----------- | -------------------------------------------------- |
| Name        | Frontmatter property key                           |
| Type        | text, number, checkbox, date, datetime, list, tags |
| Default     | Pre-filled value for new entries                   |
| Constraints | Min/max/step for numbers, allowed values for text  |
| Note filter | Folder, tag, or regex pattern to limit scope       |

For **number** properties you can set a **min**, **max**, and optional **step**. The step controls the slider granularity (e.g. `1` for whole-number scores, `0.5` for half points); leave it empty to allow fine decimal values. If you fill in only one bound, the other is inferred automatically (min → `max = min + 100`, max → `min = 0`) and the inferred value is shown so there's no silent guessing.

### Value mapping (text properties)

Text properties can map their values to numbers so they can be charted. Add a
value mapping under a text property definition and pair each text value with a
number:

| Text value | Mapped number |
| ---------- | ------------- |
| ⭐         | 1             |
| ⭐⭐       | 2             |
| ⭐⭐⭐     | 3             |

Your notes keep showing the original text (e.g. the emoji), while
visualizations and aggregations use the mapped numbers. This is ideal for
tracking mood, energy, or ratings with emoji or words like `bad` / `ok` /
`great` and still getting heatmaps, trends, and averages.

### Value direction (higher or lower is better)

Number and checkbox properties — and text properties that have a value mapping —
can say whether **high values are good or bad**:

| Setting           | Meaning                                                   |
| ----------------- | --------------------------------------------------------- |
| Neutral (default) | No judgement. The plugin stays colorless about direction. |
| Higher is better  | Mood, sleep, steps, workouts                              |
| Lower is better   | Weight, cigarettes, screen time, resting heart rate       |

Setting it does two things:

- The **trend arrow** on line, bar, and area charts turns green when the metric
  is improving and red when it is worsening. With "lower is better", a falling
  line is the good news, and the arrow says so. The arrow glyph and the wording
  ("improving" / "worsening") carry the same meaning, so the color is never the
  only signal.
- The **default heatmap color** becomes green for higher-is-better and red for
  lower-is-better, so "more color = more of the thing" reads correctly either
  way. This applies while the view's **Color scheme** is left on **Automatic**;
  pick any scheme there or on the card itself and your choice wins.

Leaving it neutral keeps the previous behavior exactly.

### Value emojis

Give values their own emoji. Add entries under a property definition, using
either an exact value or an inclusive range:

| Key    | Emoji | Matches      |
| ------ | ----- | ------------ |
| `3`    | 😐    | exactly 3    |
| `1-2`  | 😞    | 1 through 2  |
| `8-10` | 😄    | 8 through 10 |

Exact keys win over ranges, so `0-10 → 🙂` plus `10 → 🎉` still celebrates a
perfect score. Where they show up:

- **Tooltips** on heatmap cells and on line, bar, area, scatter, and bubble chart
  points, in front of the value. (Pie, doughnut, polar, and radar charts show
  category distributions rather than tracked values, so they are unaffected.)
- **The capture dialog**, as a row of one-tap buttons under the number input —
  tap 😄 instead of typing 5. A range button records its lower bound. The button
  matching the current value is outlined.

Different from **value mapping** above, which goes the other way (text → number,
for input). A property can use both.

## Capture Command

Use the command **Life Tracker: Capture properties** to open the capture modal.

### Capture Today

Use the command **Life Tracker: Capture today** to capture data for today without opening the note first. The command looks for a markdown note named after today's date (`YYYY-MM-DD`, e.g. a daily note) and opens the capture modal on it. If several notes match, the most recently modified one is used. If no note matches, a notice is shown.

### Single Note Mode

When invoked from a regular note:

- Shows properties defined for that note
- Navigate between properties with arrows
- Values save automatically as you type
- Progress indicator shows completion status

### Batch Mode

When invoked from a Life Tracker or Grid view:

- Processes all notes in the current view
- Navigate between notes and properties
- Filter to show only notes with missing required properties
- Time frame settings are respected (only notes in the selected period)

## Modal Interface

### Navigation

- **Left/Right arrows**: Move between properties
- **Swipe left/right**: (Touch devices) Move between properties
- **Property pills**: Click to jump to a specific property
- **Note selector**: (Batch mode) Switch between notes

The modal opens on the first property that still needs a value (required properties first), so you land straight on something to fill in rather than on fields you have already completed.

On phones and tablets, swipe the card left to go to the next property and right
to go back. Swiping stops at the last property, so you can never finish or skip
to the next note by accident — use the button for that. Swipes that start on a
slider or an input are ignored so you can still drag a slider or select text,
and mostly-vertical gestures scroll as usual. The navigation buttons also grow
to full-size touch targets on small screens.

### Editors

Each property type has a specialized editor:

| Type     | Editor                                 |
| -------- | -------------------------------------- |
| text     | Text input field                       |
| number   | Numeric input with increment/decrement |
| checkbox | Toggle switch                          |
| date     | Date picker with a **Today** shortcut  |
| datetime | Date and time picker with **Today**    |
| list     | Multi-value input with add/remove      |
| tags     | Tag input with autocomplete            |

The **number** editor shows **−** and **+** buttons on either side of the input
for one-tap entry — ideal for counters like glasses of water or pushups. They
step by the property's configured step (1 when none is set), stay inside the
property's range (greying out at the bounds), and from an empty field the first
tap lands on the range minimum for bounded properties. Compact number cells in
the Life Tracking Grid keep the plain input.

The **date** and **datetime** editors include a **Today** button that fills in the current date (and time) in one click — handy since native date fields never pre-fill.

For **list** and **tags** properties that restrict input to a set of allowed values, typing a value outside that set is rejected with a brief shake and an inline message, so you can correct it instead of the entry silently disappearing.

### Auto-Save

Values are saved automatically as you type:

- Visual feedback shows save status
- No need to click save buttons
- Changes persist immediately to frontmatter

### Progress Tracking

The modal shows:

- Current property position (e.g., "2 of 5")
- Completion percentage
- Visual progress bar

## Filtering Notes (Batch Mode)

In batch mode, use the filter dropdown:

| Filter           | Description                                  |
| ---------------- | -------------------------------------------- |
| All notes        | Show all notes in the view                   |
| Missing required | Only notes with unfilled required properties |
| Missing any      | Notes with any unfilled properties           |

## Time Frame Integration

When capturing from a view with a time frame configured:

- Only notes within that time frame are included
- Lets you focus on a specific period (e.g., "this week")
- Prevents accidentally editing old data

## Confetti Celebration

When you complete all properties for a note, a confetti animation celebrates your progress. This can be disabled in settings.

## Tips

### Efficient Data Entry

1. Set up keyboard shortcuts for the capture command
2. Use default values for common entries
3. Filter to "Missing required" to focus on gaps

### Property Organization

- Order property definitions by frequency of use
- Use descriptive names for clarity
- Group related properties together

### Batch Processing

1. Open a Life Tracker or Grid view
2. Set the time frame to the period you're filling in
3. Use the capture command
4. Filter to "Missing required"
5. Work through notes systematically

### Quick Single-Entry

1. Open the note you want to update
2. Run the capture command
3. Fill in the properties
4. The modal closes when you're done
