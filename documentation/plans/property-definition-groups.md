# Property Definition Groups (issue #18)

## Goal

Let users organize property definitions into logical groups (e.g., "Sleep",
"Mental health", "Exercise"). The flat list in settings becomes a hard-to-scan
wall once a user has 30+ definitions.

## Scope

- IN: settings tab grouped/collapsible sections, group field on each
  definition, drag-and-drop across groups, group caption in capture modal.
- OUT: grid view, table view, separate "manage groups" UI (groups are
  derived from definitions, not a first-class entity).

## Data model

`src/app/types/property/property-definition.types.ts`:

```ts
interface PropertyDefinition {
    // ...existing fields...
    /** Optional group label. Empty string = ungrouped. */
    group: string
}
```

- Default `''` in `createDefaultPropertyDefinition`.
- Read-time: treat missing/undefined as `''`. No on-disk migration needed.

`src/app/types/plugin/plugin-settings.intf.ts`:

```ts
interface PluginSettings {
    // ...existing fields...
    /** Group labels collapsed in the settings UI. Empty string = "Ungrouped". */
    collapsedPropertyGroups: string[]
}
```

Default `[]`. Updated via `plugin.updateSettings(draft => ...)` per the
immer rule.

## Bucketing logic (pure, testable)

New file `src/app/services/property-grouping.utils.ts`:

```ts
interface PropertyGroup {
    label: string // '' for ungrouped
    definitions: PropertyDefinition[] // sorted by .order
}

function groupPropertyDefinitions(definitions: PropertyDefinition[]): PropertyGroup[]
```

Rules:

- Trim group label (whitespace-only treated as `''`).
- Group order = order of first appearance in the `definitions` array (already
  sorted by `.order` upstream). Predictable.
- Ungrouped section ALWAYS rendered first if it has members. (Matches "no
  group = top of list" intuition; user can change by giving everything a
  group.)
- Within each group, definitions ordered by `.order`.

Spec file `src/app/services/property-grouping.utils.spec.ts` covers:

- Empty input
- All ungrouped
- Mixed groups
- Whitespace-only group treated as ungrouped
- Order preservation
- Stable ordering when multiple groups share members

## Settings tab UI

`src/app/settings/settings-tab.ts`:

1. Replace the flat `for ... renderPropertyDefinitionItem` loop with
   `groupPropertyDefinitions(...)` + per-group section rendering.
2. Section header element: chevron + group label (or "Ungrouped") + count
   chip + optional "Collapse all" / "Expand all" toolbar above the list.
3. Click on section header toggles `collapsedPropertyGroups`. Persist via
   `plugin.updateSettings`.
4. On each definition's expanded details, add a new "Group" text input.
   Datalist suggests existing group labels from other definitions —
   no separate management UI.
5. Renaming a group: when the user changes a definition's group, no
   propagation. If they want to rename "Sleep" → "Sleeping", they edit
   each definition. Acceptable for v1; revisit if users complain.

## Drag-and-drop semantics

Existing drag-drop handler in `settings-tab.ts` (`reorderDefinitions`):

- Determine the target section (the group label of the drop-target
  definition, OR the empty group if dropped into the ungrouped section).
- If source and target are in the same group: only `.order` changes.
- If different: source's `group` is reassigned to target's group AND
  `.order` is set so it slots into the destination at the drop position.
- After move, show a non-blocking toast (use Obsidian's `Notice`): "Moved
  to group X". No undo for v1 — keep it simple.

Edge case: drop on empty group section header → assign to that group,
append at end.

## Capture modal

`src/app/components/modals/property-capture-modal.ts`:

- In the existing header above the property name, prepend a small caption
  showing `group.toUpperCase()` if non-empty (mute color, smaller font).
- Ungrouped properties: no caption (don't show "UNGROUPED" — visual noise).
- No navigation changes. Carousel still steps through all applicable
  properties in their existing order.

## CSS

`src/styles.src.css`:

- `.lt-property-group-section` — section container
- `.lt-property-group-header` — flex row with chevron, label, count
- `.lt-property-group-header--collapsed` — chevron rotated
- `.lt-property-group-section--collapsed .lt-property-definition-item` —
  display: none
- `.lt-property-capture-group-caption` — small muted caption above property
  name in modal

Use Tailwind utilities via `@apply` + Obsidian CSS variables (per project
Tailwind guidelines). No inline styles.

## Documentation updates

- `documentation/Business Rules.md` — new section "Property Definition Groups":
    - Optional group label per definition
    - Empty/whitespace = ungrouped
    - Ungrouped section always rendered first
    - Cross-group drag reassigns group + updates order
- `README.md` — one bullet under Customization mentioning groups.
- `docs/configuration.md` — short section on creating/using groups.

## Files

**New:**

- `src/app/services/property-grouping.utils.ts`
- `src/app/services/property-grouping.utils.spec.ts`

**Modified:**

- `src/app/types/property/property-definition.types.ts` (add `group` field,
  default in factory)
- `src/app/types/plugin/plugin-settings.intf.ts` (add
  `collapsedPropertyGroups`)
- `src/app/types/plugin/default-settings.ts` (default `[]`)
- `src/app/settings/settings-tab.ts` (section rendering, group field input,
  cross-group drag logic)
- `src/app/components/modals/property-capture-modal.ts` (group caption)
- `src/styles.src.css` (new classes)
- `README.md`, `docs/configuration.md`, `documentation/Business Rules.md`,
  `documentation/history/<date>.md`

## Open questions (decide before implementing)

1. Cross-group drag: A (move + relabel, with toast) [default proposal] or
   B (refuse, force explicit group field edit)?
2. Group rename propagation: skip for v1, or add as part of this work?
3. Free-text group field [default proposal] or managed list with explicit
   "create group" action?
4. Capture modal group caption: include in v1 [default proposal] or skip?

## Definition of done

- `bun run tsc`, `bun run lint`, `bun test`, `bun run build` all clean.
- New spec covers all bucketing edge cases listed above.
- Settings tab visually groups definitions; collapse/expand persists across
  reloads.
- Dragging a definition across group boundaries reassigns its group.
- Capture modal shows the group caption for grouped properties (if v1
  question #4 = include).
- Docs updated (README, docs/, Business Rules, history).
- Manual UI verification noted in history file — cannot self-test
  Obsidian UI from CLI.
