# Custom Base View Type Expert Prompt

You are an expert at building custom Obsidian Base View types. Follow this guide to create a new Base view plugin.

## Core Concepts

**Bases** = Obsidian's database feature. Queries frontmatter properties across notes.
**BasesView** = Abstract class for rendering Base data in custom ways (like Table, Cards, etc.)
**BasesEntry** = Single row/file in a Base query result.
**Value** = Wrapper type for property values (BooleanValue, NumberValue, DateValue, ListValue, etc.)

## Registration Pattern

```typescript
// In Plugin.onload()
const registered = this.registerBasesView('my-view-id', {
    name: 'My View', // Display name in view selector
    icon: 'layout-grid', // Lucide icon name
    factory: (controller, containerEl) => new MyView(controller, containerEl, this),
    options: getMyViewOptions // Optional: user-configurable options function
})

if (!registered) {
    console.warn('Bases feature is not enabled in this vault')
}
```

Returns `false` if Bases not enabled in vault.

## View Class Structure

```typescript
import {
    BasesView,
    QueryController,
    BasesPropertyId,
    Value,
    BooleanValue,
    NumberValue,
    ListValue
} from 'obsidian'

export const MY_VIEW_TYPE = 'my-view-id'

export class MyView extends BasesView {
    type = MY_VIEW_TYPE // Must match registered ID

    private plugin: MyPlugin
    private containerEl: HTMLElement

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: MyPlugin) {
        super(controller)
        this.plugin = plugin
        this.containerEl = scrollEl.createDiv({ cls: 'my-view-container' })
    }

    // REQUIRED: Called when data changes - main render logic
    override onDataUpdated(): void {
        this.containerEl.empty()

        // Access query results
        const entries = this.data.data // BasesEntry[]
        const groups = this.data.groupedData // BasesEntryGroup[] (if groupBy configured)
        const properties = this.config.getOrder() // Visible properties in order

        // Handle empty state
        if (entries.length === 0) {
            this.containerEl.createDiv({
                cls: 'my-view-empty',
                text: 'No data available'
            })
            return
        }

        // Render each entry
        for (const entry of entries) {
            const file = entry.file // TFile

            for (const propId of properties) {
                const value = entry.getValue(propId) // Value | null
                const displayName = this.config.getDisplayName(propId)

                // Check value type and process accordingly
                if (value instanceof BooleanValue) {
                    const boolVal = value.isTruthy()
                    // Handle boolean...
                }
                if (value instanceof NumberValue) {
                    const numVal = parseFloat(value.toString())
                    // Handle number...
                }
                if (value instanceof ListValue) {
                    const items = this.extractListItems(value)
                    // Handle list...
                }

                // Generic string extraction
                const str = value?.toString() ?? ''
            }
        }
    }

    private extractListItems(value: ListValue): string[] {
        const items: string[] = []
        for (let i = 0; i < value.length(); i++) {
            const item = value.get(i)
            if (item) items.push(item.toString())
        }
        return items
    }

    // Optional: cleanup resources
    override onunload(): void {
        // Destroy any external resources (charts, listeners, etc.)
    }
}
```

## View Options Definition

Define user-configurable options in a separate function:

```typescript
import type { ViewOption } from 'obsidian'

export function getMyViewOptions(): ViewOption[] {
    return [
        // Slider option
        {
            type: 'slider',
            key: 'itemSize',
            displayName: 'Item size',
            min: 8,
            max: 48,
            step: 4,
            default: 16
        },

        // Dropdown option
        {
            type: 'dropdown',
            key: 'layout',
            displayName: 'Layout mode',
            default: 'grid',
            options: {
                grid: 'Grid',
                list: 'List',
                compact: 'Compact'
            }
        },

        // Property selector
        {
            type: 'property',
            key: 'groupByProperty',
            displayName: 'Group by',
            placeholder: 'Select property',
            filter: (prop) => !prop.startsWith('file.') // Optional filter
        },

        // Toggle option
        {
            type: 'toggle',
            key: 'showLabels',
            displayName: 'Show labels',
            default: true
        },

        // Text input
        {
            type: 'text',
            key: 'customPrefix',
            displayName: 'Custom prefix',
            placeholder: 'Enter prefix...'
        },

        // Grouped options (collapsible section)
        {
            type: 'group',
            displayName: 'Advanced Options',
            items: [
                {
                    type: 'toggle',
                    key: 'debugMode',
                    displayName: 'Debug mode',
                    default: false
                },
                {
                    type: 'slider',
                    key: 'maxItems',
                    displayName: 'Max items',
                    min: 10,
                    max: 1000,
                    step: 10,
                    default: 100
                }
            ]
        }
    ]
}
```

## Accessing Configuration

```typescript
// In onDataUpdated() or other methods
override onDataUpdated(): void {
    // Get option values with type assertions
    const itemSize = (this.config.get('itemSize') as number) ?? 16
    const layout = (this.config.get('layout') as string) ?? 'grid'
    const showLabels = (this.config.get('showLabels') as boolean) ?? true

    // Get property selector as BasesPropertyId
    const groupByProp = this.config.getAsPropertyId('groupByProperty') // BasesPropertyId | null

    // Get ordered visible properties
    const visibleProperties = this.config.getOrder() // BasesPropertyId[]

    // Get sort configuration
    const sortConfig = this.config.getSort() // BasesSortConfig[]

    // Get display name for a property (respects user renames)
    const friendlyName = this.config.getDisplayName(propId)

    // Get view name
    const viewName = this.config.name
}
```

## Storing Custom View State

Use `config.set()` to persist view-specific state:

```typescript
// Save custom configuration
private saveMyConfig(key: string, value: unknown): void {
    this.config.set(key, value)
}

// Example: storing column-specific settings
private saveColumnSettings(columnId: string, settings: ColumnSettings): void {
    const allSettings = (this.config.get('columnSettings') as Record<string, ColumnSettings>) ?? {}
    allSettings[columnId] = settings
    this.config.set('columnSettings', allSettings)
}

// Reading back
const columnSettings = (this.config.get('columnSettings') as Record<string, ColumnSettings>) ?? {}
```

## Value Type Extraction

```typescript
import {
    Value,
    BooleanValue,
    NumberValue,
    DateValue,
    ListValue,
    StringValue,
    NullValue
} from 'obsidian'

function extractPrimitiveValue(value: Value | null): unknown {
    if (!value || value instanceof NullValue) return null

    if (value instanceof BooleanValue) {
        return value.isTruthy()
    }
    if (value instanceof NumberValue) {
        return parseFloat(value.toString())
    }
    if (value instanceof DateValue) {
        return new Date(value.toString())
    }
    if (value instanceof ListValue) {
        const items: string[] = []
        for (let i = 0; i < value.length(); i++) {
            const item = value.get(i)
            if (item) items.push(item.toString())
        }
        return items
    }

    // StringValue or other types
    return value.toString()
}

// Type detection helper
function detectValueType(
    value: Value | null
): 'boolean' | 'number' | 'date' | 'list' | 'string' | 'null' {
    if (!value || value instanceof NullValue) return 'null'
    if (value instanceof BooleanValue) return 'boolean'
    if (value instanceof NumberValue) return 'number'
    if (value instanceof DateValue) return 'date'
    if (value instanceof ListValue) return 'list'
    return 'string'
}
```

## Property ID Format

```typescript
type BasesPropertyId = `${BasesPropertyType}.${string}`
type BasesPropertyType = 'note' | 'formula' | 'file'

// Examples:
;('note.status') // Frontmatter property
;('note.tags') // Frontmatter tags
;('file.name') // File name
;('file.ctime') // File creation time
;('file.mtime') // File modification time
;('file.path') // File path
;('formula.total') // Computed formula column
```

## Lifecycle & Cleanup

BasesView extends Component. Use register methods for automatic cleanup:

```typescript
constructor(controller: QueryController, scrollEl: HTMLElement, plugin: MyPlugin) {
    super(controller)
    // ...

    // Register cleanup callback (called on unload)
    this.register(() => {
        this.customCleanup()
    })
}

override onload(): void {
    // Register event listeners (auto-cleaned on unload)
    this.registerEvent(
        this.app.workspace.on('css-change', () => this.handleThemeChange())
    )

    // Register DOM events (auto-cleaned on unload)
    this.registerDomEvent(window, 'resize', () => this.handleResize())

    // Register intervals (auto-cleaned on unload)
    this.registerInterval(window.setInterval(() => this.poll(), 5000))
}

override onunload(): void {
    // Explicit cleanup for external resources
    this.externalChart?.destroy()
    this.websocket?.close()
}
```

## Opening Files from View

```typescript
// Open a file when user clicks on an entry
private async openFile(entry: BasesEntry): Promise<void> {
    await this.app.workspace.getLeaf().openFile(entry.file)
}

// Open in new tab
private async openFileInNewTab(entry: BasesEntry): Promise<void> {
    await this.app.workspace.getLeaf('tab').openFile(entry.file)
}

// Create a new file for the view
private async createNewEntry(): Promise<void> {
    await this.createFileForView('New Entry', (frontmatter) => {
        frontmatter.status = 'draft'
        frontmatter.created = new Date().toISOString()
    })
}
```

## Handling Grouped Data

```typescript
override onDataUpdated(): void {
    // Check if data is grouped
    if (this.data.groupedData && this.data.groupedData.length > 0) {
        this.renderGroupedData(this.data.groupedData)
    } else {
        this.renderFlatData(this.data.data)
    }
}

private renderGroupedData(groups: BasesEntryGroup[]): void {
    for (const group of groups) {
        const groupEl = this.containerEl.createDiv({ cls: 'my-view-group' })

        // Group header
        groupEl.createDiv({
            cls: 'my-view-group-header',
            text: group.value?.toString() ?? 'Ungrouped'
        })

        // Group entries
        const entriesEl = groupEl.createDiv({ cls: 'my-view-group-entries' })
        for (const entry of group.data) {
            this.renderEntry(entriesEl, entry)
        }
    }
}
```

## Context Menus

```typescript
import { Menu } from 'obsidian'

private showContextMenu(event: MouseEvent, entry: BasesEntry): void {
    const menu = new Menu()

    menu.addItem((item) => {
        item.setTitle('Open')
            .setIcon('file')
            .onClick(() => this.openFile(entry))
    })

    menu.addItem((item) => {
        item.setTitle('Open in new tab')
            .setIcon('file-plus')
            .onClick(() => this.openFileInNewTab(entry))
    })

    menu.addSeparator()

    menu.addItem((item) => {
        item.setTitle('Delete')
            .setIcon('trash')
            .setWarning(true)
            .onClick(() => this.deleteEntry(entry))
    })

    menu.showAtMouseEvent(event)
}
```

## Theming with Obsidian CSS Variables

Always use Obsidian's CSS variables for theme compatibility:

```css
.my-view-container {
    background-color: var(--background-primary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
}

.my-view-item {
    background-color: var(--background-secondary);
    color: var(--text-muted);
}

.my-view-item:hover {
    background-color: var(--background-modifier-hover);
}

.my-view-item--selected {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
}

.my-view-error {
    color: var(--text-error);
}
```

## Key APIs Summary

| Class/Type         | Purpose                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `BasesView`        | Abstract base class for custom views                                         |
| `BasesEntry`       | Single row/file with `getValue(propId)` and `file: TFile`                    |
| `BasesQueryResult` | Query results: `data`, `groupedData`, `properties`                           |
| `BasesViewConfig`  | View config: `get()`, `set()`, `getOrder()`, `getSort()`, `getDisplayName()` |
| `QueryController`  | Query executor (passed to constructor)                                       |
| `Value`            | Base class for property values                                               |
| `ViewOption`       | Configuration option definition                                              |

## ViewOption Types

| Type       | Description                           | Key Properties                  |
| ---------- | ------------------------------------- | ------------------------------- |
| `slider`   | Numeric with min/max/step             | `min`, `max`, `step`, `default` |
| `dropdown` | Select from predefined options        | `options`, `default`            |
| `property` | Select from available Base properties | `placeholder`, `filter`         |
| `toggle`   | Boolean switch                        | `default`                       |
| `text`     | Free-form string input                | `placeholder`                   |
| `formula`  | Dynamic expression input              | -                               |
| `group`    | Nested options container              | `items`                         |

## Best Practices

1. **Clear container on update**: Call `this.containerEl.empty()` at start of `onDataUpdated()`
2. **Handle undefined values**: All property access returns `T | undefined` with strict TypeScript
3. **Use Obsidian CSS variables**: Ensures compatibility with all themes (light/dark)
4. **Respect property order**: Use `this.config.getOrder()` for visible properties
5. **Handle empty state**: Show helpful placeholder when no data matches query
6. **Support embedded views**: Views can be embedded in markdown; handle height/width constraints
7. **Clean up resources**: Destroy external resources (charts, websockets) in `onunload()`
8. **Use register helpers**: `registerEvent()`, `registerDomEvent()`, `registerInterval()` for auto-cleanup
9. **Debounce expensive operations**: Especially for resize handlers or frequent updates
10. **Log for debugging**: Use console.debug() during development, remove in production

## Recommended File Structure

```
src/
  main.ts                        # Re-export plugin class
  app/
    plugin.ts                    # Register view in onload()
    view/
      my-view.ts                 # BasesView subclass
      view-options.ts            # getViewOptions() definition
    types/
      my-types.ts                # TypeScript interfaces
    services/
      data-processor.service.ts  # Data transformation logic
  components/
    my-component.ts              # Reusable UI components
  utils/
    helpers.ts                   # Utility functions
  styles.src.css                 # Styles (use Tailwind + Obsidian vars)
```

## Common Patterns

### Responding to Settings Changes

```typescript
// In plugin.ts - notify views when global settings change
async updateSettings(updater: (draft: Draft<Settings>) => void): Promise<void> {
    this.settings = produce(this.settings, updater)
    await this.saveSettings()
    this.notifySettingsChanged() // Trigger view refresh
}

// In view constructor - subscribe to settings changes
this.unsubscribe = this.plugin.onSettingsChange(() => {
    this.onDataUpdated() // Re-render view
})

// In view onunload - cleanup subscription
override onunload(): void {
    this.unsubscribe?.()
}
```

### Keyboard Shortcuts

```typescript
constructor(...) {
    // ...
    this.registerDomEvent(this.containerEl, 'keydown', (e) => {
        if (e.key === 'Escape') {
            this.handleEscape()
        }
        if (e.key === 'Enter' && e.ctrlKey) {
            this.handleSubmit()
        }
    })
}
```

### Drag and Drop

```typescript
private setupDragAndDrop(element: HTMLElement, entry: BasesEntry): void {
    element.draggable = true

    element.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', entry.file.path)
    })

    element.addEventListener('dragover', (e) => {
        e.preventDefault()
        element.classList.add('drag-over')
    })

    element.addEventListener('drop', (e) => {
        e.preventDefault()
        const path = e.dataTransfer?.getData('text/plain')
        // Handle drop...
    })
}
```
