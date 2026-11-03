import { Setting, type App } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { createCaptureTarget, type CaptureTarget } from '../types'
import { FolderSuggest } from '../components/ui/folder-suggest'
import { MarkdownFileSuggest } from '../components/ui/markdown-file-suggest'
import { captureTargetCommandName } from '../commands/capture-target-commands'
import { definitionsForDestination } from '../services/capture-target.utils'

/** Note type dropdown value for a target that does not use the Starter Kit */
const STANDALONE_OPTION = ''

/** Split a comma- or space-separated tag field into tags, `#` dropped */
export function parseTagField(text: string): string[] {
    return text
        .split(/[\s,]+/)
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter((tag) => tag.length > 0)
}

/**
 * The "Capture targets" settings page: named destinations other than the
 * daily note (see `documentation/plans/capture-targets.md`).
 *
 * Text fields save on every keystroke without redrawing (a redraw would steal
 * the focus); structural edits (note type, filters, add, delete) redraw.
 */
export class CaptureTargetSection {
    constructor(
        private readonly plugin: LifeTrackerPlugin,
        private readonly app: App,
        private readonly requestRerender: () => void
    ) {}

    render(containerEl: HTMLElement): void {
        const desc = new DocumentFragment()
        desc.createDiv({
            text: 'A capture target sends properties to a note other than the daily note, for example the strength session of the day. Each target gets a "Capture today: <target>" command, and the quick-add panel groups its rows by target.'
        })
        desc.createDiv({
            text: 'A property uses the target picked in its "Capture into" setting. With the Obsidian Starter Kit, a linked property uses the one target of its note type automatically.'
        })
        new Setting(containerEl).setDesc(desc)

        const list = containerEl.createDiv({ cls: 'lt-capture-targets' })
        const targets = this.plugin.settings.captureTargets
        if (targets.length === 0) {
            list.createDiv({
                cls: 'lt-presets-empty',
                text: 'No capture targets. Every property goes to the daily note.'
            })
        }
        for (const target of targets) {
            this.renderTarget(list, target)
        }

        new Setting(containerEl).addButton((button) => {
            button
                .setButtonText('Add capture target')
                .setCta()
                .onClick(async () => {
                    await this.plugin.updateSettings((draft) => {
                        draft.captureTargets.push(
                            createCaptureTarget(crypto.randomUUID(), 'New target')
                        )
                    })
                    this.requestRerender()
                })
        })
    }

    /** Save an edit to one target, found by id in the draft */
    private async update(id: string, edit: (target: CaptureTarget) => void): Promise<void> {
        await this.plugin.updateSettings((draft) => {
            const target = draft.captureTargets.find((candidate) => candidate.id === id)
            if (target) edit(target)
        })
    }

    private renderTarget(container: HTMLElement, target: CaptureTarget): void {
        const card = container.createDiv({ cls: 'lt-capture-target' })

        new Setting(card)
            .setName('Name')
            .setDesc(`Command: ${captureTargetCommandName(target)}`)
            .addText((text) => {
                text.setPlaceholder('Through the day')
                    .setValue(target.name)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.name = value
                        })
                    })
            })
            .addExtraButton((button) => {
                button
                    .setIcon('trash')
                    .setTooltip('Delete capture target')
                    .onClick(async () => {
                        await this.plugin.updateSettings((draft) => {
                            draft.captureTargets = draft.captureTargets.filter(
                                (candidate) => candidate.id !== target.id
                            )
                            // A definition naming the deleted target falls back to
                            // automatic; drop the dangling id so settings stay clean
                            for (const definition of draft.propertyDefinitions) {
                                if (definition.captureTargetId === target.id) {
                                    delete definition.captureTargetId
                                }
                            }
                        })
                        this.requestRerender()
                    })
            })

        this.renderNoteType(card, target)

        if (!target.noteTypeId) {
            this.renderStandaloneFields(card, target)
        }

        new Setting(card)
            .setName('Template')
            .setDesc(
                target.noteTypeId
                    ? 'Optional. Overrides the note type template for notes created from this target.'
                    : 'Optional. Applied through Templater when the note is created.'
            )
            .addText((text) => {
                text.setPlaceholder(target.noteTypeId ? 'Note type template' : 'No template')
                    .setValue(target.templatePath)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.templatePath = value.trim()
                        })
                    })
                new MarkdownFileSuggest(text.inputEl, this.app)
            })

        new Setting(card)
            .setName('Date property')
            .setDesc(
                'Frontmatter property that holds the date of the note. Written when the note is created and used to find it. Views use the date property when no date is in the file name.'
            )
            .addText((text) => {
                text.setPlaceholder('Property name')
                    .setValue(target.dateProperty)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.dateProperty = value.trim()
                        })
                    })
            })

        this.renderFilters(card, target)
        this.renderUsage(card, target)
    }

    private renderNoteType(container: HTMLElement, target: CaptureTarget): void {
        const options: Record<string, string> = {
            [STANDALONE_OPTION]: 'Folder and file name (no Starter Kit)'
        }
        const noteTypes = this.plugin.starterKit
            .listNoteTypes()
            .filter((noteType) => noteType.associatedFolder)
        for (const noteType of noteTypes) {
            options[noteType.id] = noteType.name
        }
        // A stored note type that is not available now must stay visible,
        // never look like "standalone"
        if (target.noteTypeId && !Object.hasOwn(options, target.noteTypeId)) {
            options[target.noteTypeId] = `Unavailable note type (${target.noteTypeId})`
        }

        new Setting(container)
            .setName('Note type')
            .setDesc(
                this.plugin.starterKit.isAvailable()
                    ? 'A Starter Kit note type gives the folder, name, template and tags of the note. Notes are found by the note type, the match filter and the date.'
                    : 'Without the Obsidian Starter Kit, set the folder and file name below.'
            )
            .addDropdown((dropdown) => {
                dropdown
                    .addOptions(options)
                    .setValue(target.noteTypeId)
                    .onChange(async (value) => {
                        if (!Object.hasOwn(options, value)) return
                        await this.update(target.id, (t) => {
                            t.noteTypeId = value
                        })
                        this.requestRerender()
                    })
            })
    }

    private renderStandaloneFields(container: HTMLElement, target: CaptureTarget): void {
        new Setting(container)
            .setName('Folder')
            .setDesc(
                'Where the notes live. Placeholders such as {{year}} are filled in from the date. Only this folder is searched.'
            )
            .addText((text) => {
                text.setPlaceholder('Sessions/{{year}}')
                    .setValue(target.folder)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.folder = value.trim()
                        })
                    })
                new FolderSuggest(text.inputEl, this.app)
            })

        new Setting(container)
            .setName('File name')
            .setDesc(
                'Name of a new note, without .md. Use {{date}} for the date. When the name is taken, a number is added after the date.'
            )
            .addText((text) => {
                text.setPlaceholder('{{date}} (Workout)')
                    .setValue(target.fileNamePattern)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.fileNamePattern = value
                        })
                    })
            })

        new Setting(container)
            .setName('Tags')
            .setDesc(
                'Optional. Tags a note must have to belong to this target, separated by commas. Added to a new note.'
            )
            .addText((text) => {
                text.setPlaceholder('Workout')
                    .setValue(target.tags.join(', '))
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            t.tags = parseTagField(value)
                        })
                    })
            })
    }

    private renderFilters(container: HTMLElement, target: CaptureTarget): void {
        new Setting(container)
            .setName('Match filter')
            .setDesc(
                'Property values a note must have, for example the kind of workout. All must match. Written into a new note.'
            )
            .addButton((button) => {
                button
                    .setIcon('plus')
                    .setTooltip('Add filter')
                    .onClick(async () => {
                        await this.update(target.id, (t) => {
                            t.filters.push({ property: '', value: '' })
                        })
                        this.requestRerender()
                    })
            })

        target.filters.forEach((filter, index) => {
            const row = new Setting(container)
            row.settingEl.addClass('lt-capture-target-filter')
            row.addText((text) => {
                text.setPlaceholder('Property')
                    .setValue(filter.property)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            const pair = t.filters[index]
                            if (pair) pair.property = value
                        })
                    })
            })
            row.addText((text) => {
                text.setPlaceholder('Value')
                    .setValue(filter.value)
                    .onChange(async (value) => {
                        await this.update(target.id, (t) => {
                            const pair = t.filters[index]
                            if (pair) pair.value = value
                        })
                    })
            })
            row.addExtraButton((button) => {
                button
                    .setIcon('trash')
                    .setTooltip('Remove filter')
                    .onClick(async () => {
                        await this.update(target.id, (t) => {
                            t.filters.splice(index, 1)
                        })
                        this.requestRerender()
                    })
            })
        })
    }

    /** Which properties go to this target, so the setup can be checked here */
    private renderUsage(container: HTMLElement, target: CaptureTarget): void {
        const { propertyDefinitions, captureTargets } = this.plugin.settings
        const using = definitionsForDestination(propertyDefinitions, captureTargets, target)
        const names = using.map((definition) => definition.displayName || definition.name)
        new Setting(container)
            .setName('Properties')
            .setDesc(
                names.length > 0
                    ? names.join(', ')
                    : 'No property uses this target yet. Pick it in a property\'s "Capture into" setting.'
            )
    }
}
