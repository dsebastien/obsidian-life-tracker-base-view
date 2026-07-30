# Obsidian Starter Kit integration

Status: **phase 1 done** — implemented 2026-07-30, pending manual runtime
verification in a vault. Phases 2-3 (note-type-aware views) not started. See
`documentation/history/2026-07-30.md`.

## Why

Life Tracker's biggest onboarding cost is hand-defining every property in
settings. Starter Kit users have already done that work, organized by note type.
The two plugins were built to fit: `PropertyDefinition`, `ObsidianPropertyType`,
`Mapping`, and `NumberRange` already carry "Compatible with Obsidian Starter Kit
plugin's …" in their doc comments, and the shapes match.

Both plugins are owned by the same author, so the integration can be shaped from
both sides. It still must be **additive on both**: Starter Kit users who never
install Life Tracker, and Life Tracker users who never install Starter Kit, must
see no change whatsoever.

## What Starter Kit exposes

`plugin.api` (`PluginApi`), on the plugin instance registered as
`obsidian-starter-kit`. Every method returns `ApiResult<T>`
(`{ success, data?, error? }`) and hands back **deep copies**.

- `listNoteTypes(): NoteType[]` — each with `properties`, `mappings`, `tags`,
  `icon`, `associatedFolder`
- `listGlobalProperties(): PropertyDefinition[]`
- `getNoteTypeByName(name)`, `getNoteType(id)`
- `recognizeNoteType(path)` — async, cached (not needed until phase 3)

## Ownership split

The central decision: **Starter Kit owns structure, Life Tracker owns
presentation and value semantics.**

| Field                                     | Owner when linked                       |
| ----------------------------------------- | --------------------------------------- |
| `name`, `displayName`, `type`             | Starter Kit                             |
| `allowedValues`, `numberRange`            | Starter Kit                             |
| `defaultValue`, `required`, `description` | Starter Kit                             |
| `mappings` (which notes it applies to)    | Starter Kit (copied from the note type) |
| `polarity`, `valueEmojis`, `valueMapping` | **Life Tracker**                        |
| `id`, `order`                             | **Life Tracker**                        |

Deliberately **not** duplicating `polarity` / `valueEmojis` into Starter Kit's
schema: Starter Kit would only store them, never act on them, and two homes for
one value is exactly the drift this design is meant to avoid. If Starter Kit ever
grows a use for them, promote them then.

A linked definition therefore stays a perfectly normal Life Tracker definition —
it just re-reads its structure from Starter Kit on load.

## Mappings: copy, don't re-derive

Starter Kit's `RecognitionService` has rules that are easy to get wrong: several
note types can match one note, and **tag matches take priority** over folder and
regex ones. Its `NoteType.mappings` doc even says "ALL must match" while the code
returns on the _first_ match — the doc is wrong, the code is OR.

Life Tracker must not reimplement any of that. But it does not need to: it asks a
different question — _"does this property apply to this note?"_ — not _"which
single type is this note?"_. That question is a plain OR over the note type's
mappings, which is exactly what Life Tracker's existing `Mapping` handling does.
So sync **copies** the note type's mappings into the definition and leaves
recognition alone.

Global Starter Kit properties get no mappings, matching their "applies
everywhere" semantics.

## Degradation

Starter Kit absent, disabled, or its API changed → linked definitions keep the
structure from their last sync and behave like any other definition. The settings
UI says so, and offers unlink. Nothing is ever deleted because Starter Kit went
away.

## Steps

1. `starter-kit.types.ts` — `StarterKitPropertyLink`, the read-only shapes Life
   Tracker consumes (its own copies; the two plugins share no build).
2. `starter-kit.utils.ts` — pure: `toDefinitionStructure`, `applyStarterKitStructure`
   (merge preserving Life-Tracker-owned fields), `planImport` (create/link/update/
   conflict), `isStructureInSync`.
3. `starter-kit.service.ts` — thin, impure: locate the plugin, feature-detect the
   API, defensive typed reads. Injectable for tests.
4. `PropertyDefinition.starterKitLink`, plus barrel exports.
5. Resync on load, through `updateSettings` (immer).
6. Settings: new "Starter Kit" tab — status, import modal, per-definition badge.
7. Tests, docs, business rules, history.

## Out of scope (later phases)

- Note-type-aware views (`recognizeNoteType`, grouping). Filtering stays with
  Bases, which already does it.
- Writing back to Starter Kit. Life Tracker only reads for now.
