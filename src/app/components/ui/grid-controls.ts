import { setIcon } from 'obsidian'
import {
    TimeFrame,
    TIME_FRAME_LABELS,
    TIME_FRAME_OPTIONS,
    type GridSettings,
    type GridSettingsChangeCallback
} from '../../types'

/**
 * Default grid settings
 */
export const DEFAULT_GRID_SETTINGS: GridSettings = {
    columns: 2,
    timeFrame: TimeFrame.AllTime
}

/**
 * Callback for create overlay button
 */
export type CreateOverlayCallback = () => void

/**
 * Creates a control bar for adjusting grid layout
 * @param onCreateOverlay - Optional callback for "Create overlay" button. If not provided, button is hidden.
 */
export function createGridControls(
    container: HTMLElement,
    initialSettings: GridSettings,
    onChange: GridSettingsChangeCallback,
    onCreateOverlay?: CreateOverlayCallback
): HTMLElement {
    const settings = { ...initialSettings }

    const controlBar = container.createDiv({ cls: 'lt-control-bar' })

    // Left side: time frame selector and overlay button
    const controlsLeft = controlBar.createDiv({ cls: 'lt-control-bar-left' })
    createTimeFrameControl(controlsLeft, settings, onChange)

    // Create overlay button (only if callback provided)
    if (onCreateOverlay) {
        createOverlayButton(controlsLeft, onCreateOverlay)
    }

    // Right side: columns control
    const controlsRight = controlBar.createDiv({ cls: 'lt-control-bar-right' })
    createColumnsControl(controlsRight, settings, onChange)

    return controlBar
}

/**
 * Creates the "Create overlay" button
 */
function createOverlayButton(container: HTMLElement, onClick: CreateOverlayCallback): void {
    const btn = container.createEl('button', {
        cls: 'lt-control-btn lt-control-btn--overlay',
        attr: { 'aria-label': 'Create overlay chart' }
    })
    setIcon(btn, 'layers')
    btn.createSpan({ cls: 'lt-control-btn-label', text: 'Overlay' })

    btn.addEventListener('click', onClick)
}

/**
 * Creates column count control with +/- buttons
 */
function createColumnsControl(
    container: HTMLElement,
    settings: GridSettings,
    onChange: GridSettingsChangeCallback
): void {
    const group = container.createDiv({ cls: 'lt-control-group' })

    // Icon
    const iconEl = group.createDiv({ cls: 'lt-control-icon' })
    setIcon(iconEl, 'layout-grid')

    // Minus button
    const minusBtn = group.createEl('button', { cls: 'lt-control-btn' })
    setIcon(minusBtn, 'minus')
    minusBtn.setAttribute('aria-label', 'Fewer columns')

    // Value display
    const valueEl = group.createSpan({ cls: 'lt-control-value', text: String(settings.columns) })

    // Plus button
    const plusBtn = group.createEl('button', { cls: 'lt-control-btn' })
    setIcon(plusBtn, 'plus')
    plusBtn.setAttribute('aria-label', 'More columns')

    // Event handlers
    minusBtn.addEventListener('click', () => {
        if (settings.columns > 1) {
            settings.columns--
            valueEl.textContent = String(settings.columns)
            onChange(settings)
        }
    })

    plusBtn.addEventListener('click', () => {
        if (settings.columns < 6) {
            settings.columns++
            valueEl.textContent = String(settings.columns)
            onChange(settings)
        }
    })
}

/**
 * Creates time frame dropdown control
 */
function createTimeFrameControl(
    container: HTMLElement,
    settings: GridSettings,
    onChange: GridSettingsChangeCallback
): void {
    const group = container.createDiv({ cls: 'lt-control-group' })

    // Icon
    const iconEl = group.createDiv({ cls: 'lt-control-icon' })
    setIcon(iconEl, 'calendar')

    // Dropdown select
    const selectEl = group.createEl('select', { cls: 'lt-control-select' })
    selectEl.setAttribute('aria-label', 'Time frame')

    // Add options
    for (const timeFrame of TIME_FRAME_OPTIONS) {
        const optionEl = selectEl.createEl('option', {
            value: timeFrame,
            text: TIME_FRAME_LABELS[timeFrame]
        })
        if (timeFrame === settings.timeFrame) {
            optionEl.selected = true
        }
    }

    // Event handler
    selectEl.addEventListener('change', () => {
        settings.timeFrame = selectEl.value as TimeFrame
        onChange(settings)
    })
}
