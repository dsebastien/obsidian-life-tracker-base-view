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
 * Callback for the "Reset card order" button. Should clear the per-view
 * manual order and trigger a re-render.
 */
export type ResetCardOrderCallback = () => void

/**
 * Optional callbacks for the grid controls bar.
 */
export interface GridControlsCallbacks {
    onCreateOverlay?: CreateOverlayCallback
    /** Only invoked when `showResetOrder` is true (i.e., a manual order is set) */
    onResetCardOrder?: ResetCardOrderCallback
    /** Whether to show the "Reset card order" button */
    showResetOrder?: boolean
}

/**
 * Creates a control bar for adjusting grid layout
 */
export function createGridControls(
    container: HTMLElement,
    initialSettings: GridSettings,
    onChange: GridSettingsChangeCallback,
    callbacks: GridControlsCallbacks = {}
): HTMLElement {
    const settings = { ...initialSettings }

    const controlBar = container.createDiv({ cls: 'lt-control-bar' })

    // Left side: time frame selector and overlay button
    const controlsLeft = controlBar.createDiv({ cls: 'lt-control-bar-left' })
    createTimeFrameControl(controlsLeft, settings, onChange)

    // Create overlay button (only if callback provided)
    if (callbacks.onCreateOverlay) {
        createOverlayButton(controlsLeft, callbacks.onCreateOverlay)
    }

    // Reset card order button (only shown when a manual order is currently set)
    if (callbacks.showResetOrder && callbacks.onResetCardOrder) {
        createResetOrderButton(controlsLeft, callbacks.onResetCardOrder)
    }

    // Right side: columns control
    const controlsRight = controlBar.createDiv({ cls: 'lt-control-bar-right' })
    createColumnsControl(controlsRight, settings, onChange)

    return controlBar
}

/**
 * Creates the "Reset card order" button — only visible when a manual order
 * has been set, since otherwise there's nothing to reset.
 */
function createResetOrderButton(container: HTMLElement, onClick: ResetCardOrderCallback): void {
    const btn = container.createEl('button', {
        cls: 'lt-control-btn lt-control-btn--reset-order',
        attr: { 'aria-label': 'Reset card order to default' }
    })
    setIcon(btn, 'rotate-ccw')
    btn.createSpan({ cls: 'lt-control-btn-label', text: 'Reset order' })

    btn.addEventListener('click', onClick)
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
