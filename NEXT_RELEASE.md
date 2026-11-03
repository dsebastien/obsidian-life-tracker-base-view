### File names for capture targets with a note type

A capture target with an Obsidian Starter Kit note type had no **File name**
setting. The note was always named after the note type: its prefix, the date
and its suffix. So two targets of the same note type, or a target and a note
made by another tool, wanted the same name on the same day. My small exercises
("Through the day") and my gym session are both strength sessions, and both
wanted `2026-11-03 (Strength Session)`.

Now, a target with a note type has its own, optional **File name**. It sets
the text around the date:

- The note type still adds its prefix and suffix, and still gives the folder,
  the template and the tags. `{{date}} Through the day`, with the suffix
  ` (Strength Session)`, gives `2026-11-03 Through the day (Strength Session)`.
- Typed the note type's prefix or suffix in the file name too? It isn't added
  twice. Only a whole word is removed: with the suffix ` Log`, `Gym log` loses
  its `log`, and `Backlog` stays as it is.
- An empty file name, or `{{date}}` alone, gives the note type's usual name.
- A file name without `{{date}}` is ignored, and the note type's name is used.
  **Problems**, in the target's settings, tells you so.
- **Problems** also lists the names capture would refuse, and capture refuses
  them with the same message: unknown tokens (`{{time}}`), date formats
  (`{{date:YYYY}}`), `/` or `\` (the folder comes from the note type),
  `: ? * " < > |`, `# ^ [ ]`, and a name that ends with a dot. Only the text you
  type is checked, never the note type's own prefix and suffix.
- The plugin still finds the day's note by its note type, match filter and
  date property. The name plays no part in that.

Targets without a note type keep their own **File name**, which works exactly
as in 3.5.0: `/` still makes subfolders (`{{year}}/{{date}}`), and `#` and a
trailing dot are still accepted. **Problems** may now warn you about a name
that capture already refused. The settings page shows the File name of the
current mode only, and switching modes doesn't copy one into the other.

Nothing changes when you upgrade. Your targets with a note type keep their
usual names. A File name you set on a target before you switched it to a note
type is ignored, and comes back if you switch the target back. To add text
around the date, type it in **File name** (`{{date}} Through the day`).

On Obsidian Sync, a device with an older version ignores this File name and
keeps the note type's usual name. If that device saves its Life Tracker
settings, the File name of those targets is lost: older versions keep only the
capture target settings they know.
