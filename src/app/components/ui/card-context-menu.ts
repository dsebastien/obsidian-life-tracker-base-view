import { setIcon } from 'obsidian'
import {
    VisualizationType,
    CONTEXT_MENU_VISUALIZATION_OPTIONS,
    SCALE_PRESETS,
    supportsScale,
    supportsColorScheme,
    supportsReferenceLine,
    supportsAggregationMethod,
    supportsImageExport,
    supportsMovingAverage,
    MOVING_AVERAGE_PERIOD_OPTIONS,
    DEFAULT_AGGREGATION_METHOD,
    type ScaleConfig,
    type ReferenceLineConfig,
    type AggregationMethod,
    type CardMenuCallback,
    type DiscreteHeatmapColorScheme,
    type StoredColorScheme
} from '../../types'
import {
    COLOR_SCHEME_OPTIONS,
    HEATMAP_COLOR_SCHEME_OPTIONS,
    createDefaultDiscreteScheme,
    nextDiscreteEntryColor,
    normalizeHeatmapColorScheme,
    type ChartColorScheme
} from '../../../utils'

/**
 * Dropdown value that opens the custom value → color mapping editor (issue #82)
 */
const CUSTOM_MAPPING_VALUE = '__custom__'

/**
 * Cell size options for heatmap
 */
const CELL_SIZE_OPTIONS: Array<{ value: number | 'default'; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 8, label: 'Small (8px)' },
    { value: 12, label: 'Medium (12px)' },
    { value: 16, label: 'Large (16px)' },
    { value: 20, label: 'Extra large (20px)' }
]

/**
 * Heatmap-specific configuration passed to the menu
 */
export interface HeatmapMenuConfig {
    cellSize?: number
    showMonthLabels?: boolean
    showDayLabels?: boolean
}

/**
 * Trap Tab focus inside a container (issue #110). The listener dies with the
 * element, but the returned cleanup allows explicit release too.
 */
function trapFocus(container: HTMLElement): () => void {
    const handleKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Tab') return

        const focusables = Array.from(
            container.querySelectorAll<HTMLElement>(
                'button, select, input, [tabindex]:not([tabindex="-1"])'
            )
        ).filter((el) => !el.hasAttribute('disabled'))

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) return

        const active = container.ownerDocument.activeElement
        if (e.shiftKey && (active === first || !container.contains(active))) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        }
    }

    container.addEventListener('keydown', handleKeydown)
    return (): void => container.removeEventListener('keydown', handleKeydown)
}

/**
 * Show context menu popover for a visualization card
 * Two-column layout: left = viz type selection, right = options
 * @param canRemove - Whether the "Remove visualization" button should be shown (true when property has 2+ visualizations)
 */
export function showCardContextMenu(
    event: MouseEvent | TouchEvent,
    currentType: VisualizationType,
    currentScale: ScaleConfig | undefined,
    currentColorScheme: StoredColorScheme | undefined,
    currentHeatmapConfig: HeatmapMenuConfig | undefined,
    currentReferenceLine: ReferenceLineConfig | undefined,
    currentAggregationMethod: AggregationMethod | undefined,
    currentMovingAveragePeriod: number | undefined,
    isFromPreset: boolean,
    isMaximized: boolean,
    canRemove: boolean,
    isPinned: boolean,
    onAction: CardMenuCallback
): void {
    // Get position from event
    let x: number, y: number
    if (event instanceof MouseEvent) {
        x = event.clientX
        y = event.clientY
    } else {
        const touch = event.changedTouches[0]
        if (!touch) return
        x = touch.clientX
        y = touch.clientY
    }

    // Create overlay
    const overlay = activeDocument.body.createDiv({ cls: 'lt-card-popover-overlay' })

    // Create popover container
    const popover = overlay.createDiv({
        cls: 'lt-card-popover',
        attr: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': 'Visualization options' }
    })
    const releaseFocusTrap = trapFocus(popover)

    // Track selected type for dynamic options
    let selectedType = currentType

    // Close function
    const close = (): void => {
        activeDocument.removeEventListener('keydown', handleEscape)
        releaseFocusTrap()
        overlay.remove()
    }

    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            close()
        }
    }

    activeDocument.addEventListener('keydown', handleEscape)

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            close()
        }
    })

    // ========== HEADER ==========
    const header = popover.createDiv({ cls: 'lt-card-popover-header' })

    // Add visualization button
    const addVizBtn = header.createEl('button', {
        cls: 'lt-card-popover-btn'
    })
    setIcon(addVizBtn, 'plus')
    addVizBtn.createSpan({ text: 'Add visualization' })
    addVizBtn.addEventListener('click', () => {
        close()
        onAction({ type: 'addVisualization' })
    })

    // Remove visualization button (only shown when canRemove is true)
    if (canRemove) {
        const removeVizBtn = header.createEl('button', {
            cls: 'lt-card-popover-btn lt-card-popover-btn--warning'
        })
        setIcon(removeVizBtn, 'trash-2')
        removeVizBtn.createSpan({ text: 'Remove' })
        removeVizBtn.addEventListener('click', () => {
            close()
            onAction({ type: 'removeVisualization' })
        })
    }

    // Pin/unpin button (issue #123)
    const pinBtn = header.createEl('button', {
        cls: 'lt-card-popover-btn'
    })
    setIcon(pinBtn, 'star')
    pinBtn.createSpan({ text: isPinned ? 'Unpin' : 'Pin to top' })
    pinBtn.addEventListener('click', () => {
        close()
        onAction({ type: 'togglePin' })
    })

    // Maximize/Minimize button
    const maximizeBtn = header.createEl('button', {
        cls: 'lt-card-popover-btn'
    })
    setIcon(maximizeBtn, isMaximized ? 'minimize-2' : 'maximize-2')
    maximizeBtn.createSpan({ text: isMaximized ? 'Minimize' : 'Maximize' })
    maximizeBtn.addEventListener('click', () => {
        close()
        onAction({ type: 'toggleMaximize' })
    })

    // Export buttons (issue #102). Image export needs a canvas, so it is
    // only offered for Chart.js-based types.
    if (supportsImageExport(currentType)) {
        const exportImageBtn = header.createEl('button', {
            cls: 'lt-card-popover-btn'
        })
        setIcon(exportImageBtn, 'image')
        exportImageBtn.createSpan({ text: 'Export image' })
        exportImageBtn.addEventListener('click', () => {
            close()
            onAction({ type: 'exportImage' })
        })
    }

    const exportCsvBtn = header.createEl('button', {
        cls: 'lt-card-popover-btn'
    })
    setIcon(exportCsvBtn, 'download')
    exportCsvBtn.createSpan({ text: 'Export CSV' })
    exportCsvBtn.addEventListener('click', () => {
        close()
        onAction({ type: 'exportCsv' })
    })

    // Reset button
    const resetBtn = header.createEl('button', {
        cls: `lt-card-popover-btn ${isFromPreset ? '' : 'lt-card-popover-btn--warning'}`
    })
    setIcon(resetBtn, 'rotate-ccw')
    resetBtn.createSpan({ text: isFromPreset ? 'Reset to preset' : 'Reset' })
    resetBtn.addEventListener('click', () => {
        close()
        onAction({ type: 'resetConfig' })
    })

    // ========== BODY (two columns) ==========
    const body = popover.createDiv({ cls: 'lt-card-popover-body' })

    // Left column: Visualization type selection
    const leftCol = body.createDiv({ cls: 'lt-card-popover-column lt-card-popover-column--left' })
    leftCol.createDiv({ cls: 'lt-card-popover-column-title', text: 'Visualization' })

    const typeList = leftCol.createDiv({
        cls: 'lt-card-popover-type-list',
        attr: { 'role': 'listbox', 'aria-label': 'Visualization type' }
    })

    // Render options column function (will be called when type changes)
    const renderOptionsColumn = (container: HTMLElement, vizType: VisualizationType): void => {
        container.empty()
        container.createDiv({ cls: 'lt-card-popover-column-title', text: 'Options' })

        const optionsContent = container.createDiv({ cls: 'lt-card-popover-options' })

        const hasScale = supportsScale(vizType)
        const hasColorScheme = supportsColorScheme(vizType)
        const hasReferenceLine = supportsReferenceLine(vizType)
        const hasAggregationMethod = supportsAggregationMethod(vizType)
        const hasMovingAverage = supportsMovingAverage(vizType)

        const hasHeatmapConfig = vizType === VisualizationType.Heatmap

        if (
            !hasScale &&
            !hasColorScheme &&
            !hasReferenceLine &&
            !hasAggregationMethod &&
            !hasMovingAverage &&
            !hasHeatmapConfig
        ) {
            optionsContent.createDiv({
                cls: 'lt-card-popover-no-options',
                text: 'No options for this type'
            })
            return
        }

        // Scale dropdown (if supported)
        if (hasScale) {
            const scaleGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            scaleGroup.createEl('label', { text: 'Scale' })

            const scaleSelect = scaleGroup.createEl('select', { cls: 'lt-card-popover-select' })

            // Auto option
            const autoOption = scaleSelect.createEl('option', { value: '', text: 'Auto-detect' })
            if (!currentScale) {
                autoOption.selected = true
            }

            // Preset options
            for (const preset of SCALE_PRESETS) {
                const option = scaleSelect.createEl('option', {
                    value: `${preset.min}-${preset.max}`,
                    text: preset.label
                })
                if (currentScale?.min === preset.min && currentScale?.max === preset.max) {
                    option.selected = true
                }
            }

            // Custom option
            const customOption = scaleSelect.createEl('option', {
                value: 'custom',
                text: 'Custom...'
            })
            const isCustom =
                currentScale &&
                !SCALE_PRESETS.some((p) => p.min === currentScale.min && p.max === currentScale.max)
            if (isCustom) {
                customOption.selected = true
            }

            scaleSelect.addEventListener('change', () => {
                const value = scaleSelect.value
                if (value === '') {
                    close()
                    onAction({ type: 'configureScale', scale: undefined })
                } else if (value === 'custom') {
                    close()
                    showCustomScaleModal(currentScale, (scale) => {
                        onAction({ type: 'configureScale', scale })
                    })
                } else {
                    const [min, max] = value.split('-').map(Number)
                    close()
                    onAction({
                        type: 'configureScale',
                        scale: { min: min ?? 0, max: max ?? 100 }
                    })
                }
            })
        }

        // Color scheme dropdown (if supported)
        if (hasColorScheme) {
            const isHeatmap = vizType === VisualizationType.Heatmap
            // Only a heatmap can carry an inline custom scheme (issue #82)
            const customScheme = isHeatmap ? normalizeHeatmapColorScheme(currentColorScheme) : null
            const discreteScheme =
                customScheme && customScheme.kind === 'discrete' ? customScheme : null

            const colorGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            colorGroup.createEl('label', { text: 'Colors' })

            const colorSelect = colorGroup.createEl('select', { cls: 'lt-card-popover-select' })

            // Heatmaps have their own gradient presets (including the
            // colorblind-friendly ones, issue #136) plus custom mapping
            const schemeOptions = isHeatmap
                ? [
                      ...HEATMAP_COLOR_SCHEME_OPTIONS,
                      { value: CUSTOM_MAPPING_VALUE, label: 'Custom mapping…' }
                  ]
                : COLOR_SCHEME_OPTIONS

            const effectiveScheme = discreteScheme
                ? CUSTOM_MAPPING_VALUE
                : typeof currentColorScheme === 'string'
                  ? currentColorScheme
                  : isHeatmap
                    ? ''
                    : 'default'

            if (isHeatmap) {
                // Always offered, so a card that has been given its own preset
                // can be handed back to the view-wide heatmap scheme
                const defaultOption = colorSelect.createEl('option', {
                    value: '',
                    text: 'Default'
                })
                defaultOption.selected = effectiveScheme === ''
            }

            for (const scheme of schemeOptions) {
                const option = colorSelect.createEl('option', {
                    value: scheme.value,
                    text: scheme.label
                })
                if (scheme.value === effectiveScheme) {
                    option.selected = true
                }
            }

            colorSelect.addEventListener('change', () => {
                const value = colorSelect.value

                if (value === CUSTOM_MAPPING_VALUE) {
                    // Close first, like the scale modal: two stacked dialogs
                    // would mean two focus traps and two Escape handlers
                    close()
                    showDiscreteColorSchemeModal(
                        discreteScheme ?? createDefaultDiscreteScheme(),
                        (scheme) => {
                            onAction({ type: 'configureColorScheme', colorScheme: scheme })
                        }
                    )
                    return
                }

                close()
                onAction({
                    type: 'configureColorScheme',
                    colorScheme:
                        value === 'default' || value === ''
                            ? undefined
                            : (value as ChartColorScheme)
                })
            })

            // Already on a custom mapping: offer to edit it without having to
            // re-pick the dropdown entry that is already selected
            if (discreteScheme) {
                const editBtn = colorGroup.createEl('button', {
                    cls: 'lt-card-popover-select',
                    text: 'Edit mapping'
                })
                editBtn.addEventListener('click', () => {
                    close()
                    showDiscreteColorSchemeModal(discreteScheme, (scheme) => {
                        onAction({ type: 'configureColorScheme', colorScheme: scheme })
                    })
                })
            }
        }

        // Reference line configuration
        if (hasReferenceLine) {
            const refLineGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            refLineGroup.createEl('label', { text: 'Reference line' })

            const refLineToggle = refLineGroup.createEl('select', { cls: 'lt-card-popover-select' })
            const disabledOption = refLineToggle.createEl('option', {
                value: 'disabled',
                text: 'Disabled'
            })
            const enabledOption = refLineToggle.createEl('option', {
                value: 'enabled',
                text: 'Enabled'
            })

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
                const refLineValueGroup = optionsContent.createDiv({
                    cls: 'lt-card-popover-option-group'
                })
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

        // Aggregation method dropdown (cartesian/bubble charts)
        if (hasAggregationMethod) {
            const aggGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            aggGroup.createEl('label', { text: 'Aggregation' })

            const aggSelect = aggGroup.createEl('select', { cls: 'lt-card-popover-select' })

            const averageOption = aggSelect.createEl('option', {
                value: 'average',
                text: 'Average'
            })
            const sumOption = aggSelect.createEl('option', {
                value: 'sum',
                text: 'Sum'
            })

            const effective = currentAggregationMethod ?? DEFAULT_AGGREGATION_METHOD
            if (effective === 'sum') {
                sumOption.selected = true
            } else {
                averageOption.selected = true
            }

            aggSelect.addEventListener('change', () => {
                const value = aggSelect.value as AggregationMethod
                close()
                onAction({
                    type: 'configureAggregationMethod',
                    aggregationMethod: value === DEFAULT_AGGREGATION_METHOD ? undefined : value
                })
            })
        }

        // Moving average dropdown (line/area charts, issue #101)
        if (hasMovingAverage) {
            const maGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            maGroup.createEl('label', { text: 'Moving average' })

            const maSelect = maGroup.createEl('select', { cls: 'lt-card-popover-select' })

            const offOption = maSelect.createEl('option', { value: '', text: 'Off' })
            if (!currentMovingAveragePeriod) {
                offOption.selected = true
            }

            for (const period of MOVING_AVERAGE_PERIOD_OPTIONS) {
                const option = maSelect.createEl('option', {
                    value: String(period),
                    text: `${period} periods`
                })
                if (currentMovingAveragePeriod === period) {
                    option.selected = true
                }
            }

            maSelect.addEventListener('change', () => {
                const value = maSelect.value
                close()
                onAction({
                    type: 'configureMovingAverage',
                    movingAveragePeriod: value === '' ? undefined : parseInt(value, 10)
                })
            })
        }

        // Heatmap-specific options
        if (vizType === VisualizationType.Heatmap) {
            // Cell size dropdown
            const cellSizeGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            cellSizeGroup.createEl('label', { text: 'Cell size' })

            const cellSizeSelect = cellSizeGroup.createEl('select', {
                cls: 'lt-card-popover-select'
            })

            for (const option of CELL_SIZE_OPTIONS) {
                const opt = cellSizeSelect.createEl('option', {
                    value: String(option.value),
                    text: option.label
                })
                if (
                    (option.value === 'default' && currentHeatmapConfig?.cellSize === undefined) ||
                    option.value === currentHeatmapConfig?.cellSize
                ) {
                    opt.selected = true
                }
            }

            cellSizeSelect.addEventListener('change', () => {
                const value = cellSizeSelect.value
                close()
                onAction({
                    type: 'configureHeatmapCellSize',
                    cellSize: value === 'default' ? undefined : parseInt(value, 10)
                })
            })

            // Show month labels toggle
            const monthLabelsGroup = optionsContent.createDiv({
                cls: 'lt-card-popover-option-group'
            })
            monthLabelsGroup.createEl('label', { text: 'Month labels' })

            const monthLabelsSelect = monthLabelsGroup.createEl('select', {
                cls: 'lt-card-popover-select'
            })
            const monthDefault = monthLabelsSelect.createEl('option', {
                value: 'default',
                text: 'Default'
            })
            const monthShow = monthLabelsSelect.createEl('option', { value: 'true', text: 'Show' })
            const monthHide = monthLabelsSelect.createEl('option', { value: 'false', text: 'Hide' })

            if (currentHeatmapConfig?.showMonthLabels === undefined) {
                monthDefault.selected = true
            } else if (currentHeatmapConfig.showMonthLabels) {
                monthShow.selected = true
            } else {
                monthHide.selected = true
            }

            monthLabelsSelect.addEventListener('change', () => {
                const value = monthLabelsSelect.value
                close()
                onAction({
                    type: 'configureHeatmapShowMonthLabels',
                    showMonthLabels:
                        value === 'default' ? undefined : value === 'true' ? true : false
                })
            })

            // Show day labels toggle
            const dayLabelsGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            dayLabelsGroup.createEl('label', { text: 'Day labels' })

            const dayLabelsSelect = dayLabelsGroup.createEl('select', {
                cls: 'lt-card-popover-select'
            })
            const dayDefault = dayLabelsSelect.createEl('option', {
                value: 'default',
                text: 'Default'
            })
            const dayShow = dayLabelsSelect.createEl('option', { value: 'true', text: 'Show' })
            const dayHide = dayLabelsSelect.createEl('option', { value: 'false', text: 'Hide' })

            if (currentHeatmapConfig?.showDayLabels === undefined) {
                dayDefault.selected = true
            } else if (currentHeatmapConfig.showDayLabels) {
                dayShow.selected = true
            } else {
                dayHide.selected = true
            }

            dayLabelsSelect.addEventListener('change', () => {
                const value = dayLabelsSelect.value
                close()
                onAction({
                    type: 'configureHeatmapShowDayLabels',
                    showDayLabels: value === 'default' ? undefined : value === 'true' ? true : false
                })
            })
        }
    }

    // Right column: Options
    const rightCol = body.createDiv({ cls: 'lt-card-popover-column lt-card-popover-column--right' })
    renderOptionsColumn(rightCol, selectedType)

    // Create type items
    for (const option of CONTEXT_MENU_VISUALIZATION_OPTIONS) {
        const isSelected = option.type === selectedType
        const item = typeList.createDiv({
            cls: `lt-card-popover-type-item ${isSelected ? 'lt-card-popover-type-item--selected' : ''}`,
            attr: { 'role': 'option', 'aria-selected': isSelected ? 'true' : 'false' }
        })
        // Roving tabindex: the selected option is the Tab stop, arrows move
        // focus within the list (issue #110)
        item.tabIndex = isSelected ? 0 : -1

        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                item.click()
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const items = Array.from(
                    typeList.querySelectorAll<HTMLElement>('.lt-card-popover-type-item')
                )
                const index = items.indexOf(item)
                const next =
                    e.key === 'ArrowDown'
                        ? (items[index + 1] ?? items[0])
                        : (items[index - 1] ?? items[items.length - 1])
                next?.focus()
            }
        })

        const iconEl = item.createSpan({ cls: 'lt-card-popover-type-icon' })
        setIcon(iconEl, option.icon)

        item.createSpan({ cls: 'lt-card-popover-type-label', text: option.label })

        if (option.type === selectedType) {
            const checkEl = item.createSpan({ cls: 'lt-card-popover-type-check' })
            setIcon(checkEl, 'check')
        }

        item.addEventListener('click', () => {
            if (option.type !== selectedType) {
                // Update selection visually
                typeList.querySelectorAll('.lt-card-popover-type-item').forEach((el) => {
                    el.classList.remove('lt-card-popover-type-item--selected')
                    const check = el.querySelector('.lt-card-popover-type-check')
                    if (check) check.remove()
                })
                item.classList.add('lt-card-popover-type-item--selected')
                const checkEl = item.createSpan({ cls: 'lt-card-popover-type-check' })
                setIcon(checkEl, 'check')

                selectedType = option.type

                // Re-render options column for new type
                renderOptionsColumn(rightCol, selectedType)

                // Dispatch action
                close()
                onAction({ type: 'changeVisualization', visualizationType: option.type })
            }
        })
    }

    // Move focus into the dialog so keyboard users land inside it
    addVizBtn.focus()

    // Position popover - on mobile (<=480px), CSS handles positioning via inset
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isMobile = viewportWidth <= 480

    if (isMobile) {
        // On mobile, CSS uses inset positioning, so we don't set left/top
        // The popover will be centered/near-fullscreen via CSS
        return
    }

    // For tablet/desktop, calculate position based on click location
    // Use responsive dimensions based on viewport
    const isSmallScreen = viewportWidth <= 640
    const popoverWidth = isSmallScreen ? Math.min(viewportWidth - 24, 400) : 605
    // Must match the CSS max-height (min(80vh, 560px)) so the clamping below
    // keeps the whole popover inside the viewport
    const popoverHeight = isSmallScreen
        ? Math.min(viewportHeight - 24, 500)
        : Math.min(viewportHeight * 0.8, 560)

    // Adjust position to keep popover in viewport
    let left = x
    let top = y

    const margin = isSmallScreen ? 12 : 20

    if (left + popoverWidth > viewportWidth - margin) {
        left = viewportWidth - popoverWidth - margin
    }
    if (left < margin) {
        left = margin
    }

    if (top + popoverHeight > viewportHeight - margin) {
        top = viewportHeight - popoverHeight - margin
    }
    if (top < margin) {
        top = margin
    }

    popover.style.left = `${left}px`
    popover.style.top = `${top}px`
}

/**
 * Show a simple modal for custom scale input
 */
function showCustomScaleModal(
    currentScale: ScaleConfig | undefined,
    onConfirm: (scale: ScaleConfig | undefined) => void
): void {
    // Create modal overlay
    const overlay = activeDocument.body.createDiv({ cls: 'lt-scale-modal-overlay' })

    const modal = overlay.createDiv({
        cls: 'lt-scale-modal',
        attr: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': 'Configure scale' }
    })
    trapFocus(modal)

    // Header
    modal.createDiv({ cls: 'lt-scale-modal-header', text: 'Configure scale' })

    // Form
    const form = modal.createDiv({ cls: 'lt-scale-modal-form' })

    // Min input
    const minGroup = form.createDiv({ cls: 'lt-scale-modal-input-group' })
    minGroup.createSpan({ text: 'Min:' })
    const minInput = minGroup.createEl('input', {
        type: 'number',
        cls: 'lt-scale-modal-input',
        placeholder: 'auto'
    })
    if (currentScale?.min !== null && currentScale?.min !== undefined) {
        minInput.value = String(currentScale.min)
    }

    // Max input
    const maxGroup = form.createDiv({ cls: 'lt-scale-modal-input-group' })
    maxGroup.createSpan({ text: 'Max:' })
    const maxInput = maxGroup.createEl('input', {
        type: 'number',
        cls: 'lt-scale-modal-input',
        placeholder: 'auto'
    })
    if (currentScale?.max !== null && currentScale?.max !== undefined) {
        maxInput.value = String(currentScale.max)
    }

    // Close on escape - define early so cleanup can reference it
    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            cleanup()
        }
    }

    // Cleanup function to remove overlay and event listener
    const cleanup = (): void => {
        activeDocument.removeEventListener('keydown', handleEscape)
        overlay.remove()
    }

    // Buttons
    const buttons = modal.createDiv({ cls: 'lt-scale-modal-buttons' })

    const cancelBtn = buttons.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--secondary',
        text: 'Cancel'
    })
    cancelBtn.addEventListener('click', () => {
        cleanup()
    })

    const confirmBtn = buttons.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--primary',
        text: 'Apply'
    })
    confirmBtn.addEventListener('click', () => {
        const minVal = minInput.value.trim()
        const maxVal = maxInput.value.trim()

        const scale: ScaleConfig = {
            min: minVal ? parseFloat(minVal) : null,
            max: maxVal ? parseFloat(maxVal) : null
        }

        // Only pass scale if at least one value is set
        if (scale.min !== null || scale.max !== null) {
            onConfirm(scale)
        } else {
            onConfirm(undefined)
        }

        cleanup()
    })

    // Enter in the form confirms
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            confirmBtn.click()
        }
    })

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanup()
        }
    })

    activeDocument.addEventListener('keydown', handleEscape)

    // Focus min input
    minInput.focus()
}

/**
 * Show the value → color mapping editor for a heatmap (issue #82).
 *
 * Rows are edited as a working copy and only handed back on Apply, so cancelling
 * leaves the card untouched. Entries with a blank value are dropped; an empty
 * mapping is still valid (every cell then falls back to the fallback color).
 */
function showDiscreteColorSchemeModal(
    currentScheme: DiscreteHeatmapColorScheme,
    onConfirm: (scheme: DiscreteHeatmapColorScheme) => void
): void {
    // Working copy: an ordered list, because a mapping object cannot hold a
    // half-typed duplicate key while the user is editing
    const rows: Array<{ value: string; color: string }> = Object.entries(currentScheme.mapping).map(
        ([value, color]) => ({ value, color })
    )

    const overlay = activeDocument.body.createDiv({ cls: 'lt-scale-modal-overlay' })
    const modal = overlay.createDiv({
        cls: 'lt-scale-modal lt-mapping-modal',
        attr: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': 'Configure color mapping' }
    })
    trapFocus(modal)

    modal.createDiv({ cls: 'lt-scale-modal-header', text: 'Configure color mapping' })

    const form = modal.createDiv({ cls: 'lt-scale-modal-form' })
    form.createDiv({
        cls: 'lt-mapping-hint',
        text: 'Give each value its own color. Values without an entry use the fallback color.'
    })

    const rowsEl = form.createDiv({ cls: 'lt-mapping-rows' })

    const renderRows = (): void => {
        rowsEl.empty()

        rows.forEach((row, index) => {
            const rowEl = rowsEl.createDiv({ cls: 'lt-mapping-row' })

            const valueInput = rowEl.createEl('input', {
                type: 'text',
                cls: 'lt-scale-modal-input lt-mapping-value',
                placeholder: 'Value'
            })
            valueInput.value = row.value
            valueInput.addEventListener('input', () => {
                row.value = valueInput.value
            })

            const colorInput = rowEl.createEl('input', {
                type: 'color',
                cls: 'lt-mapping-color'
            })
            colorInput.value = row.color
            colorInput.addEventListener('input', () => {
                row.color = colorInput.value
            })

            const removeBtn = rowEl.createEl('button', {
                cls: 'lt-mapping-remove',
                text: '×',
                attr: { 'aria-label': `Remove entry for value ${row.value || index + 1}` }
            })
            removeBtn.addEventListener('click', () => {
                rows.splice(index, 1)
                renderRows()
            })
        })
    }

    renderRows()

    const addBtn = form.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--secondary lt-mapping-add',
        text: 'Add entry'
    })
    addBtn.addEventListener('click', () => {
        rows.push({ value: '', color: nextDiscreteEntryColor(rows.length) })
        renderRows()
    })

    // Fallback color for values with no entry
    const fallbackGroup = form.createDiv({ cls: 'lt-scale-modal-input-group' })
    fallbackGroup.createSpan({ text: 'Fallback color:' })
    const fallbackInput = fallbackGroup.createEl('input', {
        type: 'color',
        cls: 'lt-mapping-color'
    })
    fallbackInput.value = currentScheme.fallback ?? '#cccccc'

    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') cleanup()
    }

    const cleanup = (): void => {
        activeDocument.removeEventListener('keydown', handleEscape)
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
        const mapping: Record<string, string> = {}
        for (const row of rows) {
            const key = row.value.trim()
            // Last entry wins on duplicates, matching what the list shows
            if (key) mapping[key] = row.color
        }

        onConfirm({
            kind: 'discrete',
            empty: currentScheme.empty,
            mapping,
            fallback: fallbackInput.value
        })
        cleanup()
    })

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup()
    })

    activeDocument.addEventListener('keydown', handleEscape)
    rowsEl.querySelector<HTMLInputElement>('.lt-mapping-value')?.focus()
}

/**
 * Show a modal for reference line configuration
 */
function showReferenceLineModal(
    currentReferenceLine: ReferenceLineConfig | undefined,
    onConfirm: (referenceLine: ReferenceLineConfig) => void
): void {
    const overlay = activeDocument.body.createDiv({ cls: 'lt-scale-modal-overlay' })
    const modal = overlay.createDiv({
        cls: 'lt-scale-modal',
        attr: { 'role': 'dialog', 'aria-modal': 'true', 'aria-label': 'Configure reference line' }
    })
    trapFocus(modal)

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
        activeDocument.removeEventListener('keydown', handleEscape)
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

    // Enter in the form confirms
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            confirmBtn.click()
        }
    })

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup()
    })

    activeDocument.addEventListener('keydown', handleEscape)
    valueInput.focus()
}
