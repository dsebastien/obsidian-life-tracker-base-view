### Capture into a note other than the daily note

Until now, everything you captured landed in the daily note: quick add,
quick-add links and "Capture today" all wrote there. Fine for mood or sleep.
Less so for data that belongs to a session.

Here's my own case. I do small exercises through the day: push-ups, planks,
squats. I want them in one strength session note per day
(`2026-11-03 (Strength Session)`, with `workout_kind: Through the day`), in the
same folder as the gym sessions Garmin syncs for me. Those gym sessions must
never receive the push-ups.

This release adds **capture targets** for that.

- New page: **Settings → Life Tracker → Capture targets**. A target is a note
  type (an Obsidian Starter Kit note type, or a folder and file name), a match
  filter such as `workout_kind` = `Through the day`, an optional template and a
  date property (`date` by default).
- Each property gets a **Capture into** setting: automatic, the daily note, or
  a capture target. Automatic sends a property imported from a Starter Kit note
  type to the target of that note type.
- The plugin finds the day's note by its type, its match filter and its date
  property. Another note of the same type on the same day (my Garmin session)
  is never used.
- No note yet? With **Create missing notes when capturing** on, the plugin asks
  first, then creates it from its template. If the file name is taken, it picks
  the next free one (`2026-11-03 2 (Strength Session)`). It then writes the
  date, the match filter values and the tags, even without Templater. The
  note is dated by its date property, so you don't get the "will not appear in
  your views" warning for it.
- "Capture today" now lists only the properties that go to the daily note.

No capture targets? Then nothing changes for you.

### One command per target, ready for a button

Each target adds its own command: **Capture today: \<target name\>**. The
target's settings show the command id, `life-tracker:capture-today-target-<id>`,
so you can run it from a button, a hotkey or any plugin that runs commands.
Renaming the target keeps the id, so your button keeps working.

In my vault, a Meta Bind button in my daily note template, **💪 Small
exercises**, runs that command. One tap opens the capture dialog on today's
"Through the day" note, and offers to create the note first when it doesn't
exist yet.

### Quick add, grouped by note

- The quick-add panel now groups its rows by note: the daily note, then each
  capture target. Each group has its own **Full capture** button, and a
  **Create note** button when its note doesn't exist yet (with **Create missing
  notes when capturing** on). With only the daily note, the panel looks exactly
  like before.
- Quick-add links write into the note of the property's capture target. Your
  links don't change: once push-ups go to a target, the same push-ups link
  writes there.
- New link action `append=<value>`: adds one entry to a list (or tags)
  property. For example, `append=12@60` logs a set of 12 reps at 60 kg.

### Goals: "Days with a value"

A new measure for goals: the number of days with at least one non-zero value.
Two notes on the same day count as one day, so a "3 days a week" goal stays
right when a gym session and a "Through the day" session share a day.

"Entries with a value" still counts notes, and your existing goals don't
change.

### Fixes

- Notes created from a Starter Kit note type keep the spaces of the name
  prefix and suffix: `2026-11-03 (Strength Session)`, not
  `2026-11-03(Strength Session)`.
- Values captured into a daily note the plugin had just created from its
  template could be lost: Templater could process the new note a second time
  and overwrite them. The plugin now keeps Templater away from a note it has
  just created.
- Turning the plugin off and on again quickly, or a hot reload, could fail
  with "Action life-tracker-quick-add is already registered". That no longer
  happens.
- The documentation was wrong about dates. With a **Date anchor** property set
  in a view, that property comes first, before the file name. The plugin
  already worked that way; the docs now say so.
