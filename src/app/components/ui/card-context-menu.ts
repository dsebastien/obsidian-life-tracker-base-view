import { Menu } from 'obsidian'
import { VisualizationType } from '../../domain/visualization-type.enum'
import { CONTEXT_MENU_VISUALIZATION_OPTIONS } from '../../domain/visualization-options'
import { supportsScale, type ScaleConfig } from '../../types/column-config.types'

/**
 * Menu action types
 */
export type CardMenuAction =
    | { type: 'changeVisualization'; visualizationType: VisualizationType }
    | { type: 'configureScale'; scale: ScaleConfig | undefined }
    | { type: 'resetConfig' }
    | { type: 'toggleMaximize' }

/**
 * Callback when a menu action is selected
 */
export type CardMenuCallback = (action: CardMenuAction) => void

/**
 * Re-export for backwards compatibility
 */
export const VISUALIZATION_OPTIONS = CONTEXT_MENU_VISUALIZATION_OPTIONS

/**
 * Scale presets for quick selection
 */
const SCALE_PRESETS: Array<{ label: string; min: number; max: number }> = [
    { label: '0-1', min: 0, max: 1 },
    { label: '0-5', min: 0, max: 5 },
    { label: '1-5', min: 1, max: 5 },
    { label: '0-10', min: 0, max: 10 },
    { label: '1-10', min: 1, max: 10 },
    { label: '0-100', min: 0, max: 100 }
]

/**
 * Show context menu for a visualization card
 */
export function showCardContextMenu(
    event: MouseEvent | TouchEvent,
    currentType: VisualizationType,
    currentScale: ScaleConfig | undefined,
    isFromPreset: boolean,
    isMaximized: boolean,
    onAction: CardMenuCallback
): void {
    const menu = new Menu()

    // Maximize/Minimize option at the top
    menu.addItem((item) => {
        item.setTitle(isMaximized ? 'Minimize' : 'Maximize')
            .setIcon(isMaximized ? 'minimize-2' : 'maximize-2')
            .onClick(() => {
                onAction({ type: 'toggleMaximize' })
            })
    })

    menu.addSeparator()

    // Section: Change visualization type
    menu.addItem((item) => {
        item.setTitle('Change to:').setDisabled(true).setIsLabel(true)
    })

    for (const option of VISUALIZATION_OPTIONS) {
        menu.addItem((item) => {
            item.setTitle(option.label)
                .setIcon(option.icon)
                .setChecked(option.type === currentType)
                .onClick(() => {
                    onAction({
                        type: 'changeVisualization',
                        visualizationType: option.type
                    })
                })
        })
    }

    // Scale configuration (only for supported types)
    if (supportsScale(currentType)) {
        menu.addSeparator()

        menu.addItem((item) => {
            item.setTitle('Scale:').setDisabled(true).setIsLabel(true)
        })

        // Auto option
        menu.addItem((item) => {
            item.setTitle('Auto-detect')
                .setIcon('wand')
                .setChecked(!currentScale)
                .onClick(() => {
                    onAction({ type: 'configureScale', scale: undefined })
                })
        })

        // Preset scales
        for (const preset of SCALE_PRESETS) {
            const isSelected = currentScale?.min === preset.min && currentScale?.max === preset.max
            menu.addItem((item) => {
                item.setTitle(preset.label)
                    .setChecked(isSelected)
                    .onClick(() => {
                        onAction({
                            type: 'configureScale',
                            scale: { min: preset.min, max: preset.max }
                        })
                    })
            })
        }

        // Custom option
        menu.addItem((item) => {
            item.setTitle('Custom scale...')
                .setIcon('edit')
                .onClick(() => {
                    showCustomScaleModal(currentScale, (scale) => {
                        onAction({ type: 'configureScale', scale })
                    })
                })
        })
    }

    menu.addSeparator()

    // Reset configuration - different text based on source
    menu.addItem((item) => {
        const title = isFromPreset ? 'Reset to preset' : 'Reset configuration'
        item.setTitle(title)
            .setIcon('rotate-ccw')
            .setWarning(!isFromPreset) // Only show warning for full reset
            .onClick(() => {
                onAction({ type: 'resetConfig' })
            })
    })

    // Show menu at appropriate position based on event type
    if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event)
    } else {
        // TouchEvent - get position from first touch
        const touch = event.changedTouches[0]
        if (touch) {
            menu.showAtPosition({ x: touch.clientX, y: touch.clientY })
        }
    }
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
    modal.createDiv({ cls: 'lt-scale-modal-header', text: 'Configure Scale' })

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

    // Buttons
    const buttons = modal.createDiv({ cls: 'lt-scale-modal-buttons' })

    const cancelBtn = buttons.createEl('button', {
        cls: 'lt-scale-modal-btn lt-scale-modal-btn--secondary',
        text: 'Cancel'
    })
    cancelBtn.addEventListener('click', () => {
        overlay.remove()
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

        overlay.remove()
    })

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove()
        }
    })

    // Close on escape
    const handleEscape = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            overlay.remove()
            document.removeEventListener('keydown', handleEscape)
        }
    }
    document.addEventListener('keydown', handleEscape)

    // Focus min input
    minInput.focus()
}
