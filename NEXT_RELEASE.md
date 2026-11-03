### Capture into notes other than the daily note

Until now, quick add, quick-add links and "Capture today" always wrote into the
daily note. Some values belong elsewhere: the push-ups, squats and planks you do
through the day can now go into the strength session note of that day.

- New **Settings → Life Tracker → Capture targets** page. A capture target is a
  note type (an Obsidian Starter Kit note type, or a folder and file name), a
  match filter such as `workout_kind` = `Through the day`, an optional template
  and a date property (`date` by default).
- Each property has a new **Capture into** setting: automatic, the daily note,
  or a capture target. Automatic sends a property imported from a Starter Kit
  note type to the capture target of that note type.
- The note is found by its type, its match filter and its date property. Another
  note of the same type on the same day, such as a gym session synced from
  Garmin, is never used.
- When the note is missing and **Create missing notes when capturing** is on,
  the plugin asks first, then creates it from its template. If the file name is
  taken, it uses the next free name (`2026-11-03 2 (Strength Session)`). It then
  writes the date, the match filter values and the tags, also when Templater is
  not installed.
- Each capture target adds a command **Capture today: \<target\>**.
- "Capture today" now lists only the properties that go to the daily note.
  Without capture targets nothing changes.

### Quick add

- The panel groups its rows by note: the daily note, then each capture target,
  each with its own **Create note** and **Full capture** buttons. With only the
  daily note, the panel looks as before.
- Quick-add links write into the note of the property's capture target. Links
  do not change.
- New link action `append=<value>` adds one entry to a list property, for
  example `append=12@60` for a set of 12 reps at 60 kg.

### Goals

- New measure **Days with a value**: the number of days with at least one
  non-zero value. Two notes on the same day count as one day, so "3 days a
  week" stays right with session notes. "Entries with a value" keeps counting
  notes, and existing goals are not changed.

### Fixes

- Notes created from a Starter Kit note type keep the spaces of the name
  suffix: `2026-11-03 (Strength Session)`, not `2026-11-03(Strength Session)`.
- The "this note will not appear in your views" warning no longer shows for
  notes created for a capture target with a date property.
- The documentation now describes the date order the views use: with a date
  anchor property set in a view, that property comes before the file name.
