import { setIcon } from 'obsidian'

/**
 * Grid layout settings
 */
export interface GridSettings {
    columns: number
    cardMinHeight: number
}

/**
 * Default grid settings
 */
export const DEFAULT_GRID_SETTINGS: GridSettings = {
    columns: 2,
    cardMinHeight: 200
}

/**
 * Callback when grid settings change
 */
export type GridSettingsChangeCallback = (settings: GridSettings) => void

/**
 * Creates a control bar for adjusting grid layout
 */
export function createGridControls(
    container: HTMLElement,
    initialSettings: GridSettings,
    onChange: GridSettingsChangeCallback
): HTMLElement {
    const settings = { ...initialSettings }

    const controlBar = container.createDiv({ cls: 'lt-control-bar' })

    // Left side: title/info (optional, currently empty)
    controlBar.createDiv({ cls: 'lt-control-bar-left' })

    // Right side: controls
    const controlsRight = controlBar.createDiv({ cls: 'lt-control-bar-right' })

    // Columns control
    createColumnsControl(controlsRight, settings, onChange)

    // Height control
    createSliderControl(
        controlsRight,
        'Height',
        'arrow-up-down',
        settings.cardMinHeight,
        100,
        400,
        50,
        (value) => {
            settings.cardMinHeight = value
            onChange(settings)
        }
    )

    return controlBar
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
 * Creates a slider control with icon and label
 */
function createSliderControl(
    container: HTMLElement,
    _label: string,
    icon: string,
    initialValue: number,
    min: number,
    max: number,
    step: number,
    onUpdate: (value: number) => void
): void {
    const group = container.createDiv({ cls: 'lt-control-group' })

    // Icon
    const iconEl = group.createDiv({ cls: 'lt-control-icon' })
    setIcon(iconEl, icon)

    // Slider
    const slider = group.createEl('input', {
        cls: 'lt-control-slider',
        type: 'range'
    })
    slider.min = String(min)
    slider.max = String(max)
    slider.step = String(step)
    slider.value = String(initialValue)

    // Event handler
    slider.addEventListener('input', () => {
        onUpdate(parseInt(slider.value, 10))
    })
}
