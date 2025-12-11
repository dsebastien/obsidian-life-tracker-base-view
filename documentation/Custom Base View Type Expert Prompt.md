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
this.registerBasesView('my-view-id', {
    name: 'My View', // Display name in view selector
    icon: 'layout-grid', // Lucide icon name
    factory: (controller, containerEl) => new MyView(controller, containerEl, this),
    options: MyView.getViewOptions // Optional: user-configurable options
})
```

Returns `false` if Bases not enabled in vault.

## View Class Structure

```typescript
import { BasesView, QueryController, BasesPropertyId, Value } from 'obsidian'

export class MyView extends BasesView {
    type = 'my-view-id' // Must match registered ID

    private containerEl: HTMLElement

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: MyPlugin) {
        super(controller)
        this.containerEl = scrollEl.createDiv({ cls: 'my-view-container' })
    }

    // REQUIRED: Called when data changes - main render logic
    override onDataUpdated(): void {
        this.containerEl.empty()

        // Access query results
        const entries = this.data.data // BasesEntry[]
        const groups = this.data.groupedData // BasesEntryGroup[] (if groupBy configured)
        const properties = this.config.getOrder() // Visible properties in order

        // Render each entry
        for (const entry of entries) {
            const file = entry.file // TFile

            for (const propId of properties) {
                const value = entry.getValue(propId) // Value | null
                const displayName = this.config.getDisplayName(propId)

                // Check value type
                if (value instanceof BooleanValue) {
                    /* ... */
                }
                if (value instanceof NumberValue) {
                    /* ... */
                }
                if (value instanceof ListValue) {
                    /* ... */
                }

                // Extract primitives
                const str = value?.toString() ?? ''
                const truthy = value?.isTruthy() ?? false
            }
        }
    }

    // Optional: cleanup
    override onunload(): void {
        // Destroy charts, remove listeners, etc.
    }

    // Optional: user-configurable options
    static getViewOptions(): ViewOption[] {
        return [
            {
                type: 'slider',
                key: 'cellSize',
                displayName: 'Cell size',
                min: 8,
                max: 24,
                step: 2,
                default: 12
            },
            {
                type: 'dropdown',
                key: 'mode',
                displayName: 'Display mode',
                default: 'compact',
                options: { compact: 'Compact', expanded: 'Expanded' }
            },
            {
                type: 'property',
                key: 'dateProperty',
                displayName: 'Date property',
                placeholder: 'Select property',
                filter: (prop) => !prop.startsWith('file.')
            },
            {
                type: 'toggle',
                key: 'showLabels',
                displayName: 'Show labels',
                default: true
            },
            {
                type: 'group',
                displayName: 'Advanced',
                items: [
                    /* nested options */
                ]
            }
        ]
    }
}
```

## Accessing Configuration

```typescript
// In onDataUpdated() or other methods
const cellSize = this.config.get('cellSize') as number
const mode = this.config.get('mode') as string
const dateProp = this.config.getAsPropertyId('dateProperty') // BasesPropertyId | null
const order = this.config.getOrder() // Visible property order
const sort = this.config.getSort() // BasesSortConfig[]
const name = this.config.getDisplayName(propId) // User-friendly name
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

function extractValue(value: Value | null): unknown {
    if (!value || value instanceof NullValue) return null

    if (value instanceof BooleanValue) {
        return value.isTruthy()
    }
    if (value instanceof NumberValue) {
        return parseFloat(value.toString())
    }
    if (value instanceof DateValue) {
        // DateValue has internal date representation
        return new Date(value.toString())
    }
    if (value instanceof ListValue) {
        const items: string[] = []
        // ListValue is iterable or has length()/get(i) methods
        for (let i = 0; i < value.length(); i++) {
            const item = value.get(i)
            if (item) items.push(item.toString())
        }
        return items
    }

    return value.toString()
}
```

## Date Anchoring Strategy

For time-based visualizations, extract dates in priority order:

1. **Filename patterns**: `YYYY-MM-DD`, `YYYY-Www`, `YYYY-MM`, `YYYY-Qq`
2. **Note properties**: `date`, `created`, `updated` (via `entry.getValue('note.date')`)
3. **File metadata**: `entry.file.stat.ctime`, `entry.file.stat.mtime`

```typescript
function resolveDateAnchor(entry: BasesEntry): Date | null {
    // 1. Try filename
    const filename = entry.file.basename
    const dailyMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (dailyMatch) {
        return new Date(
            parseInt(dailyMatch[1]!),
            parseInt(dailyMatch[2]!) - 1,
            parseInt(dailyMatch[3]!)
        )
    }

    // 2. Try properties
    const dateValue = entry.getValue('note.date')
    if (dateValue instanceof DateValue) {
        return new Date(dateValue.toString())
    }

    // 3. Fallback to file metadata
    return new Date(entry.file.stat.ctime)
}
```

## Lifecycle & Cleanup

BasesView extends Component. Use register methods for automatic cleanup:

```typescript
override onload(): void {
    // Register event listeners (auto-cleaned on unload)
    this.registerEvent(
        this.app.workspace.on('css-change', () => this.handleThemeChange())
    )

    this.registerDomEvent(window, 'resize', () => this.handleResize())

    this.registerInterval(window.setInterval(() => this.poll(), 5000))
}

override onunload(): void {
    // Explicit cleanup if needed (charts, external resources)
    this.chart?.destroy()
}
```

## Property ID Format

```typescript
type BasesPropertyId = `${BasesPropertyType}.${string}`
type BasesPropertyType = 'note' | 'formula' | 'file'

// Examples:
;('note.slept_well') // Frontmatter property
;('file.name') // File metadata
;('formula.total') // Computed formula
```

## Key APIs Summary

| Class/Type         | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `BasesView`        | Abstract base class for custom views                                |
| `BasesEntry`       | Single row/file with `getValue(propId)` and `file: TFile`           |
| `BasesQueryResult` | Query results: `data`, `groupedData`, `properties`                  |
| `BasesViewConfig`  | View config: `get()`, `getOrder()`, `getSort()`, `getDisplayName()` |
| `QueryController`  | Query executor (passed to constructor)                              |
| `Value`            | Base class for property values                                      |
| `ViewOption`       | Configuration option definition                                     |

## ViewOption Types

- `slider`: numeric with min/max/step
- `dropdown`: select from options
- `property`: select from available properties
- `toggle`: boolean
- `text`: string input
- `formula`: dynamic expression
- `group`: nested options container

## Best Practices

1. **Clear containerEl on update**: `this.containerEl.empty()` at start of `onDataUpdated()`
2. **Check for undefined**: All property access returns `T | undefined` with strict TS
3. **Use Obsidian CSS vars**: `var(--text-normal)`, `var(--background-primary)` for theming
4. **Respect property order**: Use `this.config.getOrder()` for visible properties
5. **Handle empty state**: Show placeholder when no data
6. **Support embedded views**: Views can be embedded in markdown; handle height constraints
7. **Clean up resources**: Destroy charts, clear intervals in `onunload()`

## File Structure

```
src/
  app/
    plugin.ts                    # Register view in onload()
    view/
      my-view.ts                 # BasesView subclass
      view-options.ts            # getViewOptions() definition
    services/
      data-processor.service.ts  # Data transformation logic
  components/
    visualizations/
      my-visualization.ts        # Rendering component
  utils/
    value-extractors.ts          # Extract primitives from Value types
```
