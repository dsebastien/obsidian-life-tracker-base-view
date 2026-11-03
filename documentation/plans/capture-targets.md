# Capture targets

Capture into a note other than the daily note. First use: the day's strength
session note for small exercises done through the day (push-ups, squats,
plank). Later: any session note.

## Problem

- Every capture path finds its note by a dated file name (`findDailyNote`).
  Nothing looks at note types or frontmatter.
- `dailyNoteTypeId` only says how to _create_ a daily note.
- Creation reuses any file at the resolved path, so a Garmin note named
  `2026-11-03 (Strength Session)` would receive the quick counts meant for the
  "through the day" note.
- The "this note will not appear in your views" warning checks only the file
  name, so it fires for every session note (they carry a `date` property).
- Progress `count` counts entries, so a "days per week" target counts two
  notes on one day as two days.

## Model

`PluginSettings.captureTargets: CaptureTarget[]` (default `[]`).

```ts
interface CaptureTarget {
    id: string
    name: string
    /** Starter Kit note type id; '' = standalone (folder + pattern) */
    noteTypeId: string
    /** Standalone: folder with {{token}}s, e.g. Sessions/{{year}} */
    folder: string
    /** Basename pattern with {{token}}s, e.g. {{date}} (Strength Session).
     *  With a note type: optional text around {{date}}, inside the type's affixes */
    fileNamePattern: string
    /** Optional template; overrides the note type's template; '' = none */
    templatePath: string
    /** Standalone: tags a note must carry, written on creation */
    tags: string[]
    /** property = value pairs a note must match, written on creation */
    filters: Array<{ property: string; value: string }>
    /** Frontmatter property holding the note's date; 'date' by default */
    dateProperty: string
}
```

`PropertyDefinition.captureTargetId?: string` (Life Tracker-owned):

- absent / `''`: automatic
- `DAILY_NOTE_TARGET_ID` (`'daily-note'`): always the daily note
- a target id: that target

## Resolution: which target a property uses

1. Explicit target id that exists → that target.
2. `'daily-note'` → daily note.
3. Automatic + Starter Kit link → the target whose `noteTypeId` equals the
   link's `noteTypeId`, when exactly one exists.
4. Otherwise → daily note (today's behavior).

An explicit id pointing at a deleted target falls back to automatic.

## Lookup: the target note for a date

- Folder: the note type's folder (or the standalone folder) rendered for the
  date (`{{year}}` → that year). Only that folder (recursively) is scanned.
- Note type: Starter Kit note type → its enabled mappings (tag / folder /
  regex), OR logic, no enabled mapping matches nothing. Standalone → every tag
  in `tags` must be present (none = folder only).
- Filters: every pair must match (string compare, trimmed, case-insensitive;
  list values match when one item matches).
- Date: the date property (`YYYY-MM-DD`, or a datetime starting with it) for
  that day; when the property is empty, the file name (built-in or custom
  pattern, or a leading `YYYY-MM-DD`).
- Several matches → most recently modified wins.

## Creation

- Opt-in (`createMissingNotes`) and confirmed, exactly like daily notes. The
  confirmation shows the path.
- Name: Starter Kit prefix + `YYYY-MM-DD` + suffix, or the standalone pattern.
  A Starter Kit target with a pattern holding `{{date}}`: prefix + pattern
  (text around the date) + suffix, a typed trailing suffix dropped. Empty
  pattern or `{{date}}` alone: the plain type name.
  If a file exists at that path, the next free name is used: a counter goes
  right after the date part (`2026-11-03 2 (Strength Session)`). An existing
  file is never reused for a target.
- Template: the target's template, else the note type's. Applied once through
  Templater, which creates the file at its final name and folder, so the
  template sees the dated title.
- After creation the plugin writes: the date property (`YYYY-MM-DD`), every
  filter pair, and the mandatory tags (Starter Kit type tags or standalone
  tags, merged into `tags`). Without Templater the note is created empty and
  still gets these values, so it is found again.
- Discoverability: with a date property, the note is dated by that property;
  no file name warning. Only a target with an empty date property falls back
  to the file name check.

## Capture paths

- `Capture today` (daily) keeps its id and behavior; it lists only the
  properties whose target is the daily note.
- One command per target: `capture-today-target-<id>` named
  `Capture today: <name>`. Registered on load, re-synced on every settings
  change (added, renamed, removed via `removeCommand`).
- `Capture properties` on an open note: unchanged.
- Quick add panel: rows grouped by target. One group per destination with at
  least one quick-add property. With only the daily group, the panel looks as
  before (no group header). Each group finds its own note, offers creation,
  and has its own "Open full capture".
- Quick-add links resolve the target from the property (no new parameter).
- New link action `append=<value>`: adds one entry to a list property
  (`reps@weight`); refused on any other type.

## Fixes bundled

- Date anchor order: code is right, docs aligned. A view's date anchor
  property is an explicit per-view choice and comes first; the automatic chain
  (no property set) is file name → `date` → `created` → creation time.
- Starter Kit affixes kept their spaces only in the path utils: the service
  trimmed them on read, so `" (Strength Session)"` became `"(Strength Session)"`.
  Affixes are now read untrimmed (empty-only check).
- Progress `days` metric: distinct days with at least one non-zero entry.
  `count` unchanged.

## Settings UI

New page **Capture targets** (Capture group): list of targets, each with name,
note type dropdown (Starter Kit types when available, plus "Folder and file
name"), standalone fields, template, tags, filters (add/remove rows), date
property, delete. Property definitions get a **Capture into** dropdown.

## Files

- `src/app/types/plugin/capture-target.types.ts`: types, defaults, sanitizer
- `src/app/services/capture-target.utils.ts`: pure resolution, matching, naming
- `src/app/services/capture-target.service.ts`: vault lookup, creation, writes
- `src/app/commands/capture-target-commands.ts`: per-target commands
- `src/app/commands/capture-note.ts`: find or create a destination's note
- `src/app/components/ui/markdown-file-suggest.ts`: template path suggester
- `src/app/settings/capture-target-section.ts`: settings page
- quick add modal, quick-add utils, capture command, progress aggregation

## Out of scope

- Joining daily-note and session values in one Grid row (Bases do not join).
- Writing Starter Kit mandatory tags for daily notes created by "Capture
  today" (today's behavior relies on the template).
- Choosing among several candidate notes in the UI.
