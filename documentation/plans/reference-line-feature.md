# Reference Line Feature Implementation Plan

## Overview

Add a reference line feature to cartesian charts (Line, Bar, Area) to help users track values against target goals. For example, when tracking weight, users can add a horizontal line at their target weight to easily see if they're above or below the goal.

## User Requirements

- Per-property configuration (each property has its own reference line setting)
- Works with overlay visualizations (multiple properties = multiple reference lines)
- Visual: Dashed horizontal line with label (e.g., "Target: 75")
- Supported charts: Line, Bar, Area only
- Disabled by default (opt-in feature)

## Implementation Steps

### 1. Add Dependency

**File:** `package.json`

Add to dependencies:

```json
"chartjs-plugin-annotation": "^3.0.1"
```

Run: `bun install`

### 2. Register Annotation Plugin

**File:** `src/app/services/chart-loader.service.ts`

Update `loadAndRegister()` method (lines 45-58):

```typescript
private static async loadAndRegister(): Promise<typeof import('chart.js')> {
    log('Loading Chart.js...', 'debug')
    const startTime = performance.now()

    const module = await import('chart.js')

    // Import and register annotation plugin
    const annotationPlugin = await import('chartjs-plugin-annotation')
    module.Chart.register(...module.registerables, annotationPlugin.default)

    const loadTime = performance.now() - startTime
    log(`Chart.js loaded and registered in ${loadTime.toFixed(1)}ms`, 'debug')

    return module
}
```

### 3. Define Reference Line Types

**File:** `src/app/types/column/column-config.types.ts`

Add after `ScaleConfig` interface (around line 14):

```typescript
/**
 * Reference line configuration for cartesian charts
 * Displays a horizontal line at a specific Y-axis value (e.g., target/goal)
 */
export interface ReferenceLineConfig {
    /** Whether the reference line is enabled */
    enabled: boolean
    /** The Y-axis value where the line should be drawn */
    value: number
    /** Optional custom label (defaults to "Target: {value}") */
    label?: string
}
```

Add support check (around line 85):

```typescript
/**
 * Visualization types that support reference lines (cartesian charts only)
 */
export const REFERENCE_LINE_SUPPORTED_TYPES: VisualizationType[] = [
    VisualizationType.LineChart,
    VisualizationType.BarChart,
    VisualizationType.AreaChart
]

/**
 * Check if a visualization type supports reference lines
 */
export function supportsReferenceLine(vizType: VisualizationType): boolean {
    return REFERENCE_LINE_SUPPORTED_TYPES.includes(vizType)
}
```

Update `ColumnVisualizationConfig` interface (add after line 38):

```typescript
/** Reference line configuration for cartesian charts */
referenceLine?: ReferenceLineConfig
```

Update `OverlayVisualizationConfig` interface (add after line 115):

```typescript
/** Reference line configurations per property ID (for overlays with multiple properties) */
referenceLines?: Record<BasesPropertyId, ReferenceLineConfig>
```

### 4. Update Preset Settings Type

**File:** `src/app/types/plugin/plugin-settings.intf.ts`

Update `PropertyVisualizationPreset` interface (add after line 20):

```typescript
/** Reference line configuration for cartesian charts */
referenceLine?: ReferenceLineConfig
```

Import the type at the top:

```typescript
import type { ScaleConfig, ReferenceLineConfig } from '../column/column-config.types'
```

### 5. Update Chart Initializer

**File:** `src/app/components/visualizations/chart/chart-initializers.ts`

Update `initCartesianChart` signature (line 180):

```typescript
export function initCartesianChart(
    Chart: ChartClass,
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    chartConfig: ChartConfig,
    onClick: (elements: ChartClickElement[]) => void,
    referenceLines?: Array<{ value: number; label: string; color: string }> // NEW
): ChartInstance {
```

Add annotation configuration before `return new Chart(...)` (around line 213):

```typescript
// Build annotation configuration if reference lines exist
const annotations: Record<string, unknown> = {}

if (referenceLines && referenceLines.length > 0) {
    referenceLines.forEach((line, index) => {
        annotations[`referenceLine${index}`] = {
            type: 'line',
            yMin: line.value,
            yMax: line.value,
            borderColor: line.color,
            borderWidth: 2,
            borderDash: [5, 5], // Dashed line
            label: {
                display: true,
                content: line.label,
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                color: 'white',
                font: { size: 11, weight: 'normal' },
                padding: 4,
                borderRadius: 3,
                xAdjust: -10,
                yAdjust: 0
            }
        }
    })
}

return new Chart(ctx, {
    type: chartJsType as ChartType,
    data: {
        labels: chartData.labels,
        datasets
    },
    options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        layout: {
            padding: {
                left: 10,
                right: 60
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: chartConfig.showLegend || datasets.length > 1
            },
            tooltip: {
                enabled: true,
                callbacks: {
                    label: (context: CartesianTooltipContext) => {
                        const label = context.dataset.label ?? ''
                        const value = context.parsed.y
                        if (value === null || value === undefined) return ''
                        return `${label}: ${value.toFixed(2)}`
                    }
                }
            },
            annotation: {
                // ADD THIS
                annotations
            }
        },
        scales: {
            x: {
                display: true,
                offset: true,
                bounds: 'ticks',
                grid: {
                    display: chartConfig.showGrid,
                    offset: true
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkipPadding: 10,
                    includeBounds: true,
                    align: 'center'
                }
            },
            y: {
                display: true,
                beginAtZero: !chartConfig.scale?.min,
                min: chartConfig.scale?.min ?? undefined,
                max: chartConfig.scale?.max ?? undefined,
                grid: {
                    display: chartConfig.showGrid
                }
            }
        },
        onClick: (_event: unknown, elements: ChartClickElement[]) => {
            onClick(elements)
        }
    }
}) as unknown as ChartInstance
```

### 6. Update Chart Visualization Component

**File:** `src/app/components/visualizations/chart/chart-visualization.ts`

Find where `initCartesianChart` is called and add logic to build reference lines array before the call.

For single property charts:

```typescript
const referenceLines: Array<{ value: number; label: string; color: string }> = []

if (config.referenceLine?.enabled) {
    const colors = getChartColorScheme(config.colorScheme)
    const color = colors[0] ?? '#8884d8'
    const label = config.referenceLine.label ?? `Target: ${config.referenceLine.value}`
    referenceLines.push({ value: config.referenceLine.value, label, color })
}

const chart = initCartesianChart(Chart, ctx, chartData, chartConfig, onClick, referenceLines)
```

For overlay charts (if rendering overlays):

```typescript
if (overlayConfig?.referenceLines) {
    const colors = getChartColorScheme(overlayConfig.colorScheme)
    chartData.datasets.forEach((dataset, index) => {
        const propertyId = dataset.propertyId
        const refLineConfig = overlayConfig.referenceLines?.[propertyId]
        if (refLineConfig?.enabled) {
            const color = colors[index % colors.length] ?? '#8884d8'
            const label = refLineConfig.label ?? `${dataset.label}: ${refLineConfig.value}`
            referenceLines.push({ value: refLineConfig.value, label, color })
        }
    })
}
```

### 7. Add UI - Context Menu

**File:** `src/app/components/ui/card-context-menu.ts`

Update `showCardContextMenu` signature (line 50) to add reference line parameter:

```typescript
export function showCardContextMenu(
    event: MouseEvent | TouchEvent,
    currentType: VisualizationType,
    currentScale: ScaleConfig | undefined,
    currentColorScheme: ChartColorScheme | undefined,
    currentHeatmapConfig: HeatmapMenuConfig | undefined,
    currentReferenceLine: ReferenceLineConfig | undefined, // NEW
    isFromPreset: boolean,
    isMaximized: boolean,
    canRemove: boolean,
    onAction: CardMenuCallback
): void
```

In `renderOptionsColumn` function, add reference line UI after color scheme section:

```typescript
// Reference line configuration
if (supportsReferenceLine(vizType)) {
    const refLineGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
    refLineGroup.createEl('label', { text: 'Reference line' })

    const refLineToggle = refLineGroup.createEl('select', { cls: 'lt-card-popover-select' })
    const disabledOption = refLineToggle.createEl('option', { value: 'disabled', text: 'Disabled' })
    const enabledOption = refLineToggle.createEl('option', { value: 'enabled', text: 'Enabled' })

    if (currentReferenceLine?.enabled) {
        enabledOption.selected = true
    } else {
        disabledOption.selected = true
    }

    refLineToggle.addEventListener('change', () => {
        const enabled = refLineToggle.value === 'enabled'
        if (enabled) {
            showReferenceLineModal(currentReferenceLine, (refLine) => {
                close()
                onAction({ type: 'configureReferenceLine', referenceLine: refLine })
            })
        } else {
            close()
            onAction({
                type: 'configureReferenceLine',
                referenceLine: { enabled: false, value: 0 }
            })
        }
    })

    // If enabled, show current value and edit button
    if (currentReferenceLine?.enabled) {
        const refLineValueGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
        const label = currentReferenceLine.label ?? `Target: ${currentReferenceLine.value}`
        refLineValueGroup.createEl('label', { text: `Value: ${label}` })

        const editBtn = refLineValueGroup.createEl('button', {
            cls: 'lt-card-popover-select',
            text: 'Edit'
        })
        editBtn.addEventListener('click', () => {
            showReferenceLineModal(currentReferenceLine, (refLine) => {
                close()
                onAction({ type: 'configureReferenceLine', referenceLine: refLine })
            })
        })
    }
}
```

Add reference line modal function after `showCustomScaleModal` (around line 548):

```typescript
/**
 * Show a modal for reference line configuration
 */
function showReferenceLineModal(
    currentReferenceLine: ReferenceLineConfig | undefined,
    onConfirm: (referenceLine: ReferenceLineConfig) => void
): void {
    const overlay = document.body.createDiv({ cls: 'lt-scale-modal-overlay' })
    const modal = overlay.createDiv({ cls: 'lt-scale-modal' })

    modal.createDiv({ cls: 'lt-scale-modal-header', text: 'Configure reference line' })

    const form = modal.createDiv({ cls: 'lt-scale-modal-form' })

    // Value input
    const valueGroup = form.createDiv({ cls: 'lt-scale-modal-input-group' })
    valueGroup.createSpan({ text: 'Value:' })
    const valueInput = valueGroup.createEl('input', {
        type: 'number',
        cls: 'lt-scale-modal-input',
        placeholder: 'e.g., 75'
    })
    if (currentReferenceLine?.value !== undefined) {
        valueInput.value = String(currentReferenceLine.value)
    }

    // Label input (optional)
    const labelGroup = form.createDiv({ cls: 'lt-scale-modal-input-group' })
    labelGroup.createSpan({ text: 'Label (optional):' })
    const labelInput = labelGroup.createEl('input', {
        type: 'text',
        cls: 'lt-scale-modal-input',
        placeholder: 'e.g., Target: 75'
    })
    if (currentReferenceLine?.label) {
        labelInput.value = currentReferenceLine.label
    }

    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') cleanup()
    }

    const cleanup = (): void => {
        document.removeEventListener('keydown', handleEscape)
        overlay.remove()
    }

    const buttons = modal.createDiv({ cls: 'lt-scale-modal-buttons' })

    const cancelBtn = buttons.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--secondary',
        text: 'Cancel'
    })
    cancelBtn.addEventListener('click', cleanup)

    const confirmBtn = buttons.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--primary',
        text: 'Apply'
    })
    confirmBtn.addEventListener('click', () => {
        const value = parseFloat(valueInput.value.trim())
        if (isNaN(value)) {
            return
        }

        const label = labelInput.value.trim() || undefined

        onConfirm({
            enabled: true,
            value,
            label
        })

        cleanup()
    })

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup()
    })

    document.addEventListener('keydown', handleEscape)
    valueInput.focus()
}
```

Update the check for options availability:

```typescript
const hasReferenceLine = supportsReferenceLine(vizType)

if (!hasScale && !hasColorScheme && !hasReferenceLine && !hasHeatmapConfig) {
    optionsContent.createDiv({
        cls: 'lt-card-popover-no-options',
        text: 'No options for this type'
    })
    return
}
```

### 8. Update Card Menu Action Type

**File:** `src/app/types/ui/card-menu-action.intf.ts`

Add new action type:

```typescript
| { type: 'configureReferenceLine'; referenceLine: ReferenceLineConfig }
```

Import the type:

```typescript
import type { ReferenceLineConfig } from '../column/column-config.types'
```

### 9. Handle Actions in View

**File:** `src/app/view/life-tracker-view.ts`

Find `handleCardMenuAction` method and add case for reference line:

```typescript
case 'configureReferenceLine':
    if (isFromPreset) {
        // Create local override from preset with new reference line
        const preset = this.columnConfigService.findMatchingPreset(propertyId)
        if (preset) {
            this.columnConfigService.saveColumnConfig(
                propertyId,
                preset.visualizationType,
                displayName,
                preset.scale,
                preset.colorScheme,
                action.referenceLine
            )
        }
    } else {
        this.columnConfigService.updateVisualizationConfig(
            propertyId,
            visualizationId,
            { referenceLine: action.referenceLine }
        )
    }
    this.onDataUpdated()
    break
```

Note: Update `saveColumnConfig` and `updateVisualizationConfig` methods in the column config service to accept and save the reference line parameter.

### 10. Add UI - Settings Tab

**File:** `src/app/settings/settings-tab.ts`

In `renderPresetItem` method (around line 1013, after color scheme section):

```typescript
// Reference line configuration (only for supported types)
if (supportsReferenceLine(preset.visualizationType)) {
    setting.addButton((button) => {
        const hasReferenceLine = preset.referenceLine?.enabled ?? false
        button
            .setButtonText(hasReferenceLine ? 'Edit ref line' : 'Add ref line')
            .setIcon(hasReferenceLine ? 'pencil' : 'plus')
            .onClick(() => {
                showReferenceLineSettingModal(preset.referenceLine, async (referenceLine) => {
                    await this.plugin.updatePreset(preset.id, (p) => {
                        p.referenceLine = referenceLine
                    })
                    this.display()
                })
            })
    })

    if (preset.referenceLine?.enabled) {
        setting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Remove reference line')
                .onClick(async () => {
                    await this.plugin.updatePreset(preset.id, (p) => {
                        p.referenceLine = undefined
                    })
                    this.display()
                })
        })
    }
}
```

Add modal function (reuse the same implementation as in card-context-menu.ts):

```typescript
/**
 * Show reference line configuration modal in settings
 */
function showReferenceLineSettingModal(
    currentReferenceLine: ReferenceLineConfig | undefined,
    onConfirm: (referenceLine: ReferenceLineConfig) => void
): void {
    // Same implementation as showReferenceLineModal
}
```

### 11. Update Business Rules

**File:** `documentation/Business Rules.md`

Add new section at the end:

```markdown
## Reference Lines

- Reference lines are only supported for cartesian chart types: LineChart, BarChart, AreaChart
- Reference lines are disabled by default and must be explicitly enabled per property
- For overlay charts, each property can have its own independent reference line
- Reference line colors match the dataset color for visual consistency
- Default label format is "Target: {value}" if no custom label is provided
```

## Testing Checklist

After implementation, verify:

- [ ] Reference line renders on line charts
- [ ] Reference line renders on bar charts
- [ ] Reference line renders on area charts
- [ ] Reference line does NOT appear on non-cartesian charts
- [ ] Label displays with default format "Target: X"
- [ ] Custom label works correctly
- [ ] Context menu toggle enables/disables reference line
- [ ] Modal validates numeric input (prevents NaN)
- [ ] Settings tab preset with reference line applies correctly
- [ ] Overlay chart shows multiple reference lines
- [ ] Reference line colors match dataset colors in overlays
- [ ] Reference line persists after view refresh
- [ ] TypeScript compiles without errors
- [ ] Linter passes

## Critical Files

- `package.json` - Add annotation plugin dependency
- `src/app/services/chart-loader.service.ts` - Register plugin
- `src/app/types/column/column-config.types.ts` - Add types and support check
- `src/app/types/plugin/plugin-settings.intf.ts` - Update preset type
- `src/app/components/visualizations/chart/chart-initializers.ts` - Render annotations
- `src/app/components/visualizations/chart/chart-visualization.ts` - Build reference line data
- `src/app/components/ui/card-context-menu.ts` - Add UI and modal
- `src/app/types/ui/card-menu-action.intf.ts` - Add action type
- `src/app/view/life-tracker-view.ts` - Handle actions
- `src/app/settings/settings-tab.ts` - Add preset UI
- `documentation/Business Rules.md` - Document rules

## Notes

- The annotation plugin adds minimal overhead
- Chart.js handles annotations efficiently even with multiple reference lines
- For overlays, reference lines use the same color as their corresponding dataset for clarity
- No migration needed - this is a new optional field
