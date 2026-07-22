import type { ValidationResult, PropertyEditorConfig } from '../../types'
import {
    validateList,
    validateTags,
    parseListValue,
    parseTagsValue,
    isInAllowedValues,
    isTagAllowed
} from '../../../utils'
import { BasePropertyEditor } from './base-editor'

/**
 * List/Tags editor - renders as a pill/chip editor with add/remove
 */
export class ListEditor extends BasePropertyEditor {
    private wrapperEl: HTMLElement | null = null
    private inputEl: HTMLInputElement | null = null
    private pillsEl: HTMLElement | null = null
    private suggestionsEl: HTMLElement | null = null
    private currentValues: string[] = []
    private activeSuggestionIndex = -1
    private rejectedTimer: number | null = null

    constructor(config: PropertyEditorConfig) {
        super(config)
        this.currentValues = this.parseValues(config.value)
    }

    render(container: HTMLElement): void {
        this.containerEl = container
        container.empty()

        this.wrapperEl = container.createDiv({
            cls: this.config.compact ? 'lt-editor-list lt-editor-list--compact' : 'lt-editor-list'
        })

        // Pills container
        this.pillsEl = this.wrapperEl.createDiv({ cls: 'lt-editor-list-pills' })
        this.renderPills()

        // Input for adding new items
        this.inputEl = this.wrapperEl.createEl('input', {
            cls: 'lt-editor-list-input',
            type: 'text',
            placeholder: this.hasAllowedValues() ? 'Select...' : 'Add item...',
            attr: {
                'role': 'combobox',
                'aria-autocomplete': 'list',
                'aria-expanded': 'false',
                'aria-label': this.config.definition.displayName || this.config.definition.name
            }
        })

        // Suggestions dropdown
        this.suggestionsEl = this.wrapperEl.createDiv({
            cls: 'lt-editor-list-suggestions lt-hidden',
            attr: { role: 'listbox' }
        })

        this.setupEventHandlers()
    }

    private setupEventHandlers(): void {
        if (!this.inputEl) return

        this.inputEl.addEventListener('focus', () => {
            this.showSuggestions()
        })

        this.inputEl.addEventListener('blur', () => {
            // Delay to allow click on suggestion
            window.setTimeout(() => {
                this.hideSuggestions()
                this.notifyCommit()
            }, 150)
        })

        this.inputEl.addEventListener('input', () => {
            this.showSuggestions()
        })

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                // Move the highlight through visible suggestions (issue #110)
                const count = this.getSuggestionItems().length
                if (count > 0) {
                    e.preventDefault()
                    const delta = e.key === 'ArrowDown' ? 1 : -1
                    this.highlightSuggestion((this.activeSuggestionIndex + delta + count) % count)
                }
            } else if (e.key === 'Enter') {
                e.preventDefault()
                const active = this.getSuggestionItems()[this.activeSuggestionIndex]
                if (active && !this.suggestionsEl?.hasClass('lt-hidden')) {
                    // Add the highlighted suggestion
                    this.addValue(active.getText())
                } else if (!this.inputEl?.value.trim()) {
                    // If input is empty, navigate to next field
                    this.notifyEnterKey()
                } else {
                    this.addCurrentInput()
                }
            } else if (e.key === 'Backspace' && this.inputEl?.value === '') {
                // Remove last pill
                if (this.currentValues.length > 0) {
                    this.currentValues.pop()
                    this.renderPills()
                    this.notifyChange(this.getValue())
                }
            } else if (e.key === 'Escape') {
                this.hideSuggestions()
            }
        })

        // Handle paste - validate and add each pasted value
        this.inputEl.addEventListener('paste', (e) => {
            const pastedText = e.clipboardData?.getData('text') ?? ''
            if (!pastedText) return

            e.preventDefault()

            // Split pasted text by common delimiters
            const values = pastedText
                .split(/[,\n\r]+/)
                .map((v) => v.trim())
                .filter(Boolean)

            // Try to add each value (addValue will block non-allowed values)
            for (const value of values) {
                this.addValue(value)
            }
        })
    }

    private renderPills(): void {
        if (!this.pillsEl) return
        this.pillsEl.empty()

        for (const value of this.currentValues) {
            const pill = this.pillsEl.createDiv({ cls: 'lt-editor-list-pill' })

            const isTags = this.config.definition.type === 'tags'
            const displayValue = isTags && !value.startsWith('#') ? `#${value}` : value

            pill.createSpan({
                cls: 'lt-editor-list-pill-text',
                text: displayValue
            })

            const removeBtn = pill.createSpan({
                cls: 'lt-editor-list-pill-remove',
                text: '×'
            })

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                this.removeValue(value)
            })
        }
    }

    private showSuggestions(): void {
        if (!this.suggestionsEl || !this.inputEl) return

        const allowedValues = this.config.definition.allowedValues
        if (allowedValues.length === 0) {
            this.hideSuggestions()
            return
        }

        const inputValue = this.inputEl.value.toLowerCase()

        // Filter suggestions (convert to strings first)
        const availableSuggestions = allowedValues
            .map((v) => String(v))
            .filter((v) => {
                const normalizedV = v.toLowerCase().replace(/^#/, '')
                const normalizedInput = inputValue.replace(/^#/, '')

                // Not already selected
                const isSelected = this.currentValues.some(
                    (cv) => cv.toLowerCase().replace(/^#/, '') === normalizedV
                )

                // Matches input
                const matchesInput = normalizedInput === '' || normalizedV.includes(normalizedInput)

                return !isSelected && matchesInput
            })

        if (availableSuggestions.length === 0) {
            this.hideSuggestions()
            return
        }

        this.suggestionsEl.empty()
        this.suggestionsEl.removeClass('lt-hidden')
        this.inputEl.setAttribute('aria-expanded', 'true')
        this.activeSuggestionIndex = -1

        for (const suggestion of availableSuggestions) {
            const item = this.suggestionsEl.createDiv({
                cls: 'lt-editor-list-suggestion',
                text: suggestion,
                attr: { 'role': 'option', 'aria-selected': 'false' }
            })

            item.addEventListener('mousedown', (e) => {
                e.preventDefault()
                this.addValue(suggestion)
            })
        }
    }

    private hideSuggestions(): void {
        if (this.suggestionsEl) {
            this.suggestionsEl.addClass('lt-hidden')
        }
        this.inputEl?.setAttribute('aria-expanded', 'false')
        this.activeSuggestionIndex = -1
    }

    private getSuggestionItems(): HTMLElement[] {
        if (!this.suggestionsEl || this.suggestionsEl.hasClass('lt-hidden')) return []
        return Array.from(
            this.suggestionsEl.querySelectorAll<HTMLElement>('.lt-editor-list-suggestion')
        )
    }

    private highlightSuggestion(index: number): void {
        const items = this.getSuggestionItems()
        this.activeSuggestionIndex = index

        items.forEach((item, i) => {
            const isActive = i === index
            item.toggleClass('lt-editor-list-suggestion--active', isActive)
            item.setAttribute('aria-selected', isActive ? 'true' : 'false')
            if (isActive) {
                item.scrollIntoView({ block: 'nearest' })
            }
        })
    }

    private addCurrentInput(): void {
        if (!this.inputEl) return

        const value = this.inputEl.value.trim()
        if (value) {
            this.addValue(value)
        }
    }

    private addValue(value: string): void {
        // Normalize value
        let normalizedValue = value.trim()

        // For tags, ensure proper format
        if (this.config.definition.type === 'tags') {
            normalizedValue = normalizedValue.replace(/^#/, '')
        }

        // Block if not in allowed values (when allowed values are defined)
        const allowedValues = this.config.definition.allowedValues
        if (allowedValues.length > 0) {
            const isAllowed =
                this.config.definition.type === 'tags'
                    ? isTagAllowed(normalizedValue, allowedValues)
                    : isInAllowedValues(normalizedValue, allowedValues)

            if (!isAllowed) {
                // Give visual feedback instead of silently discarding the input
                this.flashRejected(`"${value}" is not an allowed value`)
                return
            }
        }

        // Check if already exists
        const exists = this.currentValues.some(
            (v) => v.toLowerCase() === normalizedValue.toLowerCase()
        )

        if (!exists && normalizedValue) {
            this.currentValues.push(normalizedValue)
            this.renderPills()
            this.notifyChange(this.getValue())
        }

        if (this.inputEl) {
            this.inputEl.value = ''
        }
        this.hideSuggestions()
    }

    /**
     * Signal that the typed value was rejected (not in the allowed set): shake the
     * input, keep + select the text so it can be corrected, and show a brief inline
     * message. Auto-clears after a short delay.
     */
    private flashRejected(message: string): void {
        if (!this.inputEl) return

        this.inputEl.addClass('lt-editor-list-input--rejected')
        this.inputEl.select()
        this.hideSuggestions()

        let errorEl = this.wrapperEl?.querySelector<HTMLElement>('.lt-editor-list-error') ?? null
        if (!errorEl && this.wrapperEl) {
            errorEl = this.wrapperEl.createDiv({
                cls: 'lt-editor-list-error',
                attr: { role: 'alert' }
            })
        }
        errorEl?.setText(message)

        if (this.rejectedTimer !== null) {
            window.clearTimeout(this.rejectedTimer)
        }
        this.rejectedTimer = window.setTimeout(() => {
            this.inputEl?.removeClass('lt-editor-list-input--rejected')
            errorEl?.remove()
            this.rejectedTimer = null
        }, 1600)
    }

    private removeValue(value: string): void {
        this.currentValues = this.currentValues.filter(
            (v) => v.toLowerCase() !== value.toLowerCase()
        )
        this.renderPills()
        this.notifyChange(this.getValue())
    }

    private parseValues(value: unknown): string[] {
        if (this.config.definition.type === 'tags') {
            return parseTagsValue(value).map((v) => v.replace(/^#/, ''))
        }
        return parseListValue(value)
    }

    private hasAllowedValues(): boolean {
        return this.config.definition.allowedValues.length > 0
    }

    getValue(): unknown {
        if (this.config.definition.type === 'tags') {
            // Return with # prefix
            return this.currentValues.map((v) => (v.startsWith('#') ? v : `#${v}`))
        }
        return this.currentValues
    }

    setValue(value: unknown): void {
        this.currentValues = this.parseValues(value)
        this.renderPills()
    }

    focus(): void {
        if (this.inputEl) {
            this.inputEl.focus()
        }
    }

    validate(): ValidationResult {
        if (this.config.definition.required && this.currentValues.length === 0) {
            return { valid: false, error: 'At least one value is required' }
        }

        if (this.currentValues.length === 0) {
            return { valid: true }
        }

        if (this.config.definition.type === 'tags') {
            return validateTags(this.getValue(), this.config.definition)
        }
        return validateList(this.getValue(), this.config.definition)
    }

    override destroy(): void {
        if (this.rejectedTimer !== null) {
            window.clearTimeout(this.rejectedTimer)
            this.rejectedTimer = null
        }
        this.wrapperEl = null
        this.inputEl = null
        this.pillsEl = null
        this.suggestionsEl = null
        super.destroy()
    }
}
