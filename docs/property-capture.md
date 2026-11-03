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

| Field        | Description                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name         | Frontmatter property key                                                                                                                            |
| Type         | text, number, checkbox, date, datetime, list, tags                                                                                                  |
| Required     | Labeled toggle in the row; required properties come first in the capture modal and drive the "Missing required" filter                              |
| Default      | Pre-filled value for new entries                                                                                                                    |
| Constraints  | Min/max/step for numbers, allowed values for text                                                                                                   |
| Note filter  | Folder, tag, or regex pattern to limit scope                                                                                                        |
| Quick add    | Whether the property is listed in the quick-add panel (off by default)                                                                              |
| Capture into | The note quick add, quick-add links and "Capture today" write the property into: automatic, the daily note, or a [capture target](#capture-targets) |
| Description  | Help text shown in the capture dialog (line breaks are kept, e.g. one line per value) and as the input placeholder                                  |

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

Use the command **Life Tracker: Capture today** to capture data for today without opening the note first. The command looks for a markdown note named after today's date (`YYYY-MM-DD`, e.g. a daily note) and opens the capture modal on it. If several notes match, the most recently modified one is used.

If no note matches, you get a notice telling you so. Unless you've turned on **Create missing notes when capturing**, in which case the plugin offers to create the note for you and then opens capture on it. See [Creating missing notes](configuration.md#creating-missing-notes).

"Capture today" lists only the properties that go to the daily note. A property
that goes to a [capture target](#capture-targets) has its own command: **Life
Tracker: Capture today: \<target name\>**. Without capture targets, every
property goes to the daily note, like before.

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

## Quick Add

The capture dialog walks through properties one at a time, which is right for a
full check-in. For logging a single value, use quick add instead.

### The panel

Run **Life Tracker: Quick add** (or click the ribbon icon). The panel lists the
quick-add properties of one day's note, all at once, each with its usual editor:
−/+ buttons, emoji buttons, a checkbox. Every change saves immediately; there is
no Next or Done.

When some quick-add properties go to a [capture target](#capture-targets), the
panel groups its rows by note: the daily note first, then one group per target,
each showing that target's note for the day. The **Full capture** button in a
group's header opens the capture dialog on that note. A group whose note
doesn't exist yet shows **Create note** (when **Create missing notes when
capturing** is on). With only the daily note, there are no groups and the panel
looks like before.

- With a daily note open, the panel edits that day, so you can fill in an old
  daily note in place. Otherwise it edits today.
- ‹ and › move one day; **Today** jumps back.
- If the day has no note, you can create it from the panel when **Create missing
  notes when capturing** is on.
- Without groups, **Open full capture** switches to the capture dialog for the
  same note.

Which properties appear is set per property with **Show in quick add**
(Settings → Life Tracker → property definitions). It is off by default: pick
the few things you log often, so the panel stays short.

### Quick-add links

A link logs a value with no panel at all. Put one on your phone's home screen
(iOS Shortcuts "Open URL", an Android shortcut or widget) and logging a glass of
water is a single tap.

```
obsidian://life-tracker-quick-add?property=water&increment
```

| Parameter         | Meaning                                                         |
| ----------------- | --------------------------------------------------------------- |
| `property`        | Property name or display label (case-insensitive)               |
| `increment[=n]`   | Number: add one step (like the + button), or `n`                |
| `decrement[=n]`   | Number: remove one step, or `n`                                 |
| `toggle`          | Checkbox: flip it                                               |
| `set=<value>`     | Set any non-list property, e.g. `set=7`, `set=true`, `set=mild` |
| `append=<value>`  | List or tags property: add one entry, e.g. `append=12@60`       |
| `date=YYYY-MM-DD` | Optional. The day to write to; today when absent                |

Use exactly one action per link. A link with no property opens the panel. Links
always target today (or `date`), never the note you have open, so a shortcut
behaves the same every time.

The link writes into the property's note for that day: the daily note, or the
note of its [capture target](#capture-targets). Your links don't change. Once
push-ups go to the day's strength session, the same push-ups link writes there.

`append` adds one entry at the end of a list (or tags) property and leaves the
entries already there as they are. It's refused on any other type. Any
non-empty value is added, even `append=true`. I use it for sets: one entry per
set, written as `reps@weight`. One set of 12 reps at 60 kg on a list property `leg_press`:

```
obsidian://life-tracker-quick-add?property=leg_press&append=12@60
```

Values are clamped to the property's range and validated; a rejected value
shows a notice and nothing is written. A notice confirms each write, e.g.
"Water: 6 (today)", or "Push-ups: 30 (today, Through the day)" when the value
went to a capture target.

## Capture Targets

By default, every value you capture goes to the daily note. Fine for mood,
sleep or water. Less so for data that belongs to a session.

Here's my own case. I do small exercises through the day: push-ups, planks,
squats. I want them in one strength session note per day
(`2026-11-03 (Strength Session)`, with `workout_kind: Through the day`), in the
same folder as the gym sessions Garmin syncs for me. A **capture target** sends
some properties to a note like that one instead of the daily note.

Set targets up in **Settings → Life Tracker → Capture targets**. Each target has:

| Field         | Meaning                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name          | Shown in the command name and in the quick-add panel                                                                                                                      |
| Note type     | An Obsidian Starter Kit note type, or "Folder and file name" to work without the Starter Kit                                                                              |
| Folder        | Without the Starter Kit: where the notes live, with placeholders such as `{{year}}`                                                                                       |
| File name     | Without the Starter Kit: name of a new note. Must contain `{{date}}`; other date placeholders are allowed                                                                 |
| Tags          | Without the Starter Kit: tags a note must have; added to a new note                                                                                                       |
| Template      | Optional template for a new note. With a Starter Kit note type, overrides the note type's template                                                                        |
| Date property | The property that holds the date of the note (`date` by default)                                                                                                          |
| Match filter  | `property = value` pairs a note must have, for example `workout_kind` = `Through the day`. All of them must match. A row without a property or without a value is ignored |

Under the fields, **Problems** tells you what's wrong with the target, if
anything: a missing folder, a file name without `{{date}}`, or an incomplete
match filter row. **Properties** lists the properties that go to the target
right now. The **Name** row shows the target's command and its id, which you
need to [capture from a button](#capture-from-a-button).

### Which properties go to a target

Each property definition has a **Capture into** setting:

- **Automatic** (default): a property imported from an Obsidian Starter Kit
  note type goes to the capture target of that note type. If no target uses
  that note type, or several do, it goes to the daily note. So does every
  property you defined yourself. The dropdown shows where automatic sends it,
  for example **Automatic (Through the day)**.
- **Daily note**: always the daily note.
- A target: always that target.

You still define a property once. The target only decides which note it's
written into.

### How the note is found

For a day, the plugin looks only in the target's folder for that day (for
example `Sessions/Strength/2026` for `Sessions/Strength/{{year}}`), including
its subfolders. A note is the target's note when:

1. it is of the target's note type: one of the Starter Kit note type's filters
   matches it (for example its tag), or, without the Starter Kit, it has all the
   target's tags;
2. every match filter pair matches its properties (case does not matter; for a
   list property, one item is enough);
3. its date property holds that day: `2026-11-03`, a date and time on that day
   (`2026-11-03T08:15`), or a link to that day's note (`[[2026-11-03]]`). When
   the date property is empty or holds something else, the plugin uses the
   date in the file name (a filename date pattern, or a name that starts with
   `YYYY-MM-DD`).

If several notes match, the most recently modified one wins. A different note
of the same type on the same day is never used. The match filter keeps them
apart: my Garmin gym sessions have no `workout_kind: Through the day`, so they
never receive the push-ups.

Before offering to create a note, the plugin also checks the disk. It reads the
notes of that folder that could be the one: a name with that day's date, a note
Obsidian hasn't indexed, or a note changed in the last 10 minutes. That way, a
note Obsidian hasn't indexed yet is never created twice.

Tap twice while the note is being created? Both taps go into the same note, and
both count: two `increment=10` taps make 20.

Properties that go to a target are written into the target's note without
checking their **Note filtering**: the target decides where they go.

### When the note does not exist

With **Create missing notes when capturing** on, the plugin offers to create the
note and shows you its path first. Nothing is created without your
confirmation.

- The name comes from the note type (its name prefix and suffix around the
  date, for example `2026-11-03 (Strength Session)`) or from the target's file
  name. If a file with that name already exists, it is **not** reused, because
  it can be another note of the same type. The next free name is taken, with a
  number right after the date (`2026-11-03 2 (Strength Session)`).
- Before asking, the plugin checks that it would find the new note again. If
  the note type's filters wouldn't match it (for example a regex filter that
  the number after the date breaks), or the note would have no date, it
  doesn't create it and tells you why.
- The note is created in its final folder with its final name, then the
  template runs through Templater, so the template sees the date in the title.
  The template is the target's, else the note type's. Life Tracker applies it
  itself, even when Templater has a folder template for that folder: the
  folder template does not run on this note.
- Then the plugin writes the date property, every match filter value and the
  note type's (or target's) tags into the note. A date the template already
  wrote for that day (`2026-11-03T08:15`, `[[2026-11-03]]`) stays as it is.
  The plugin keeps Templater from processing the note a second time, so it
  can't overwrite these values.
- If the plugin still doesn't recognize the new note after that (for example
  because its template moved it to another folder), a notice tells you: the
  next capture wouldn't find it.
- **Without Templater** (or when the template fails or is missing), the note is
  created empty and still gets the date property, the filter values and the
  tags. So it is found again, and it shows up in your views.

Notes created for a target are dated by their date property, so your views find
them even when no date can be read from the file name. That's also why you get
no "will not appear in your views" warning for them. Only a target without a
date property falls back to that file name check.

Views read the `date` property automatically. A target that uses another date
property needs the view's **Date anchor** set to that property.

### Capture from a button

Each target adds a command: **Life Tracker: Capture today: \<target name\>**.
It opens the capture dialog on the target's note for today, with the
properties that go to that target. When the note is missing, it offers to
create it (with **Create missing notes when capturing** on).

The **Name** row of the target shows the command id:
`life-tracker:capture-today-target-<id>`. Use it for a button, a hotkey or any
plugin that runs commands. Renaming the target changes the command name, not
its id, so your button keeps working.

### Example: my small exercises

Here's how I set it up in my own vault, with the Obsidian Starter Kit.

1. In the Starter Kit, I moved the bodyweight counters
   (`health_exercise_push_ups`, `health_exercise_plank_seconds`, …) from the
   daily notes note type to the **Strength Sessions** note type. In **Settings
   → Life Tracker → Obsidian Starter Kit**, their definitions then showed "not
   found in Starter Kit right now", because their source had moved. Unlink
   them, then import them again from the new note type. The import links each
   existing definition back and keeps its value direction, emojis, value
   mapping and quick-add setting.
2. I created a capture target named "Through the day": note type **Strength
   Sessions**, match filter `workout_kind` = `Through the day`. Template and
   date property stay at their defaults.
3. The imported counters now go to that target automatically. **Show in quick
   add** is on for them.
4. Quick add shows a "Through the day" group. A link such as
   `obsidian://life-tracker-quick-add?property=health_exercise_push_ups&increment=10`
   adds 10 push-ups to the day's "Through the day" note, and offers to create
   that note on the first tap of the day.
5. My daily note template has a Meta Bind button, **💪 Small exercises**, that
   runs `life-tracker:capture-today-target-<id>`. One tap opens the capture
   dialog on today's "Through the day" note: push-ups, planks, squats, and the
   rest.

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

### Auto-advance

Turn on **Auto-advance after picking a value** (Settings → Capture) to move to
the next property as soon as you pick a value from a dropdown, tap an emoji
button, or toggle a checkbox. Values you type, and slider drags, still need
Enter or the Next arrow, so you are never moved on mid-entry. Browsing a
dropdown with the arrow keys doesn't count as a pick either: press Enter to
confirm. Auto-advance stops
at the last property: finishing the note or going to the next note stays a
button press.

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
property's range (greying out at the bounds). From an empty field, **+** starts
counting at one step (a 0-30 water counter goes to 1) and **−** sets the lowest
value (0), so logging "none today" is one tap. A range that starts above 0, like
a 1-5 mood, starts at its minimum either way. Compact number cells in
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
