### File names for capture targets with a note type

A capture target with an Obsidian Starter Kit note type now uses its **File
name** setting. Before, the name was always the note type's prefix, the date
and the note type's suffix, so two targets of the same note type (or a target
and a note made by another tool) wanted the same name on the same day.

- The file name sets the text around the date. The note type still adds its
  prefix and suffix, and still gives the folder, template and tags. Example:
  `{{date}} Through the day` with the suffix ` (Strength Session)` gives
  `2026-11-03 Through the day (Strength Session)`.
- If you type the note type's suffix in the file name too, it is not added
  twice.
- An empty file name, or `{{date}}` alone, gives the same name as before.
  Your existing targets do not change.
- A file name without `{{date}}` is ignored. **Problems** in the target's
  settings tells you so.
- The plugin still finds the day's note by its note type, match filter and
  date property, not by its name.
