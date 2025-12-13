import { setIcon } from 'obsidian'
import {
    CONFIG_CARD_VISUALIZATION_OPTIONS,
    SCALE_PRESETS,
    supportsScale,
    type ScaleConfig,
    type ColumnConfigCallback
} from '../../types'

/**
 * Creates a card prompting user to configure a column's visualization
 */
export function createColumnConfigCard(
    container: HTMLElement,
    propertyName: string,
    onSelect: ColumnConfigCallback
): HTMLElement {
    const card = container.createDiv({ cls: 'lt-card lt-config-card' })

    // Header
    const header = card.createDiv({ cls: 'lt-config-card-header' })
    header.createSpan({ cls: 'lt-config-card-title', text: propertyName })
    const subtitle = header.createSpan({
        cls: 'lt-config-card-subtitle',
        text: 'Select visualization type'
    })

    // Options grid (shown first)
    const optionsGrid = card.createDiv({ cls: 'lt-config-card-options' })

    // Scale config section (hidden initially)
    const scaleSection = card.createDiv({ cls: 'lt-config-scale-section lt-hidden' })

    for (const option of CONFIG_CARD_VISUALIZATION_OPTIONS) {
        const optionBtn = optionsGrid.createDiv({ cls: 'lt-config-option' })
        optionBtn.setAttribute('role', 'button')
        optionBtn.setAttribute('tabindex', '0')
        optionBtn.setAttribute('aria-label', `${option.label}: ${option.description}`)

        // Icon
        const iconEl = optionBtn.createDiv({ cls: 'lt-config-option-icon' })
        setIcon(iconEl, option.icon)

        // Label
        optionBtn.createSpan({ cls: 'lt-config-option-label', text: option.label })

        // Click handler
        const handleSelect = (): void => {
            if (supportsScale(option.type)) {
                // Show scale configuration
                optionsGrid.addClass('lt-hidden')
                subtitle.setText('Configure scale (optional)')
                renderScaleConfig(scaleSection, option.label, (scale) => {
                    onSelect({ visualizationType: option.type, scale })
                })
                scaleSection.removeClass('lt-hidden')
            } else {
                // No scale config needed, submit directly
                onSelect({ visualizationType: option.type })
            }
        }

        optionBtn.addEventListener('click', handleSelect)

        // Keyboard handler
        optionBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect()
            }
        })
    }

    return card
}

/**
 * Render scale configuration UI
 */
function renderScaleConfig(
    container: HTMLElement,
    vizLabel: string,
    onConfirm: (scale: ScaleConfig | undefined) => void
): void {
    container.empty()

    const form = container.createDiv({ cls: 'lt-scale-form' })

    // Info text
    form.createDiv({
        cls: 'lt-scale-info',
        text: `Set min/max for ${vizLabel}. Leave empty for auto-detection.`
    })

    // Input row
    const inputRow = form.createDiv({ cls: 'lt-scale-inputs' })

    // Min input
    const minGroup = inputRow.createDiv({ cls: 'lt-scale-input-group' })
    minGroup.createSpan({ cls: 'lt-scale-label', text: 'Min' })
    const minInput = minGroup.createEl('input', {
        cls: 'lt-scale-input',
        type: 'number',
        placeholder: 'auto'
    })

    // Max input
    const maxGroup = inputRow.createDiv({ cls: 'lt-scale-input-group' })
    maxGroup.createSpan({ cls: 'lt-scale-label', text: 'Max' })
    const maxInput = maxGroup.createEl('input', {
        cls: 'lt-scale-input',
        type: 'number',
        placeholder: 'auto'
    })

    // Preset buttons for common scales
    const presetsRow = form.createDiv({ cls: 'lt-scale-presets' })
    presetsRow.createSpan({ cls: 'lt-scale-presets-label', text: 'Presets:' })

    for (const preset of SCALE_PRESETS) {
        const btn = presetsRow.createEl('button', {
            cls: 'lt-scale-preset-btn',
            text: preset.label
        })
        btn.addEventListener('click', () => {
            minInput.value = String(preset.min)
            maxInput.value = String(preset.max)
        })
    }

    // Buttons row
    const buttonsRow = form.createDiv({ cls: 'lt-scale-buttons' })

    const skipBtn = buttonsRow.createEl('button', {
        cls: 'lt-scale-btn lt-scale-btn--secondary',
        text: 'Skip (auto)'
    })
    skipBtn.addEventListener('click', () => {
        onConfirm(undefined)
    })

    const confirmBtn = buttonsRow.createEl('button', {
        cls: 'lt-scale-btn lt-scale-btn--primary',
        text: 'Confirm'
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
    })
}
