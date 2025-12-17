import { setIcon } from 'obsidian'
import {
    VisualizationType,
    CONTEXT_MENU_VISUALIZATION_OPTIONS,
    SCALE_PRESETS,
    supportsScale,
    supportsColorScheme,
    type ScaleConfig,
    type CardMenuCallback
} from '../../types'
import type { ChartColorScheme } from '../../../utils'

/**
 * Color scheme options for the dropdown
 */
const COLOR_SCHEME_OPTIONS: Array<{ value: ChartColorScheme; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'orange', label: 'Orange' },
    { value: 'red', label: 'Red' }
]

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
 * Show context menu popover for a visualization card
 * Two-column layout: left = viz type selection, right = options
 * @param canRemove - Whether the "Remove visualization" button should be shown (true when property has 2+ visualizations)
 */
export function showCardContextMenu(
    event: MouseEvent | TouchEvent,
    currentType: VisualizationType,
    currentScale: ScaleConfig | undefined,
    currentColorScheme: ChartColorScheme | undefined,
    currentHeatmapConfig: HeatmapMenuConfig | undefined,
    isFromPreset: boolean,
    isMaximized: boolean,
    canRemove: boolean,
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
    const overlay = document.body.createDiv({ cls: 'lt-card-popover-overlay' })

    // Create popover container
    const popover = overlay.createDiv({ cls: 'lt-card-popover' })

    // Track selected type for dynamic options
    let selectedType = currentType

    // Close function
    const close = (): void => {
        document.removeEventListener('keydown', handleEscape)
        overlay.remove()
    }

    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            close()
        }
    }

    document.addEventListener('keydown', handleEscape)

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

    const typeList = leftCol.createDiv({ cls: 'lt-card-popover-type-list' })

    // Render options column function (will be called when type changes)
    const renderOptionsColumn = (container: HTMLElement, vizType: VisualizationType): void => {
        container.empty()
        container.createDiv({ cls: 'lt-card-popover-column-title', text: 'Options' })

        const optionsContent = container.createDiv({ cls: 'lt-card-popover-options' })

        const hasScale = supportsScale(vizType)
        const hasColorScheme = supportsColorScheme(vizType)

        if (!hasScale && !hasColorScheme) {
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
            const colorGroup = optionsContent.createDiv({ cls: 'lt-card-popover-option-group' })
            colorGroup.createEl('label', { text: 'Colors' })

            const colorSelect = colorGroup.createEl('select', { cls: 'lt-card-popover-select' })

            for (const scheme of COLOR_SCHEME_OPTIONS) {
                const option = colorSelect.createEl('option', {
                    value: scheme.value,
                    text: scheme.label
                })
                const effectiveScheme = currentColorScheme ?? 'default'
                if (scheme.value === effectiveScheme) {
                    option.selected = true
                }
            }

            colorSelect.addEventListener('change', () => {
                const value = colorSelect.value as ChartColorScheme
                close()
                onAction({
                    type: 'configureColorScheme',
                    colorScheme: value === 'default' ? undefined : value
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
        const item = typeList.createDiv({
            cls: `lt-card-popover-type-item ${option.type === selectedType ? 'lt-card-popover-type-item--selected' : ''}`
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
    const popoverHeight = isSmallScreen ? Math.min(viewportHeight - 24, 500) : 438

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
    const overlay = document.body.createDiv({ cls: 'lt-scale-modal-overlay' })

    const modal = overlay.createDiv({ cls: 'lt-scale-modal' })

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
        document.removeEventListener('keydown', handleEscape)
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

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanup()
        }
    })

    document.addEventListener('keydown', handleEscape)

    // Focus min input
    minInput.focus()
}
