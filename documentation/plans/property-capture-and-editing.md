# Property Capture and Editing Feature Plan

## Goal

Enable effortless, error-free property data capture across notes with validation, suggestions, and inline editing.

---

## Feature Summary

1. **Property Definition System** - Configure trackable properties with types, defaults, and constraints
2. **Capture Command** - Quick-access dialog to fill properties for current note or batch-process notes with issues
3. **Table View** - Spreadsheet-style editing across all notes
4. **Grid View** - Card-based editing with one card per note

---

## 1. Property Definition System

### Data Model

```typescript
// src/app/types/property-definition.types.ts

export type PropertyType =
    | 'text' // Free text or constrained to allowed values
    | 'number' // Numeric with optional min/max/step
    | 'boolean' // true/false toggle
    | 'date' // Date picker (YYYY-MM-DD)
    | 'datetime' // Date + time picker
    | 'list' // Multi-value (array of strings)
    | 'tags' // Obsidian tags (#tag format)

export interface NumberConstraint {
    min?: number
    max?: number
    step?: number // For slider/stepper UI
}

export interface PropertyDefinition {
    id: string // UUID
    name: string // Frontmatter key (exact match)
    type: PropertyType
    displayLabel?: string // UI label (defaults to name)
    description?: string // Help text shown in capture dialog
    defaultValue?: unknown // Applied when creating/resetting
    required?: boolean // Highlight when missing
    allowedValues?: string[] // For text/list: constrain input
    numberConstraint?: NumberConstraint // For number type
    order: number // Display order (0 = first)
}
```

### Settings Tab UI

Location: `src/app/settings/settings-tab.ts`

**Section: "Property Definitions"**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Property Definitions                                                │
│ Define properties to track. These determine what appears in the     │
│ capture dialog and editing views.                                   │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⋮⋮ energy_level                                           [🗑️] │ │
│ │    Type: number  |  Default: 5  |  Range: 1-10                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⋮⋮ mood                                                   [🗑️] │ │
│ │    Type: text  |  Allowed: great, good, okay, bad               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ ⋮⋮ tags                                                   [🗑️] │ │
│ │    Type: tags  |  Suggestions: work, personal, health           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ [+ Add property definition]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Add/Edit Property Dialog** (inline expansion or modal):

```
┌─────────────────────────────────────────────────────────────────────┐
│ Property name:    [energy_level        ]  (frontmatter key)         │
│ Display label:    [Energy Level        ]  (optional, for UI)        │
│ Type:             [▼ number            ]                            │
│                                                                     │
│ ── Number options ──────────────────────────────────────────────── │
│ Min: [1    ]  Max: [10   ]  Step: [1    ]                          │
│ Default value: [5    ]                                              │
│                                                                     │
│ ☑ Required (highlight when missing)                                 │
│                                                                     │
│ Description:      [How energetic do you feel? (1=exhausted, 10=... │
└─────────────────────────────────────────────────────────────────────┘
```

**Type-specific constraint UI:**

| Type          | Constraint UI                                            |
| ------------- | -------------------------------------------------------- |
| text          | Allowed values: comma-separated input or tag-style chips |
| number        | Min, Max, Step number inputs                             |
| boolean       | (no constraints, just default: true/false toggle)        |
| date/datetime | (no constraints, just default date picker)               |
| list          | Allowed values: comma-separated (for suggestions)        |
| tags          | Allowed values: tag suggestions (optional)               |

**Drag-to-reorder:** ⋮⋮ handle on left for reordering definitions

---

## 2. Capture Command & Dialog

### Command Registration

Location: `src/app/commands/capture-command.ts`

```typescript
plugin.addCommand({
    id: 'capture-properties',
    name: 'Capture properties',
    checkCallback: (checking) => {
        // Available when: active file exists OR in table/grid view
        const context = detectContext(plugin)
        if (checking) return context !== null
        openCaptureModal(plugin, context)
        return true
    }
})
```

### Context Detection

```typescript
interface CaptureContext {
    mode: 'single-note' | 'batch'

    // Single note mode
    file?: TFile

    // Batch mode (from base view)
    files?: TFile[] // All files with issues
    currentIndex?: number // Which file we're viewing
}

function detectContext(plugin: LifeTrackerPlugin): CaptureContext | null {
    const app = plugin.app

    // Check if we're in a Table or Grid view
    const activeView =
        app.workspace.getActiveViewOfType(LifeTrackerTableView) ??
        app.workspace.getActiveViewOfType(LifeTrackerGridView)

    if (activeView) {
        // Batch mode: get files with missing/invalid properties
        const files = activeView.getFilesWithPropertyIssues()
        if (files.length > 0) {
            return { mode: 'batch', files, currentIndex: 0 }
        }
    }

    // Single note mode: use active file
    const file = app.workspace.getActiveFile()
    if (file) {
        return { mode: 'single-note', file }
    }

    return null
}
```

### Capture Modal UI

**Single Note Mode:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Capture: daily-2024-01-15.md                                   [×] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Energy Level *                                                      │
│ How energetic do you feel?                                          │
│ ┌──────────────────────────────────────────┐                       │
│ │ ●━━━━━━━━━━━━━━━━━━━━━━━○ │  [7]         │  ← Slider + input     │
│ └──────────────────────────────────────────┘                       │
│                                                                     │
│ Mood *                                                              │
│ ┌──────────────────────────────────────────┐                       │
│ │ good                              [▼]    │  ← Dropdown            │
│ └──────────────────────────────────────────┘                       │
│                                                                     │
│ Tags                                                                │
│ ┌──────────────────────────────────────────┐                       │
│ │ #work  #meeting  [×]              [+]    │  ← Tag chips           │
│ └──────────────────────────────────────────┘                       │
│                                                                     │
│ Notes                                                               │
│ ┌──────────────────────────────────────────┐                       │
│ │ Had a productive morning...              │  ← Text area           │
│ └──────────────────────────────────────────┘                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                    [Reset]  [Save]                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Batch Mode (additional navigation):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ [←] [→]  1 of 12 notes with issues                             [×] │
│ daily-2024-01-15.md                                                 │
├─────────────────────────────────────────────────────────────────────┤
│ ... same form ...                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                        [Reset]  [Save]  [Save & Next →]             │
└─────────────────────────────────────────────────────────────────────┘
```

### Modal Behavior

| Action           | Behavior                                                  |
| ---------------- | --------------------------------------------------------- |
| **Save**         | Write to frontmatter, keep modal open, show success flash |
| **Save & Next**  | Save, advance to next note (batch mode only)              |
| **Reset**        | Revert to values loaded when modal opened                 |
| **[×] / Escape** | If dirty: confirm discard. If clean: close                |
| **[←] / [→]**    | Navigate notes. If dirty: confirm discard first           |

### Visual Feedback

- **Required field missing:** Red border + "Required" label
- **Invalid value:** Red border + error message below input
- **Dirty field:** Subtle dot indicator next to label
- **Save success:** Green flash on modal header

---

## 3. Table View (Base View Type)

### View Registration

```typescript
// src/app/plugin.ts
this.registerBasesView('life-tracker-table', {
    name: 'Life Tracker Table',
    icon: 'table',
    factory: (controller, containerEl) => new LifeTrackerTableView(controller, containerEl, this),
    options: getTableViewOptions
})
```

### Table Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Columns: ▼ All properties]  [Show: ▼ All notes | Notes with issues]            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Note              │ Energy │ Mood    │ Tags           │ Notes      │ Actions    │
├───────────────────┼────────┼─────────┼────────────────┼────────────┼────────────┤
│ 📄 daily-01-15    │ [7━━]  │ [good▼] │ #work #meeting │ Had a pr...│ [💾] [↩️]  │
│ 📄 daily-01-14    │ [5━━]  │ [▼    ] │                │            │ [💾] [↩️]  │  ← Missing mood (red border)
│ 📄 daily-01-13    │ [━━━]  │ [bad ▼] │ #health        │ Felt sick  │ [💾] [↩️]  │  ← Missing energy
└───────────────────┴────────┴─────────┴────────────────┴────────────┴────────────┘
```

### Cell Editing Behavior

| Property Type       | Edit Widget                                |
| ------------------- | ------------------------------------------ |
| text (constrained)  | Dropdown with allowed values               |
| text (free)         | Inline text input                          |
| number (with range) | Inline slider OR number input with stepper |
| number (free)       | Number input                               |
| boolean             | Checkbox or toggle                         |
| date                | Date picker popup                          |
| list/tags           | Pill editor with autocomplete              |

**Cell States:**

- **Display mode:** Shows value (click to edit)
- **Edit mode:** Shows appropriate widget
- **Invalid:** Red background tint
- **Dirty:** Blue left border
- **Missing required:** Yellow background tint

**Keyboard Navigation:**

- **Tab:** Move to next cell (wrap to next row)
- **Shift+Tab:** Move to previous cell
- **Enter:** Confirm edit, move down
- **Escape:** Cancel edit, revert to original

### Row Actions

| Button   | State                 | Action                               |
| -------- | --------------------- | ------------------------------------ |
| 💾 Save  | Disabled if not dirty | Write all dirty cells to frontmatter |
| ↩️ Reset | Disabled if not dirty | Revert all cells to original values  |

---

## 4. Grid View (Base View Type)

### View Registration

```typescript
// src/app/plugin.ts
this.registerBasesView('life-tracker-grid', {
    name: 'Life Tracker Grid',
    icon: 'layout-grid',
    factory: (controller, containerEl) => new LifeTrackerGridView(controller, containerEl, this),
    options: getGridViewOptions
})
```

### Grid Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Columns: 2 ▼]  [Show: ▼ All notes | Notes with issues]                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────┐  ┌────────────────────────────────┐          │
│ │ 📄 daily-2024-01-15            │  │ 📄 daily-2024-01-14            │          │
│ ├────────────────────────────────┤  ├────────────────────────────────┤          │
│ │ Energy Level   [●━━━━━━━○] 7   │  │ Energy Level   [━━━━━━━━━]     │  ← Missing│
│ │ Mood           [good      ▼]   │  │ Mood           [okay      ▼]   │          │
│ │ Tags           #work #meeting  │  │ Tags           #personal       │          │
│ │ Notes          Had a prod...   │  │ Notes          Relaxed day     │          │
│ ├────────────────────────────────┤  ├────────────────────────────────┤          │
│ │              [Reset] [Save]    │  │              [Reset] [Save]    │          │
│ └────────────────────────────────┘  └────────────────────────────────┘          │
│                                                                                  │
│ ┌────────────────────────────────┐  ┌────────────────────────────────┐          │
│ │ 📄 daily-2024-01-13            │  │ ...                            │          │
│ │ ...                            │  │                                │          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Card Behavior

- Same editing widgets as Table view
- Click property value to edit inline
- Card header links to open note
- Footer shows Save/Reset (disabled when clean)
- Visual indicators: dirty (blue border), invalid (red tint), missing (yellow tint)

---

## 5. Shared Editing Infrastructure

### Property Editor Factory

Location: `src/app/components/editing/property-editor.ts`

```typescript
interface PropertyEditorConfig {
    definition: PropertyDefinition
    value: unknown
    onChange: (value: unknown) => void
    onCommit?: () => void // Called on blur/enter
    compact?: boolean // For table cells
}

function createPropertyEditor(config: PropertyEditorConfig): PropertyEditor

interface PropertyEditor {
    render(container: HTMLElement): void
    getValue(): unknown
    setValue(value: unknown): void
    focus(): void
    destroy(): void
}
```

### Editor Implementations

| File                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `text-editor.ts`    | Text input with optional dropdown for allowed values   |
| `number-editor.ts`  | Number input with optional slider for ranges           |
| `boolean-editor.ts` | Toggle switch                                          |
| `date-editor.ts`    | Date picker (uses Obsidian's date picker if available) |
| `list-editor.ts`    | Pill/chip editor with autocomplete suggestions         |

### Text Editor with Allowed Values

```typescript
// If allowedValues defined: render as dropdown/combobox
// If no allowedValues: render as plain input

class TextEditor implements PropertyEditor {
    render(container: HTMLElement): void {
        if (this.config.definition.allowedValues?.length) {
            this.renderDropdown(container)
        } else {
            this.renderInput(container)
        }
    }

    private renderDropdown(container: HTMLElement): void {
        // Native <select> or custom dropdown
        // Options: only allowed values
        // No free text input
    }
}
```

### Number Editor with Range

```typescript
class NumberEditor implements PropertyEditor {
    render(container: HTMLElement): void {
        const constraint = this.config.definition.numberConstraint

        if (constraint?.min !== undefined && constraint?.max !== undefined) {
            // Range defined: show slider + number input
            this.renderSlider(container, constraint)
        } else {
            // Free number: just input with optional min/max/step
            this.renderInput(container, constraint)
        }
    }

    private renderSlider(container: HTMLElement, constraint: NumberConstraint): void {
        // <input type="range"> + <input type="number">
        // Synchronized values
        // Step from constraint or default to 1
    }
}
```

### Dirty State Service

Location: `src/app/components/editing/dirty-state.service.ts`

```typescript
class DirtyStateService {
    private entries = new Map<string, EntryState>()

    // Track a new entry
    track(entryId: string, originalValues: Record<string, unknown>): void

    // Update a single property value
    update(entryId: string, propertyName: string, value: unknown): void

    // Check if entry has changes
    isDirty(entryId: string): boolean

    // Check if specific property changed
    isPropertyDirty(entryId: string, propertyName: string): boolean

    // Get all changed properties
    getChanges(entryId: string): Record<string, unknown> | null

    // Reset to original
    reset(entryId: string): Record<string, unknown>

    // Mark as saved (original = current)
    markSaved(entryId: string): void

    // Subscribe to dirty state changes
    onChange(callback: (entryId: string, isDirty: boolean) => void): () => void
}
```

### Frontmatter Service

Location: `src/app/services/frontmatter.service.ts`

```typescript
class FrontmatterService {
    constructor(private app: App) {}

    // Read properties from file frontmatter
    async read(file: TFile): Promise<Record<string, unknown>>

    // Write properties to file frontmatter
    async write(file: TFile, values: Record<string, unknown>): Promise<void>

    // Validate value against definition
    validate(value: unknown, definition: PropertyDefinition): ValidationResult

    // Check if file has property issues (missing required, invalid values)
    hasIssues(frontmatter: Record<string, unknown>, definitions: PropertyDefinition[]): boolean

    // Get detailed issues for a file
    getIssues(
        frontmatter: Record<string, unknown>,
        definitions: PropertyDefinition[]
    ): PropertyIssue[]
}

interface ValidationResult {
    valid: boolean
    error?: string // "Value must be between 1 and 10"
}

interface PropertyIssue {
    propertyName: string
    type: 'missing' | 'invalid'
    message: string
}
```

**Write implementation using Obsidian API:**

```typescript
async write(file: TFile, values: Record<string, unknown>): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
        for (const [key, value] of Object.entries(values)) {
            if (value === null || value === undefined || value === '') {
                delete fm[key]
            } else {
                fm[key] = value
            }
        }
    })
}
```

---

## 6. Validation Logic

### Validation Rules

| Type               | Validation                                             |
| ------------------ | ------------------------------------------------------ |
| text (constrained) | Value must be in allowedValues array                   |
| text (free)        | Any string (no validation)                             |
| number             | Must be numeric; if range defined: min <= value <= max |
| boolean            | Must be true or false                                  |
| date               | Must be valid date string (YYYY-MM-DD)                 |
| list               | Each item must be in allowedValues (if defined)        |
| tags               | Each tag must start with #                             |

### Visual Indicators

```css
/* Invalid value */
.lt-editor--invalid {
    border-color: var(--text-error);
    background-color: rgba(var(--color-red-rgb), 0.1);
}

/* Missing required */
.lt-editor--missing {
    border-color: var(--text-warning);
    background-color: rgba(var(--color-yellow-rgb), 0.1);
}

/* Dirty (changed) */
.lt-editor--dirty {
    border-left: 3px solid var(--interactive-accent);
}
```

---

## 7. File Structure

### New Files

```
src/app/
├── commands/
│   ├── index.ts                           # registerCommands()
│   └── capture-command.ts                 # Capture command
├── components/
│   ├── editing/
│   │   ├── property-editor.ts             # Factory + interface
│   │   ├── text-editor.ts                 # Text/dropdown editor
│   │   ├── number-editor.ts               # Number/slider editor
│   │   ├── boolean-editor.ts              # Toggle editor
│   │   ├── date-editor.ts                 # Date picker editor
│   │   ├── list-editor.ts                 # Pill/chip editor
│   │   ├── dirty-state.service.ts         # Track changes
│   │   └── validation.utils.ts            # Validation helpers
│   └── modals/
│       └── property-capture-modal.ts      # Capture dialog
├── services/
│   └── frontmatter.service.ts             # Read/write frontmatter
├── types/
│   └── property-definition.types.ts       # PropertyDefinition types
└── view/
    ├── table-view/
    │   ├── table-view.ts                  # BasesView implementation
    │   └── table-view-options.ts          # View options
    └── grid-view/
        ├── grid-view.ts                   # BasesView implementation
        └── grid-view-options.ts           # View options
```

### Modified Files

| File                                    | Changes                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `src/app/plugin.ts`                     | Register commands, register new view types                    |
| `src/app/types/plugin-settings.intf.ts` | Add `propertyDefinitions: Record<string, PropertyDefinition>` |
| `src/app/settings/settings-tab.ts`      | Add property definitions management UI                        |
| `src/styles.src.css`                    | Add styles for editors, table, grid, modal                    |
| `documentation/Architecture.md`         | Document new components                                       |
| `documentation/Domain Model.md`         | Add PropertyDefinition types                                  |

---

## 8. Implementation Order

### Phase 1: Foundation

1. Create `property-definition.types.ts`
2. Update `plugin-settings.intf.ts`
3. Update `plugin.ts` to handle new settings field
4. Add property definitions UI to settings tab

### Phase 2: Core Services

5. Create `frontmatter.service.ts`
6. Create `dirty-state.service.ts`
7. Create `validation.utils.ts`

### Phase 3: Editors

8. Create `property-editor.ts` (factory + interface)
9. Create `text-editor.ts`
10. Create `number-editor.ts`
11. Create `boolean-editor.ts`
12. Create `date-editor.ts`
13. Create `list-editor.ts`

### Phase 4: Capture Command

14. Create `commands/index.ts`
15. Create `capture-command.ts`
16. Create `property-capture-modal.ts`
17. Wire up command in plugin

### Phase 5: Table View

18. Create `table-view-options.ts`
19. Create `table-view.ts`
20. Register in plugin

### Phase 6: Grid View

21. Create `grid-view-options.ts`
22. Create `grid-view.ts`
23. Register in plugin

### Phase 7: Polish

24. Add all CSS styles
25. Test keyboard navigation
26. Test edge cases (empty values, very long values, etc.)
27. Update documentation

---

## 9. Key UX Principles

1. **Zero friction input:** Constrained properties only show valid options - no typing errors possible
2. **Clear visual feedback:** Dirty, invalid, missing states are immediately visible
3. **Non-destructive:** Reset always available; unsaved changes prompt before navigation
4. **Batch efficiency:** Navigate between notes with issues without closing modal
5. **Consistent editing:** Same widgets work in modal, table, and grid
6. **Keyboard-friendly:** Tab navigation, Enter to confirm, Escape to cancel
7. **Context-aware:** Command works from note or base view with appropriate UI

---

## 10. Business Rules (to add to documentation/Business Rules.md)

- Property definitions are stored in plugin settings (global across views)
- Property name matching is case-insensitive
- Constrained properties (with allowedValues) must only accept valid values
- Invalid values already present in notes are highlighted but preserved until explicitly changed
- Required properties show visual indicator when missing
- Save operation writes to frontmatter immediately (no batch save across notes)
