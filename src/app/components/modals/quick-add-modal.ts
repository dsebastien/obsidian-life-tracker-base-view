import { Modal, Notice, setIcon, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../../plugin'
import type { CaptureTarget, PropertyDefinition, PropertyEditor } from '../../types'
import { FrontmatterService } from '../../services/frontmatter.service'
import { PropertyRecognitionService } from '../../services/property-recognition.service'
import { isShownInQuickAdd } from '../../services/quick-add.utils'
import { destinationName, findCaptureNote, withCaptureNote } from '../../commands/capture-note'
import { definitionsForDestination, groupByDestination } from '../../services/capture-target.utils'
import { createPropertyEditor } from '../editing/property-editor'
import { AUTO_SAVE_DEBOUNCE_MS } from '../editing/editing.constants'
import { PropertyCaptureModal } from './property-capture-modal'
import { addDays, formatDateISO, isSameDay, log } from '../../../utils'

interface PendingSave {
    timerId: number
    file: TFile
    definition: PropertyDefinition
}

/** One destination of the panel: the daily note, or a capture target's note */
interface DestinationSection {
    /** Null for the daily note */
    target: CaptureTarget | null
    definitions: PropertyDefinition[]
}

/**
 * Quick-add panel (issue #122): every quick-add property of one day, all at
 * once, each editable in place and saved as it changes. No Next / Done: it is
 * for logging one or two values fast, the capture carousel stays the place
 * for a full check-in.
 *
 * Rows are grouped by destination: the daily note, then each capture target
 * (e.g. the day's strength session). With the daily note as the only
 * destination the panel has no group headers, exactly as before targets.
 */
export class QuickAddModal extends Modal {
    private readonly frontmatterService: FrontmatterService
    private readonly recognitionService: PropertyRecognitionService

    private date: Date
    private editors: PropertyEditor[] = []
    /** Latest value per note and property (`path::name`), updated on every change */
    private currentValues: Record<string, unknown> = {}
    private pendingSaves = new Map<string, PendingSave>()

    constructor(
        private readonly plugin: LifeTrackerPlugin,
        date: Date
    ) {
        super(plugin.app)
        this.date = date
        this.frontmatterService = new FrontmatterService(plugin.app)
        this.recognitionService = new PropertyRecognitionService(plugin.app)
    }

    /**
     * Whether the panel is showing. A note creation can finish after the
     * panel was closed; its callback must not draw editors into a closed
     * panel, where nothing would ever destroy them.
     */
    private isOpen = false

    override onOpen(): void {
        this.isOpen = true
        this.contentEl.addClass('lt-quick-add-modal')
        this.render()
    }

    override onClose(): void {
        this.isOpen = false
        this.teardown()
        this.contentEl.empty()
    }

    /**
     * Notes found or created from this panel, per destination and day, for
     * when the metadata cache has not caught up with them yet.
     */
    private readonly knownFiles = new Map<string, TFile>()

    private knownFile(target: CaptureTarget | null): TFile | null {
        const file = this.knownFiles.get(knownFileKey(target, this.date))
        // A note deleted meanwhile is not shown
        return file && this.app.vault.getFileByPath(file.path) ? file : null
    }

    /** Redraw for a day after an asynchronous step, only if still relevant */
    private rerenderIfShowing(date: Date): void {
        // The panel may be closed, or showing another day, by now
        if (!this.isOpen || !isSameDay(this.date, date)) return
        this.teardown()
        this.render()
    }

    /** Flush typed edits still waiting on the debounce, then drop the editors */
    private teardown(): void {
        this.flushPendingSaves()
        for (const editor of this.editors) {
            editor.destroy()
        }
        this.editors = []
        this.currentValues = {}
    }

    private goToDay(date: Date): void {
        this.teardown()
        this.date = date
        this.render()
    }

    /** The destinations to show: those with at least one quick-add property */
    private sections(): DestinationSection[] {
        const { propertyDefinitions, captureTargets } = this.plugin.settings
        const groups = groupByDestination(
            propertyDefinitions.filter(isShownInQuickAdd),
            captureTargets
        )
        // Nothing marked for quick add: the daily note section explains it
        return groups.length > 0 ? groups : [{ target: null, definitions: [] }]
    }

    private render(): void {
        const { contentEl } = this
        contentEl.empty()

        this.renderHeader(contentEl)

        const sections = this.sections()
        const grouped = !(sections.length === 1 && sections[0]?.target === null)

        let dailyFile: TFile | null = null
        for (const section of sections) {
            const file =
                findCaptureNote(this.plugin, section.target, this.date) ??
                this.knownFile(section.target)
            if (!section.target) dailyFile = file

            const sectionEl = grouped
                ? contentEl.createDiv({ cls: 'lt-quick-add-section' })
                : contentEl
            if (grouped) this.renderSectionHeader(sectionEl, section.target, file)

            const body = sectionEl.createDiv({ cls: 'lt-quick-add-body' })
            if (!file) {
                this.renderMissingNote(body, section.target)
                continue
            }

            // A capture target decides where its properties go; only the
            // daily note is filtered by the properties' note filtering
            const definitions = section.target
                ? section.definitions
                : this.recognitionService.getApplicableProperties(file, section.definitions)
            if (definitions.length === 0) {
                body.createDiv({
                    cls: 'lt-quick-add-empty',
                    text: grouped
                        ? `No quick-add properties apply to ${file.basename}.`
                        : 'No quick-add properties apply to this note. Turn on "Show in quick add" on a property in settings > Life Tracker > property definitions.'
                })
                continue
            }

            const values = this.frontmatterService.read(file)
            for (const definition of definitions) {
                this.renderRow(body, file, definition, values[definition.name])
            }
        }

        // Ungrouped, the panel keeps its single footer button
        if (!grouped && dailyFile) this.renderFooter(contentEl, dailyFile)
    }

    /** A group's title, with a full-capture shortcut once its note exists */
    private renderSectionHeader(
        container: HTMLElement,
        target: CaptureTarget | null,
        file: TFile | null
    ): void {
        const header = container.createDiv({ cls: 'lt-quick-add-section-header' })
        header.createSpan({ cls: 'lt-quick-add-section-title', text: destinationName(target) })
        if (!file) return
        const captureBtn = header.createEl('button', {
            cls: 'lt-quick-add-section-capture',
            text: 'Full capture'
        })
        captureBtn.addEventListener('click', () => this.openFullCapture(file, target))
    }

    /** Close the panel and open the capture dialog on one destination's note */
    private openFullCapture(file: TFile, target: CaptureTarget | null): void {
        this.close()
        const { propertyDefinitions, captureTargets } = this.plugin.settings
        const definitions = definitionsForDestination(propertyDefinitions, captureTargets, target)
        new PropertyCaptureModal(this.plugin, {
            mode: 'single-note',
            file,
            definitions,
            ignoreMappings: target !== null
        }).open()
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'lt-quick-add-header' })

        const prevBtn = header.createEl('button', {
            cls: 'lt-carousel-file-nav-btn',
            attr: { 'aria-label': 'Previous day' }
        })
        setIcon(prevBtn, 'chevron-left')
        prevBtn.addEventListener('click', () => this.goToDay(addDays(this.date, -1)))

        const titleEl = header.createDiv({ cls: 'lt-quick-add-title' })
        titleEl.createSpan({
            cls: 'lt-quick-add-weekday',
            text: this.date.toLocaleDateString(undefined, { weekday: 'long' })
        })
        titleEl.createSpan({ cls: 'lt-quick-add-date', text: formatDateISO(this.date) })

        const nextBtn = header.createEl('button', {
            cls: 'lt-carousel-file-nav-btn',
            attr: { 'aria-label': 'Next day' }
        })
        setIcon(nextBtn, 'chevron-right')
        nextBtn.addEventListener('click', () => this.goToDay(addDays(this.date, 1)))

        if (!isSameDay(this.date, new Date())) {
            const todayBtn = header.createEl('button', {
                cls: 'lt-quick-add-today-btn',
                text: 'Today'
            })
            todayBtn.addEventListener('click', () => this.goToDay(new Date()))
        }
    }

    private renderMissingNote(container: HTMLElement, target: CaptureTarget | null): void {
        const empty = container.createDiv({ cls: 'lt-quick-add-empty' })
        empty.createDiv({
            text: target
                ? `No "${destinationName(target)}" note for this day.`
                : 'No note for this day.'
        })

        if (!this.plugin.settings.createMissingNotes) {
            empty.createDiv({
                cls: 'lt-quick-add-hint',
                text: 'Turn on "Create missing notes when capturing" in settings to create it from here.'
            })
            return
        }

        const createBtn = empty.createEl('button', { cls: 'mod-cta', text: 'Create note' })
        const date = this.date
        createBtn.addEventListener('click', () => {
            // For a target, the disk is checked before creation is offered: a
            // note the cache has not indexed yet is shown, not created twice
            withCaptureNote(this.plugin, target, date, (file) => {
                // Remember it: the cache may not show it yet on the redraw
                this.knownFiles.set(knownFileKey(target, date), file)
                this.rerenderIfShowing(date)
            })
        })
    }

    private renderRow(
        container: HTMLElement,
        file: TFile,
        definition: PropertyDefinition,
        value: unknown
    ): void {
        const row = container.createDiv({ cls: 'lt-quick-add-row' })
        row.createDiv({
            cls: 'lt-quick-add-label',
            text: definition.displayName || definition.name
        })
        const editorEl = row.createDiv({ cls: 'lt-quick-add-editor' })

        const key = valueKey(file, definition)
        this.currentValues[key] = value

        const editor = createPropertyEditor({
            definition,
            value,
            compact: false,
            onChange: (newValue) => {
                this.currentValues[key] = newValue
                const valid = this.frontmatterService.validate(newValue, definition).valid
                row.toggleClass('lt-quick-add-row--invalid', !valid)
                this.debouncedSave(file, definition)
            },
            onCommit: () => {
                this.cancelPendingSave(key)
                this.saveImmediate(file, definition)
            }
        })

        editor.render(editorEl)
        this.editors.push(editor)
    }

    private renderFooter(container: HTMLElement, file: TFile): void {
        const footer = container.createDiv({ cls: 'lt-quick-add-footer' })
        const captureBtn = footer.createEl('button', { text: 'Open full capture' })
        captureBtn.addEventListener('click', () => this.openFullCapture(file, null))
    }

    private debouncedSave(file: TFile, definition: PropertyDefinition): void {
        const key = valueKey(file, definition)
        this.cancelPendingSave(key)
        const timerId = window.setTimeout(() => {
            this.pendingSaves.delete(key)
            this.saveImmediate(file, definition)
        }, AUTO_SAVE_DEBOUNCE_MS)
        this.pendingSaves.set(key, { timerId, file, definition })
    }

    private cancelPendingSave(key: string): void {
        const pending = this.pendingSaves.get(key)
        if (pending) {
            window.clearTimeout(pending.timerId)
            this.pendingSaves.delete(key)
        }
    }

    /** Save edits still waiting on the debounce: typed values are never dropped */
    private flushPendingSaves(): void {
        for (const { timerId, file, definition } of this.pendingSaves.values()) {
            window.clearTimeout(timerId)
            this.saveImmediate(file, definition)
        }
        this.pendingSaves.clear()
    }

    /** Write the latest value of one property, skipping invalid values */
    private saveImmediate(file: TFile, definition: PropertyDefinition): void {
        const value = this.currentValues[valueKey(file, definition)]
        const validation = this.frontmatterService.validate(value, definition)
        if (!validation.valid) {
            log(`Skipping quick-add save for ${definition.name}: ${validation.error}`, 'debug')
            return
        }

        void this.frontmatterService
            .write(file, { [definition.name]: value })
            .catch((error: unknown) => {
                log('Failed to save frontmatter', 'error', error)
                new Notice(
                    `Failed to save "${definition.displayName || definition.name}" for ${file.basename} — your value was not persisted`
                )
            })
    }
}

/** Key of a destination's note for a day in the panel's memory */
function knownFileKey(target: CaptureTarget | null, date: Date): string {
    return `${target?.id ?? 'daily'}|${formatDateISO(date)}`
}

/** Key of one property's value in one note: two destinations never share it */
function valueKey(file: TFile, definition: PropertyDefinition): string {
    return `${file.path}::${definition.name}`
}
