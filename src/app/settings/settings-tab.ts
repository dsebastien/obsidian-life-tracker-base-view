import { App, Notice, PluginSettingTab, type Setting } from 'obsidian'
import type { SettingDefinitionItem } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { PluginSettings, SettingsChangeInfo } from '../types'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { renderSupportSection } from '../ui/support-links'
import { PropertyDefinitionSection } from './property-definition-section'
import { VisualizationPresetSection } from './visualization-preset-section'
import { DateSettingsSection } from './date-settings-section'
import { StarterKitSection } from './starter-kit-section'
import { SectionPage } from './section-page'
import { log } from '../../utils'

/** The sub-pages drawn imperatively by a section editor */
type SectionPageKey = 'properties' | 'presets' | 'starter-kit'

/** Animation duration bounds, in seconds (stored in milliseconds) */
const ANIMATION_SECONDS = { min: 1, max: 10, step: 0.5 } as const

const WEEK_START_OPTIONS: Record<string, string> = { '1': 'Monday', '0': 'Sunday' }

/** Dropdown entry that leaves note creation to the Periodic Notes plugin */
const PERIODIC_NOTES_OPTION = ''

/**
 * Settings tab, declared rather than rendered (Obsidian 1.13+).
 *
 * `getSettingDefinitions()` REPLACES `display()`: the whole tab is declared.
 * Scalar settings are declared controls, so Obsidian's settings search indexes
 * them. The three dynamic editors (property definitions, visualization presets,
 * the Starter Kit import) are sub-pages drawn by their section editors, and the
 * filename date patterns are a declared list (see the section classes). The
 * contents of those pages are not indexed by the search.
 *
 * Obsidian computes the definitions only in `update()` and reuses them every
 * time the tab opens, so nothing in them may capture state from outside the
 * settings (which Starter Kit note types exist): such rows read it at render
 * time, which every opening re-runs.
 *
 * Writes go through `plugin.updateSettings`, which commits to memory first and
 * coalesces the save (keystroke-level editors depend on both, see
 * `createCoalescingWriter`). Obsidian awaits `setControlValue` but catches
 * nothing and never rolls a control back, so a failed write is reported with a
 * Notice. The control, the running plugin and memory then agree on the new
 * value, and the next successful save persists it.
 *
 * Rules that each cost a shipped bug the first time they were broken (see
 * AGENTS.md "Declarative settings"): a `render:` hook writes into its own row
 * only; a control-less row needs a `render:` hook or it is skipped; lists live
 * at the top level of a page, never inside a group.
 */
export class LifeTrackerPluginSettingTab extends PluginSettingTab {
    plugin: LifeTrackerPlugin
    // Track which property definitions are expanded (by id). Owned by the tab
    // so expansion survives re-renders and navigating between pages.
    private expandedDefinitions: Set<string> = new Set()

    private readonly propertySection: PropertyDefinitionSection
    private readonly presetSection: VisualizationPresetSection
    private readonly dateSection: DateSettingsSection
    private readonly starterKitSection: StarterKitSection

    /** The section pages currently open, so a section redraws only its own */
    private readonly openPages = new Map<SectionPageKey, SectionPage>()

    constructor(app: App, plugin: LifeTrackerPlugin) {
        super(app, plugin)
        this.plugin = plugin
        this.propertySection = new PropertyDefinitionSection(
            plugin,
            app,
            () => this.redrawPage('properties'),
            this.expandedDefinitions
        )
        this.presetSection = new VisualizationPresetSection(plugin, () =>
            this.redrawPage('presets')
        )
        this.dateSection = new DateSettingsSection(plugin, () => this.update(), reportSaveFailure)
        this.starterKitSection = new StarterKitSection(plugin, () => this.redrawPage('starter-kit'))
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                type: 'page',
                name: 'Property definitions',
                desc: 'Define properties to track. These determine what appears in the capture dialog and editing views.',
                page: () =>
                    this.openSectionPage('properties', 'Property definitions', (containerEl) => {
                        this.propertySection.render(containerEl)
                    })
            },
            {
                type: 'group',
                heading: 'Capture',
                items: [
                    {
                        name: 'Confetti celebration',
                        desc: 'Show confetti animation when completing property capture',
                        control: { type: 'toggle', key: 'showConfettiOnCapture' }
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Visualizations',
                items: [
                    {
                        name: 'High contrast',
                        desc: 'Maximum contrast rendering: thick borders, strong colors, no dimmed elements. Overrides the chosen color schemes.',
                        aliases: ['accessibility'],
                        control: { type: 'toggle', key: 'highContrast' }
                    },
                    {
                        name: 'Animation duration',
                        desc: 'Duration of visualization animations in seconds',
                        control: {
                            type: 'slider',
                            key: 'animationDuration',
                            ...ANIMATION_SECONDS,
                            displayFormat: (value: number): string => `${value} s`
                        }
                    },
                    {
                        type: 'page',
                        name: 'Visualization presets',
                        desc: 'Default visualizations for property names, applied automatically when a property matches.',
                        page: () =>
                            this.openSectionPage(
                                'presets',
                                'Visualization presets',
                                (containerEl) => {
                                    this.presetSection.render(containerEl)
                                }
                            )
                    }
                ]
            },
            {
                type: 'group',
                heading: 'Dates',
                items: [
                    {
                        name: 'First day of the week',
                        desc: 'Starting day for week grouping and heatmap columns. ISO week labels stay Monday-based.',
                        control: {
                            type: 'dropdown',
                            key: 'weekStartsOn',
                            options: WEEK_START_OPTIONS
                        }
                    },
                    this.dateSection.patternsPage()
                ]
            },
            this.noteCreationGroup(),
            {
                type: 'page',
                name: 'Obsidian Starter Kit',
                desc: 'Import note types and properties from the Obsidian Starter Kit plugin.',
                // Nothing on the page is actionable without Starter Kit
                visible: () => this.plugin.starterKit.isAvailable(),
                page: () =>
                    this.openSectionPage('starter-kit', 'Obsidian Starter Kit', (containerEl) => {
                        this.starterKitSection.render(containerEl)
                    })
            },
            {
                type: 'group',
                heading: 'About',
                items: [
                    {
                        name: 'Follow me on X',
                        desc: 'Sébastien Dubois (@dSebastien)',
                        searchable: false,
                        // A CTA button, not a row `action:`, which would make the
                        // whole row clickable and draw no button
                        render: (setting): void => {
                            setting.addButton((button) => {
                                button
                                    .setCta()
                                    .setButtonText('Follow me on X')
                                    .onClick(() => {
                                        window.open('https://x.com/dSebastien')
                                    })
                            })
                        }
                    },
                    {
                        name: 'Support',
                        searchable: false,
                        render: (setting): (() => void) => {
                            // The section draws its own headings; `.setting-item`
                            // is a flex row, and the block is a stack of rows
                            setting.infoEl.remove()
                            setting.settingEl.addClass('lt-settings-stack')
                            const blockEl = setting.settingEl.createDiv()
                            renderSupportSection(blockEl, (el) => {
                                this.renderBuyMeACoffeeBadge(el)
                            })
                            // update() re-runs this hook on the SAME row: only the
                            // control area is reset, so remove what was added
                            return () => blockEl.remove()
                        }
                    }
                ]
            }
        ]
    }

    /**
     * Creating a note for a date that has none (issue #160).
     *
     * Off by default, and the location always comes from a plugin the user has
     * already configured — the Starter Kit note type chosen here, or failing
     * that the Periodic Notes plugin. Life Tracker never invents a folder.
     */
    private noteCreationGroup(): SettingDefinitionItem {
        const enabled = (): boolean => this.plugin.settings.createMissingNotes
        const hasNoteTypes = (): boolean => this.dailyNoteTypeOptions() !== null

        return {
            type: 'group',
            heading: 'Creating missing notes',
            items: [
                {
                    name: 'Create missing notes when capturing',
                    desc: 'When capturing for a date with no note, offer to create it. The folder and template come from the Starter Kit note type below, or from the periodic notes plugin.',
                    control: { type: 'toggle', key: 'createMissingNotes' }
                },
                // Both rows below read Starter Kit at each render, never when
                // the definitions are built: Obsidian builds those once and
                // reuses them, while Starter Kit can be enabled, or its note
                // types edited, with the settings open. A declared dropdown
                // would freeze its options at build time, so the dropdown is
                // drawn by a render hook, which every opening re-runs.
                {
                    name: 'Starter Kit note type for daily notes',
                    desc: 'Which note type describes a daily note. Its folder, template, name affixes and tags are used when creating one.',
                    visible: () => enabled() && hasNoteTypes(),
                    render: (setting): void => {
                        this.renderDailyNoteTypeDropdown(setting)
                    }
                },
                {
                    name: 'Where new notes go',
                    searchable: false,
                    visible: () => enabled() && !hasNoteTypes(),
                    render: (setting): void => {
                        setting.setDesc(
                            this.plugin.starterKit.isAvailable()
                                ? 'No Starter Kit note type has a folder configured, so new notes follow the periodic notes plugin.'
                                : 'The Obsidian Starter Kit is not available, so new notes follow the periodic notes plugin.'
                        )
                    }
                }
            ]
        }
    }

    /**
     * The daily note type dropdown, listing the note types that exist now.
     * A stored note type that no longer exists must not look selected.
     */
    private renderDailyNoteTypeDropdown(setting: Setting): void {
        const options = this.dailyNoteTypeOptions() ?? {
            [PERIODIC_NOTES_OPTION]: 'Use the periodic notes plugin'
        }
        const stored = this.plugin.settings.dailyNoteTypeId
        setting.addDropdown((dropdown) => {
            dropdown
                .addOptions(options)
                .setValue(Object.hasOwn(options, stored) ? stored : PERIODIC_NOTES_OPTION)
                .onChange(async (value) => {
                    // Only a value this dropdown offered can be stored
                    if (!Object.hasOwn(options, value)) return
                    try {
                        await this.plugin.updateSettings((draft) => {
                            draft.dailyNoteTypeId = value
                        })
                    } catch (error) {
                        reportSaveFailure(error)
                    }
                })
        })
    }

    /**
     * The note types a daily note can be created from, or null when Starter
     * Kit is unavailable or none of its note types has a folder.
     */
    private dailyNoteTypeOptions(): Record<string, string> | null {
        if (!this.plugin.starterKit.isAvailable()) return null

        const noteTypes = this.plugin.starterKit
            .listNoteTypes()
            .filter((noteType) => noteType.associatedFolder)
        if (noteTypes.length === 0) return null

        const options: Record<string, string> = {
            [PERIODIC_NOTES_OPTION]: 'Use the periodic notes plugin'
        }
        for (const noteType of noteTypes) {
            options[noteType.id] = noteType.name
        }
        return options
    }

    override getControlValue(key: string): unknown {
        const settings = this.plugin.settings
        switch (key) {
            case 'showConfettiOnCapture':
                return settings.showConfettiOnCapture
            case 'highContrast':
                return settings.highContrast
            case 'animationDuration':
                return settings.animationDuration / 1000
            case 'weekStartsOn':
                return String(settings.weekStartsOn)
            case 'createMissingNotes':
                return settings.createMissingNotes
            default:
                return undefined
        }
    }

    /**
     * Persists a control edit.
     *
     * Obsidian awaits this and then re-evaluates visibility (the note type
     * rows follow the toggle), but nothing catches a rejection: it would only
     * surface as an uncaught error and skip that refresh. So failures are
     * reported here and the promise resolves:
     *
     * - a value that does not fit the key is refused before anything is
     *   written
     * - a failed save is reported; memory, the control and the running plugin
     *   keep the new value, and the next successful save persists it
     */
    override async setControlValue(key: string, value: unknown): Promise<void> {
        let change: ReturnType<LifeTrackerPluginSettingTab['controlChange']>
        try {
            change = this.controlChange(key, value)
        } catch (error) {
            log('Refused a settings value', 'warn', error)
            new Notice('That value could not be applied.')
            return
        }
        try {
            await this.plugin.updateSettings(change.apply, change.changeInfo)
        } catch (error) {
            reportSaveFailure(error)
        }
    }

    /**
     * The settings change a control edit stands for, validated up front so a
     * refused value never reaches the write path. Throws when `value` does
     * not fit `key`.
     */
    private controlChange(
        key: string,
        value: unknown
    ): { apply: (draft: PluginSettings) => void; changeInfo?: SettingsChangeInfo } {
        switch (key) {
            case 'showConfettiOnCapture': {
                const enabled = expectBoolean(key, value)
                return {
                    apply: (draft) => {
                        draft.showConfettiOnCapture = enabled
                    }
                }
            }
            case 'highContrast': {
                const enabled = expectBoolean(key, value)
                return {
                    apply: (draft) => {
                        draft.highContrast = enabled
                    },
                    changeInfo: { type: 'high-contrast-changed' }
                }
            }
            case 'animationDuration': {
                if (
                    typeof value !== 'number' ||
                    !Number.isFinite(value) ||
                    value < ANIMATION_SECONDS.min ||
                    value > ANIMATION_SECONDS.max
                ) {
                    throw new Error(`Setting "${key}" expects a number of seconds in range.`)
                }
                const milliseconds = value * 1000
                return {
                    apply: (draft) => {
                        draft.animationDuration = milliseconds
                    }
                }
            }
            case 'weekStartsOn': {
                if (value !== '0' && value !== '1') {
                    throw new Error(`Setting "${key}" expects "0" or "1".`)
                }
                const weekStartsOn = value === '0' ? 0 : 1
                return {
                    apply: (draft) => {
                        draft.weekStartsOn = weekStartsOn
                    }
                }
            }
            case 'createMissingNotes': {
                const enabled = expectBoolean(key, value)
                return {
                    apply: (draft) => {
                        draft.createMissingNotes = enabled
                    }
                }
            }
            default:
                throw new Error(`Setting "${key}" does not address a known field.`)
        }
    }

    /**
     * Build a section page, remembered while open so its section can redraw it
     */
    private openSectionPage(
        key: SectionPageKey,
        title: string,
        draw: (containerEl: HTMLElement) => void
    ): SectionPage {
        const page: SectionPage = new SectionPage(title, draw, () => {
            if (this.openPages.get(key) === page) {
                this.openPages.delete(key)
            }
        })
        this.openPages.set(key, page)
        return page
    }

    /** Redraw a section's page if it is open; nothing to do otherwise */
    private redrawPage(key: SectionPageKey): void {
        this.openPages.get(key)?.display()
    }

    private renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175): void {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src = BUY_ME_A_COFFEE_BADGE_DATA_URL
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}

/** When a save failure was last shown, to show one per burst of failures */
let lastFailureNoticeAt = 0
const FAILURE_NOTICE_INTERVAL_MS = 5000

/**
 * Tell the user a change is live but was not saved. Every edit waiting on the
 * same coalesced write fails with it (one per keystroke while typing), so the
 * Notice is shown once per burst; each failure is still logged.
 */
function reportSaveFailure(error: unknown): void {
    log('Failed to save settings', 'error', error)
    const now = Date.now()
    if (now - lastFailureNoticeAt < FAILURE_NOTICE_INTERVAL_MS) return
    lastFailureNoticeAt = now
    new Notice('Failed to save settings. Your changes apply until Obsidian restarts.')
}

function expectBoolean(key: string, value: unknown): boolean {
    if (typeof value !== 'boolean') {
        throw new Error(`Setting "${key}" expects a boolean.`)
    }
    return value
}
