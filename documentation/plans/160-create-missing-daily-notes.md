# Create missing periodic notes when capturing (issue #160)

Status: in progress — path resolution landed, services and wiring pending.

## Problem

When a date has no note, Life Tracker cannot capture data for it. `Capture
today` resolves a file with `findTodayNote` (`src/app/commands/capture-command.ts:85`)
and, on `null`, shows a Notice and stops. Nothing is ever created.

The grid is a Bases view: `onDataUpdated` renders the rows the `.base` query
returns (`src/app/view/grid-view/grid-view.ts:281`). A date with no file has no
row, so the day is invisible. Life Tracker cannot synthesise a cell for a
non-existent file — that is a Bases constraint, not a plugin choice. What it
_can_ do is create the note, after which Bases re-queries and the day appears.

## Solution

Resolve where a periodic note for a date _should_ live, create it, apply the
configured template, then hand the new `TFile` to the existing capture path.

Configuration is never invented by Life Tracker. It is read from whichever
source the vault already has, in priority order:

| Priority | Source                         | Supplies                                                                                                     |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1        | Obsidian Starter Kit note type | `associatedFolder` (with `{{token}}`s), `templatePath`, `noteNamePrefix`, `noteNameSuffix`, mandatory `tags` |
| 2        | Periodic Notes plugin          | `folder`, `format` (moment), `template`                                                                      |
| 3        | neither                        | no creation; keep today's Notice                                                                             |

Rationale for the order: Starter Kit knows more. It carries the mandatory tags
and the property definitions, so a note created from it is born _correct_ rather
than merely present. Periodic Notes carries only folder/format/template.

There is deliberately **no core Daily Notes support**. It is disabled in the
reference vault, Periodic Notes supersedes it, and adding a third partially
overlapping source is cost without users.

### Starter Kit path

`listNoteTypes()` already returns everything needed — `StarterKitService`
simply does not declare the fields. `StarterKitNoteType`
(`src/app/types/property/starter-kit.types.ts:44`) gains `associatedFolder`,
`templatePath`, `noteNamePrefix`, `noteNameSuffix`, `tags`, all optional so an
older Starter Kit degrades instead of failing `isValidNoteType`.

`associatedFolder` uses the same `{{token}}` vocabulary Life Tracker already
compiles for filename patterns (issue #139) — e.g.
`40 Journal/41 Daily Notes/{{year}}/{{week}}`. The existing token machinery in
`src/utils/filename-date.utils.ts` renders it; no second syntax is introduced.

Starter Kit stores no _filename_ format. The basename is the granularity's
built-in format (`YYYY-MM-DD`, `GGGG-[W]WW`, `YYYY-MM`, `YYYY-[Q]Q`, `YYYY`) —
the inverse of the built-in patterns Life Tracker already parses — wrapped in
`noteNamePrefix` / `noteNameSuffix`.

The weekly default uses moment's **ISO** week tokens (`GGGG`/`WW`), not the
locale ones (`gggg`/`ww`) Journal Bases defaults to. Life Tracker resolves week
filenames through `getDateFromISOWeek`, and the two disagree: with an en locale
Sunday 2026-08-30 ends ISO week 35 but starts locale week 36, so locale tokens
would emit a name this plugin reads back as a different week. Covered by the
round-trip tests in `periodic-note-path.utils.spec.ts`.

Verified against the reference vault: folder tokens + `YYYY-MM-DD` reproduces
`40 Journal/41 Daily Notes/2026/35/2026-08-30.md`, matching `osk-cli
daily-note-path` exactly.

Which note type maps to which granularity is a **setting**, not a guess: a
dropdown per granularity listing Starter Kit's note types, seeded by matching
the note type's mappings/name against the granularity and freely overridable.
Name matching alone is too fragile to rely on (vault language, renames).

Starter Kit stays **read-only**, preserving the rule in `Business Rules.md`
("only ever reads"). Life Tracker performs the vault writes itself; Starter Kit
exposes no `createNote` on its public API regardless.

### Periodic Notes path

Ported from `obsidian-journal-base`, which already solves this. Detection via
`app.plugins.enabledPlugins.has('periodic-notes')`, settings read from
`plugin.settings`, validated before use, all five granularities.

Only the flat 0.x settings shape is supported (`{daily,weekly,…}.{enabled,
folder,format,template}`). A 1.x `calendarSets` layout fails validation and
degrades to "not available" rather than misreading. Same posture as
`StarterKitService`: feature-detected, never thrown.

Validation is hand-written type guards in the style of `isValidNoteType`
(`src/app/services/starter-kit.service.ts:44`). Journal Bases uses zod; Life
Tracker does not depend on zod and this is not enough validation to justify a
new runtime dependency in a community-catalog plugin.

`format` is a moment format and may embed subfolders (`YYYY/WW/YYYY-MM-DD`).
`moment` is publicly exported from `obsidian` (`obsidian.d.ts:4561`), so it is
used directly — Journal Bases' ~660-line `date-utils.ts` moment→date-fns
translator is **not** ported.

### Templater

Templates from both sources are Templater templates; a raw file copy would
produce a note full of unexecuted `<% %>`. Creation goes through Templater's
own engine: `create_new_note_from_template(templateFile, folder, basename, false)`
on `app.plugins.plugins['templater-obsidian'].templater`.

**Double-application hazard.** Templater can be configured with
`trigger_on_file_creation` plus a folder template covering `/` (true in the
reference vault, where a dispatcher template applies the right template per note
type). Under that configuration a plain `vault.create` is _already_ templated by
Templater. Applying a template again would duplicate content. Creation must
therefore detect whether Templater will fire on its own for the target path and
apply manually only when it will not.

**Frontmatter race.** Templater writes asynchronously and returns before the
file has settled. Writing captured properties immediately can race that write
and lose data. Properties are written only after template application has
completed.

Templater absent, or failing: fall back to `vault.create(path, '')`. Unlike
Journal Bases, an empty file is not an acceptable end state here — the captured
properties are still written, because capture is the point of the operation.

## Files

- `src/app/types/property/starter-kit.types.ts` — widen `StarterKitNoteType`.
- `src/app/services/starter-kit.service.ts` — validate/pass the new fields.
- `src/app/types/periodic-notes.types.ts` (new) — `PeriodicNoteConfig`,
  per-granularity settings, guards.
- `src/utils/periodic-note-path.utils.ts` (new) + spec — **pure**
  `(date, granularity, resolved config) → vault path`. The testable seam:
  token/moment rendering, prefix/suffix, extension. **Done.**
- `src/utils/filename-date.utils.ts` — `renderDateTokens`, the forward
  counterpart of the pattern parser (the existing
  `renderFilenameDatePatternExample` is a settings preview: it renders wildcards
  as `…`, so it cannot produce a path). **Done.**
- `src/app/services/note-target.service.ts` (new) + spec — resolves the
  effective config for a granularity across the source chain.
- `src/app/services/note-creation.service.ts` (new) + spec — existence check,
  recursive folder creation, Templater application, `vault.create` fallback.
- `src/app/commands/capture-command.ts` — replace the dead-end Notice with
  confirm-then-create; extract `findTodayNote`'s lookup for reuse.
- `src/app/settings/date-settings-section.ts` — creation toggle + per-granularity
  Starter Kit note type mapping.
- `src/app/types/plugin/plugin-settings.intf.ts` + `src/app/plugin.ts` — new
  settings and their migration.
- `src/test-preload.ts` — stub the obsidian values the new code imports
  (`Notice`, `normalizePath`, `TFolder`, `moment`); it currently stubs only
  `parseFrontMatterTags`.

## Rules

- Configuration is read, never invented: Starter Kit first, then Periodic Notes,
  then no creation at all.
- Starter Kit is read-only. Life Tracker performs its own vault writes.
- A note is never overwritten. An existing file at the target path is reused.
- The folder to create is the **dirname of the fully resolved path**, not the
  configured folder — the format may contribute subfolders. (Journal Bases has
  this bug: it calls `ensureFolderExists(config.folder)` while the format can
  add `2026/35`, so `vault.create` throws.)
- An empty configured folder yields a vault-root path, never a leading `/`.
  (Journal Bases emits `/2024-01-15.md` here, asserted in its own spec.)
- A template is applied exactly once: skipped when Templater's own on-create
  trigger already covers the path.
- Captured properties are written after template application settles, never
  concurrently with it.
- Every integration is feature-detected and degrades to "not available"; a
  missing, disabled, or reshaped source is never an error.
- Creation is opt-in. A plugin that writes new files into a vault must be asked
  first.

## Calling moment

`moment` is exported from 'obsidian' but is **not callable through that export**
under this repo's tsconfig: `obsidian.d.ts` declares it `typeof Moment` from an
`import * as Moment from 'moment'`, and with `esModuleInterop: true` TS treats
that namespace as non-callable. `moment.default(...)` type-checks and then fails
at runtime — moment's CJS export is a bare function with no `default`. The
worst combination: green build, broken plugin.

So the path helpers take an injected `MomentFormatter` instead of importing
moment. Production supplies one from Obsidian's export at the call site (where
the interop can be handled once); the specs supply the real moment via
`createRequire`, which returns an untyped value that lands in a precise local
type — no cast, no suppression, and the lint rules that keep a second moment out
of the bundle stay on.

Not solved by changing tsconfig: `compilerOptions` are part of the rule-floor
baseline, and loosening them to make one import convenient is the trade the
floor exists to prevent.

## Open scope question

Daily is what the issue asks for and what `Capture today` covers. Both config
sources describe all five granularities and Life Tracker already models
`TimeGranularity`, so the resolver and path builder are written generically
while only the daily entry point is wired. Extending to the other four is then
settings work, not new machinery.

## Manual verification (cannot be self-verified by an agent)

- Starter Kit installed: `Capture today` on a day with no note creates it at the
  note type's `associatedFolder` with tokens resolved, correct basename, the
  note type's mandatory tags present, and the captured properties written.
- Starter Kit absent, Periodic Notes enabled: same, using its folder/format/
  template, including a subfolder-bearing format such as `YYYY/WW/YYYY-MM-DD`.
- Neither installed: unchanged Notice, nothing created.
- With `trigger_on_file_creation` on and a `/` folder template: the template is
  applied exactly once — no duplicated sections.
- The created day appears in a Bases grid after Bases re-queries.
- Templater disabled: the note is still created and still receives its
  properties.
