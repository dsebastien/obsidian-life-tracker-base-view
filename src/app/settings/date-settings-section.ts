import { Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { FilenameDatePattern } from '../types'
import { StarterKitService } from '../services/starter-kit.service'
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

        this.renderNoteCreationSettings(containerEl)

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
     * Creating a note for a date that has none (issue #160).
     *
     * Off by default, and the location always comes from a plugin the user has
     * already configured — the Starter Kit note type chosen here, or failing
     * that the Periodic Notes plugin. Life Tracker never invents a folder.
     */
    private renderNoteCreationSettings(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('Creating missing notes').setHeading()

        new Setting(containerEl)
            .setName('Create missing notes when capturing')
            .setDesc(
                'When capturing for a date with no note, offer to create it. The folder and template come from the Starter Kit note type below, or from the periodic notes plugin.'
            )
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.createMissingNotes).onChange(async (value) => {
                    await this.plugin.updateSettings((draft) => {
                        draft.createMissingNotes = value
                    })
                    this.requestRerender()
                })
            })

        if (!this.plugin.settings.createMissingNotes) return

        const starterKit = new StarterKitService(this.plugin.app)
        if (!starterKit.isAvailable()) {
            new Setting(containerEl).setDesc(
                'The Obsidian Starter Kit is not available, so new notes follow the periodic notes plugin.'
            )
            return
        }

        const noteTypes = starterKit.listNoteTypes().filter((noteType) => noteType.associatedFolder)
        if (noteTypes.length === 0) {
            new Setting(containerEl).setDesc(
                'No Starter Kit note type has a folder configured, so new notes follow the periodic notes plugin.'
            )
            return
        }

        const options: Record<string, string> = { '': 'Use the periodic notes plugin' }
        for (const noteType of noteTypes) {
            options[noteType.id] = noteType.name
        }

        new Setting(containerEl)
            .setName('Starter Kit note type for daily notes')
            .setDesc(
                'Which note type describes a daily note. Its folder, template, name affixes and tags are used when creating one.'
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(options)
                    // A note type that no longer exists must not look selected
                    .setValue(
                        options[this.plugin.settings.dailyNoteTypeId] !== undefined
                            ? this.plugin.settings.dailyNoteTypeId
                            : ''
                    )
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.dailyNoteTypeId = value
                        })
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

        const folderRow = helpEl.createDiv({ cls: 'lt-filename-pattern-help-row' })
        folderRow.createSpan({ cls: 'lt-filename-pattern-token', text: '/' })
        folderRow.createSpan({
            text: 'A pattern containing / matches the note path, so daily/{{date}} only matches notes inside the daily folder'
        })
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
        const scope = result.compiled.matchesPath ? 'path' : 'name'
        statusEl.addClass('lt-filename-pattern-status--valid')
        statusEl.textContent = `Matches ${scope} "${example}" — ${result.compiled.granularity} notes`
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
