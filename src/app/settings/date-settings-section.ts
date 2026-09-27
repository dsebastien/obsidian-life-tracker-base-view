import type { Setting, SettingDefinitionPage } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { FilenameDatePattern } from '../types'
import {
    FILENAME_DATE_TOKENS,
    compileFilenameDatePattern,
    renderFilenameDatePatternExample
} from '../../utils'

/**
 * Declares the custom filename date patterns used for date anchoring (issue
 * #139) as a sub-page: the token reference, then the patterns as a list.
 *
 * The list gives delete, drag-to-reorder (patterns are tried in order) and add
 * natively. Each row keeps an inline text input with a live status line, so it
 * is drawn by a `render:` hook inside its own row.
 */
export class DateSettingsSection {
    /** Rendered pattern rows by pattern id, to move focus after a deletion */
    private readonly rowEls = new Map<string, HTMLElement>()

    constructor(
        private readonly plugin: LifeTrackerPlugin,
        /** Re-declares the settings tab so the list reflects the new state */
        private readonly refresh: () => void,
        /** Tells the user a change stayed in memory but was not saved */
        private readonly reportSaveFailure: (error: unknown) => void
    ) {}

    patternsPage(): SettingDefinitionPage {
        return {
            type: 'page',
            name: 'Filename date patterns',
            desc: 'Teach the plugin how your note filenames encode dates.',
            items: [
                {
                    type: 'group',
                    items: [
                        {
                            name: 'How patterns work',
                            desc: 'Patterns are tried in order, before the built-in formats (YYYY-MM-DD, YYYY-Www, YYYY-MM, YYYY-Qq, YYYY), which always keep working.',
                            render: (setting): (() => void) => {
                                // `.setting-item` is a flex row; the reference
                                // table below the description needs block flow
                                setting.settingEl.addClass('lt-settings-stack')
                                const helpEl = this.renderTokenHelp(setting.settingEl)
                                // update() re-runs this hook on the SAME row:
                                // only the control area is reset
                                return () => helpEl.remove()
                            }
                        }
                    ]
                },
                {
                    type: 'list',
                    heading: 'Patterns',
                    emptyState:
                        'No custom patterns. Only the built-in filename formats are recognized.',
                    addItem: {
                        name: 'Add pattern',
                        action: (): void => {
                            void this.mutate((patterns) => {
                                patterns.push({ id: crypto.randomUUID(), pattern: '' })
                            })
                        }
                    },
                    // Both callbacks get positions in the list as it is RENDERED.
                    // mutate() re-declares the list as soon as a change is
                    // committed to memory, so the rendered list and the
                    // in-memory array stay the same list: resolve the entry to
                    // its stable id here, then act on the id.
                    onDelete: (index: number): void => {
                        const target = this.plugin.settings.filenameDatePatterns[index]
                        if (!target) return
                        void this.mutate((patterns) => {
                            const at = patterns.findIndex((entry) => entry.id === target.id)
                            if (at !== -1) patterns.splice(at, 1)
                        })
                        this.focusRowNear(index)
                    },
                    onReorder: (oldIndex: number, newIndex: number): void => {
                        const target = this.plugin.settings.filenameDatePatterns[oldIndex]
                        if (!target) return
                        void this.mutate((patterns) => {
                            const at = patterns.findIndex((entry) => entry.id === target.id)
                            if (at === -1) return
                            const [moved] = patterns.splice(at, 1)
                            if (moved) patterns.splice(newIndex, 0, moved)
                        })
                    },
                    items: this.plugin.settings.filenameDatePatterns.map((pattern, index) => ({
                        name: `Pattern ${index + 1}`,
                        // Entries are data, not settings: keep them out of search
                        searchable: false,
                        render: (setting: Setting): (() => void) =>
                            this.renderPatternRow(setting, pattern.id)
                    }))
                }
            ]
        }
    }

    /**
     * Apply a change to the pattern list and re-declare the tab at once.
     *
     * `updateSettings` commits to memory before it awaits the save. The list
     * must be re-declared right then, not once the save lands: until it is,
     * the framework keeps the old rows (a deleted row stays drawn and focused),
     * and a second Delete on it would resolve its position against the new
     * array and remove the pattern that moved into that slot.
     */
    private async mutate(change: (patterns: FilenameDatePattern[]) => void): Promise<void> {
        const saved = this.plugin.updateSettings((draft) => {
            change(draft.filenameDatePatterns)
        })
        this.refresh()
        try {
            await saved
        } catch (error) {
            this.reportSaveFailure(error)
        }
    }

    /**
     * Keep the list usable from the keyboard after a deletion. Obsidian reuses
     * rows by position and moves focus within the reused row, but deleting the
     * last row removes it outright and focus falls back to the page. Focus the
     * row now at that position, only when focus was actually lost.
     */
    private focusRowNear(index: number): void {
        const patterns = this.plugin.settings.filenameDatePatterns
        const next = patterns[Math.min(index, patterns.length - 1)]
        const rowEl = next ? this.rowEls.get(next.id) : undefined
        if (!rowEl) return
        const active = rowEl.doc.activeElement
        if (active === null || active === rowEl.doc.body) {
            rowEl.focus()
        }
    }

    /**
     * Token reference table, so users don't have to leave settings to know what
     * they can write
     */
    private renderTokenHelp(containerEl: HTMLElement): HTMLElement {
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

        return helpEl
    }

    /**
     * One pattern: its text input and a live status line. Edits address the
     * pattern by id, never by the position the row was drawn at, so a reorder
     * or deletion racing a keystroke cannot redirect the write.
     *
     * Returns the cleanup that removes the status line, since a re-render
     * may reuse the row.
     */
    private renderPatternRow(setting: Setting, id: string): () => void {
        const current = this.plugin.settings.filenameDatePatterns.find((entry) => entry.id === id)
        const statusEl = setting.descEl.createDiv({ cls: 'lt-filename-pattern-status' })
        this.rowEls.set(id, setting.settingEl)

        setting.addText((text) => {
            text.setPlaceholder('Journal {{date}}')
                .setValue(current?.pattern ?? '')
                .onChange(async (value) => {
                    this.updateStatus(statusEl, value)
                    try {
                        await this.plugin.updateSettings((draft) => {
                            const target = draft.filenameDatePatterns.find(
                                (entry) => entry.id === id
                            )
                            if (target) {
                                target.pattern = value
                            }
                        })
                    } catch (error) {
                        this.reportSaveFailure(error)
                    }
                })
            text.inputEl.classList.add('lt-filename-pattern-input')
        })

        this.updateStatus(statusEl, current?.pattern ?? '')
        return () => {
            statusEl.remove()
            if (this.rowEls.get(id) === setting.settingEl) {
                this.rowEls.delete(id)
            }
        }
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
}
