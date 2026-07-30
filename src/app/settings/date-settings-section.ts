import { Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { FilenameDatePattern } from '../types'
import {
    FILENAME_DATE_TOKENS,
    compileFilenameDatePattern,
    renderFilenameDatePatternExample
} from '../../utils'

/**
 * Renders and manages the "Dates" settings tab: the first day of the week and
 * the custom filename date patterns used for date anchoring (issue #139).
 */
export class DateSettingsSection {
    constructor(
        private readonly plugin: LifeTrackerPlugin,
        private readonly requestRerender: () => void
    ) {}

    render(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('First day of the week')
            .setDesc(
                'Starting day for week grouping and heatmap columns. ISO week labels stay Monday-based.'
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions({ '1': 'Monday', '0': 'Sunday' })
                    .setValue(String(this.plugin.settings.weekStartsOn))
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.weekStartsOn = value === '0' ? 0 : 1
                        })
                    })
            })

        new Setting(containerEl).setName('Filename date patterns').setHeading()

        const desc = new DocumentFragment()
        desc.createDiv({
            text: 'Teach the plugin how your note filenames encode dates. Patterns are tried in order, before the built-in formats (YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY), which always keep working.'
        })
        new Setting(containerEl).setDesc(desc)

        this.renderTokenHelp(containerEl)

        const patternsContainer = containerEl.createDiv({ cls: 'lt-filename-patterns-container' })
        this.renderPatternsList(patternsContainer)

        new Setting(containerEl).addButton((button) => {
            button
                .setButtonText('Add pattern')
                .setIcon('plus')
                .onClick(async () => {
                    await this.addNewPattern()
                    this.requestRerender()
                })
        })
    }

    /**
     * Token reference table, so users don't have to leave settings to know what
     * they can write
     */
    private renderTokenHelp(containerEl: HTMLElement): void {
        const helpEl = containerEl.createDiv({ cls: 'lt-filename-pattern-help' })

        for (const token of FILENAME_DATE_TOKENS) {
            const rowEl = helpEl.createDiv({ cls: 'lt-filename-pattern-help-row' })
            rowEl.createSpan({ cls: 'lt-filename-pattern-token', text: `{{${token.name}}}` })
            rowEl.createSpan({ text: token.description })
        }

        const wildcardRow = helpEl.createDiv({ cls: 'lt-filename-pattern-help-row' })
        wildcardRow.createSpan({ cls: 'lt-filename-pattern-token', text: '*' })
        wildcardRow.createSpan({ text: 'Any text, e.g. * {{date}} matches "Journal 2026-07-30"' })
    }

    private renderPatternsList(container: HTMLElement): void {
        container.empty()

        const patterns = this.plugin.settings.filenameDatePatterns

        if (patterns.length === 0) {
            container.createDiv({
                cls: 'lt-presets-empty',
                text: 'No custom patterns. Only the built-in filename formats are recognized.'
            })
            return
        }

        for (const pattern of patterns) {
            this.renderPatternItem(container, pattern)
        }
    }

    private renderPatternItem(container: HTMLElement, pattern: FilenameDatePattern): void {
        const setting = new Setting(container)
        const statusEl = setting.descEl.createDiv({ cls: 'lt-filename-pattern-status' })

        setting.addText((text) => {
            text.setPlaceholder('Journal {{date}}')
                .setValue(pattern.pattern)
                .onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        const target = draft.filenameDatePatterns.find((p) => p.id === pattern.id)
                        if (target) {
                            target.pattern = value
                        }
                    })
                    this.updateStatus(statusEl, value)
                })
            text.inputEl.classList.add('lt-filename-pattern-input')
        })

        setting.addExtraButton((button) => {
            button
                .setIcon('trash')
                .setTooltip('Delete pattern')
                .onClick(async () => {
                    await this.deletePattern(pattern.id)
                    this.requestRerender()
                })
        })

        this.updateStatus(statusEl, pattern.pattern)
    }

    /**
     * Show either the validation error or a live example of a matching filename
     */
    private updateStatus(statusEl: HTMLElement, pattern: string): void {
        statusEl.removeClass('lt-filename-pattern-status--error')
        statusEl.removeClass('lt-filename-pattern-status--valid')

        if (!pattern.trim()) {
            statusEl.textContent =
                'Use {{date}}, {{year}}, {{month}}, {{day}}, {{week}}, {{quarter}} and * to describe your filenames.'
            return
        }

        const result = compileFilenameDatePattern(pattern)

        if (!result.ok) {
            statusEl.addClass('lt-filename-pattern-status--error')
            statusEl.textContent = result.error
            return
        }

        const example = renderFilenameDatePatternExample(pattern, new Date())
        statusEl.addClass('lt-filename-pattern-status--valid')
        statusEl.textContent = `Matches "${example}" — ${result.compiled.granularity} notes`
    }

    private async addNewPattern(): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            draft.filenameDatePatterns.push({ id: crypto.randomUUID(), pattern: '' })
        })
    }

    private async deletePattern(id: string): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            draft.filenameDatePatterns = draft.filenameDatePatterns.filter((p) => p.id !== id)
        })
    }
}
