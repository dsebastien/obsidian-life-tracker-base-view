import { Notice, Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { getPropertyDisplayLabel, type PropertyDefinition } from '../types'
import {
    applyImportPlan,
    findOrphanedLinks,
    planImport,
    type ImportAction,
    type ImportPlanEntry,
    type StarterKitSource
} from '../services/starter-kit.utils'

/** How each planned action is described in the import list */
const ACTION_LABELS: Record<ImportAction, string> = {
    create: 'New',
    relink: 'Already linked — will refresh',
    adopt: 'Links an existing property',
    conflict: 'Name already used by another property',
    unmatched: 'Cannot be imported — its note type matches no notes'
}

/**
 * Renders the "Starter Kit" settings tab: detection status, the import list, and
 * the state of existing links.
 *
 * See `documentation/plans/starter-kit-integration.md`. Starter Kit owns the
 * *structure* of a linked property; Life Tracker keeps value direction, emojis,
 * value mapping and ordering.
 */
export class StarterKitSection {
    /** Sources the user ticked, keyed as `noteTypeId::propertyName` */
    private selected: Set<string> = new Set()
    /**
     * The Import button, kept so a toggle can refresh its label and enabled
     * state without re-rendering (a re-render would collapse the list).
     */
    private importButtonEl: HTMLButtonElement | null = null
    /**
     * Note type groups the user opened. Collapsed by default: a real vault had
     * 49 note types and 524 properties, which is unusable expanded.
     */
    private expandedGroups: Set<string> = new Set()

    constructor(
        private readonly plugin: LifeTrackerPlugin,
        private readonly requestRerender: () => void
    ) {}

    private static keyOf(source: StarterKitSource): string {
        return `${source.noteType?.id ?? ''}::${source.property.name}`
    }

    render(containerEl: HTMLElement): void {
        // A fresh render rebuilds every row, so the old button is gone
        this.importButtonEl = null

        containerEl.createEl('h3', { text: 'Obsidian Starter Kit' })

        if (!this.plugin.starterKit.isAvailable()) {
            this.renderUnavailable(containerEl)
            this.renderExistingLinks(containerEl, [])
            return
        }

        const version = this.plugin.starterKit.getVersion()
        const sources = this.plugin.starterKit.collectSources()
        const noteTypeCount = this.plugin.starterKit.listNoteTypes().length

        containerEl.createEl('p', {
            cls: 'lt-settings-description',
            text: `Detected${version ? ` (v${version})` : ''} — ${noteTypeCount} note ${
                noteTypeCount === 1 ? 'type' : 'types'
            }, ${sources.length} ${sources.length === 1 ? 'property' : 'properties'}.`
        })

        containerEl.createEl('p', {
            cls: 'lt-settings-description',
            text: 'Import properties to track them here without redefining them. Starter Kit keeps ownership of their structure — name, type, constraints and which notes they apply to — refreshed when Obsidian starts, or with Refresh below. Value direction, emojis and value mappings stay with Life Tracker and are never overwritten.'
        })

        new Setting(containerEl)
            .setName('Refresh linked properties')
            .setDesc('Re-read the structure of every linked property from Starter Kit now.')
            .addButton((button) => {
                button.setButtonText('Refresh').onClick(() => {
                    void this.refreshLinks()
                })
            })

        if (sources.length === 0) {
            containerEl.createDiv({
                cls: 'lt-value-mapping-empty',
                text: 'Starter Kit has no properties defined yet.'
            })
            this.renderExistingLinks(containerEl, sources)
            return
        }

        // Drop selections whose source vanished since the last render
        const liveKeys = new Set(sources.map((source) => StarterKitSection.keyOf(source)))
        for (const key of this.selected) {
            if (!liveKeys.has(key)) this.selected.delete(key)
        }

        this.renderImportList(containerEl, sources)
        this.renderExistingLinks(containerEl, sources)
    }

    private renderUnavailable(containerEl: HTMLElement): void {
        containerEl.createEl('p', {
            cls: 'lt-settings-description',
            text: 'Not detected. Install and enable the Obsidian Starter Kit plugin to import its note types and properties instead of defining them again here. Life Tracker works fine without it.'
        })
    }

    /**
     * Properties that already exist here and would simply gain a link.
     *
     * The seamless path for a vault configured before this integration existed:
     * the definitions are already correct, they just do not know where they came
     * from yet. Offered as one action rather than making the user hunt for them
     * among hundreds of rows.
     */
    private renderAdoptBanner(containerEl: HTMLElement, plan: ImportPlanEntry[]): void {
        const adoptable = plan.filter((entry) => entry.action === 'adopt')
        if (adoptable.length === 0) return

        const banner = containerEl.createDiv({ cls: 'lt-starter-kit-banner' })
        banner.createEl('strong', {
            text: `${adoptable.length} of your properties match Starter Kit`
        })
        banner.createEl('p', {
            cls: 'lt-settings-description',
            text: 'They keep their labels, value direction, emojis, value mappings and chart settings. Linking lets Starter Kit keep their type, constraints and note scope up to date — which may adjust ranges or required flags to match what is defined there.'
        })

        const button = banner.createEl('button', {
            cls: 'mod-cta',
            text: `Link ${adoptable.length} existing propert${adoptable.length === 1 ? 'y' : 'ies'}`
        })
        button.addEventListener('click', () => {
            void this.applyEntries(adoptable)
        })
    }

    /**
     * The import list, grouped by note type and **collapsed by default**.
     *
     * A real vault reached 524 properties across 49 note types; rendering every
     * row up front was both slow and unreadable. Only an expanded group builds
     * its rows.
     */
    private renderImportList(containerEl: HTMLElement, sources: StarterKitSource[]): void {
        const plan = planImport(sources, this.plugin.settings.propertyDefinitions)
        const planBySource = new Map(
            plan.map((entry) => [StarterKitSection.keyOf(entry.source), entry])
        )

        this.renderAdoptBanner(containerEl, plan)

        // Preserve Starter Kit's own property order within each note type
        const groups = new Map<string, StarterKitSource[]>()
        for (const source of sources) {
            const name = source.noteType?.name ?? 'Global properties'
            const bucket = groups.get(name)
            if (bucket) {
                bucket.push(source)
            } else {
                groups.set(name, [source])
            }
        }

        containerEl.createEl('h4', { text: 'Browse by note type' })

        // Note types are listed alphabetically: with dozens of them, Starter
        // Kit's own order makes a given one impossible to find
        const groupNames = [...groups.keys()].sort((a, b) => a.localeCompare(b))

        for (const groupName of groupNames) {
            const groupSources = groups.get(groupName)
            if (!groupSources) continue
            this.renderGroup(containerEl, groupName, groupSources, planBySource)
        }

        new Setting(containerEl).addButton((button) => {
            this.importButtonEl = button.buttonEl
            button.setCta().onClick(() => {
                void this.applyEntries(
                    plan.filter((entry) => this.selected.has(StarterKitSection.keyOf(entry.source)))
                )
            })
            this.refreshImportButton()
        })
    }

    private renderGroup(
        containerEl: HTMLElement,
        groupName: string,
        groupSources: StarterKitSource[],
        planBySource: Map<string, ImportPlanEntry>
    ): void {
        const entries = groupSources
            .map((source) => planBySource.get(StarterKitSection.keyOf(source)))
            .filter((entry): entry is ImportPlanEntry => entry !== undefined)

        const importable = entries.filter(
            (entry) => entry.action === 'create' || entry.action === 'adopt'
        )
        const linked = entries.filter((entry) => entry.action === 'relink').length
        const blocked = entries.length - importable.length - linked

        const summary: string[] = [`${entries.length} propert${entries.length === 1 ? 'y' : 'ies'}`]
        if (linked > 0) summary.push(`${linked} linked`)
        if (blocked > 0) summary.push(`${blocked} unavailable`)

        const expanded = this.expandedGroups.has(groupName)

        const header = new Setting(containerEl)
            .setName(groupName)
            .setDesc(summary.join(' · '))
            .addExtraButton((button) => {
                button
                    .setIcon(expanded ? 'chevron-down' : 'chevron-right')
                    .setTooltip(expanded ? 'Collapse' : 'Expand')
                    .onClick(() => {
                        if (expanded) {
                            this.expandedGroups.delete(groupName)
                        } else {
                            this.expandedGroups.add(groupName)
                        }
                        this.requestRerender()
                    })
            })
        header.settingEl.addClass('lt-starter-kit-group-header')

        if (importable.length > 0) {
            header.addExtraButton((button) => {
                button
                    .setIcon('check-check')
                    .setTooltip(`Select all ${importable.length} importable`)
                    .onClick(() => {
                        for (const entry of importable) {
                            this.selected.add(StarterKitSection.keyOf(entry.source))
                        }
                        this.refreshImportButton()
                    })
            })
        }

        if (!expanded) return

        for (const entry of entries) {
            this.renderSourceRow(
                containerEl,
                entry.source,
                entry,
                StarterKitSection.keyOf(entry.source)
            )
        }
    }

    private renderSourceRow(
        containerEl: HTMLElement,
        source: StarterKitSource,
        entry: ImportPlanEntry,
        key: string
    ): void {
        const setting = new Setting(containerEl)
            .setName(source.property.displayName || source.property.name)
            .setDesc(`${source.property.type} · ${this.describeAction(entry)}`)
        setting.settingEl.addClass('lt-starter-kit-row')

        if (entry.action === 'conflict' || entry.action === 'unmatched') {
            // Conflicts need a human decision (silently rebinding a definition
            // to another note type's property is the most destructive thing we
            // could do); unmatched sources cannot be represented at all
            setting.settingEl.addClass('lt-starter-kit-conflict')
            return
        }

        if (entry.action === 'relink') {
            setting.settingEl.addClass('lt-starter-kit-linked')
            return
        }

        setting.addToggle((toggle) => {
            toggle.setValue(this.selected.has(key)).onChange((value) => {
                if (value) {
                    this.selected.add(key)
                } else {
                    this.selected.delete(key)
                }
                // Update the button in place rather than re-rendering, which
                // would collapse the list mid-selection
                this.refreshImportButton()
            })
        })
    }

    /**
     * Explain an entry, naming the note type that already holds a contested
     * name — the same property name can legitimately exist in many note types,
     * while Life Tracker has one definition per frontmatter key.
     */
    private describeAction(entry: ImportPlanEntry): string {
        if (entry.action !== 'conflict') return ACTION_LABELS[entry.action]

        const holder = this.plugin.settings.propertyDefinitions.find(
            (definition) => definition.id === entry.existingId
        )
        const origin = holder?.starterKitLink?.noteTypeName
        return origin ? `Name already tracked, from ${origin}` : ACTION_LABELS[entry.action]
    }

    /**
     * Sync the Import button with the current selection.
     *
     * Selecting a row deliberately does not re-render (that would collapse the
     * list mid-selection), so the button has to be updated directly — otherwise
     * it stays disabled and the whole tab is unusable.
     */
    private refreshImportButton(): void {
        const button = this.importButtonEl
        if (!button) return

        const count = this.selected.size
        button.textContent = count === 0 ? 'Import' : `Import ${count}`
        button.disabled = count === 0
    }

    /**
     * Re-read every linked definition's structure on demand. The startup sync
     * only runs once, so this is how a Starter Kit edit made while Obsidian is
     * open reaches Life Tracker without a restart.
     */
    private async refreshLinks(): Promise<void> {
        const changed = await this.plugin.syncStarterKitDefinitions()
        new Notice(changed ? 'Linked properties refreshed' : 'Already up to date')
        if (changed) this.requestRerender()
    }

    /**
     * Apply a set of plan entries. Shared by the selection-based import and the
     * one-click "link existing properties" action.
     */
    private async applyEntries(entries: ImportPlanEntry[]): Promise<void> {
        if (entries.length === 0) return

        const next = applyImportPlan(this.plugin.settings.propertyDefinitions, entries, () =>
            crypto.randomUUID()
        )

        await this.plugin.updateSettings(
            (draft) => {
                draft.propertyDefinitions = next
            },
            { type: 'property-definitions-changed' }
        )

        const created = entries.filter((entry) => entry.action === 'create').length
        const linked = entries.length - created
        const parts: string[] = []
        if (created > 0) parts.push(`imported ${created} new`)
        if (linked > 0) parts.push(`linked ${linked} existing`)
        new Notice(parts.length > 0 ? `Starter Kit: ${parts.join(', ')}` : 'Nothing to do')

        this.selected.clear()
        this.requestRerender()
    }

    /**
     * Existing links, so it is always visible where a definition's structure
     * comes from — including when its source has gone missing.
     */
    private renderExistingLinks(containerEl: HTMLElement, sources: StarterKitSource[]): void {
        const linked = this.plugin.settings.propertyDefinitions.filter(
            (definition) => definition.starterKitLink
        )
        if (linked.length === 0) return

        containerEl.createEl('h4', { text: 'Linked properties' })

        const orphanIds = new Set(
            findOrphanedLinks(linked, sources).map((definition) => definition.id)
        )

        for (const definition of linked) {
            this.renderLinkRow(containerEl, definition, orphanIds.has(definition.id))
        }
    }

    private renderLinkRow(
        containerEl: HTMLElement,
        definition: PropertyDefinition,
        orphaned: boolean
    ): void {
        const link = definition.starterKitLink
        if (!link) return

        const origin = link.noteTypeName || 'Global properties'
        const setting = new Setting(containerEl)
            .setName(getPropertyDisplayLabel(definition))
            .setDesc(
                orphaned
                    ? `${origin} → ${link.propertyName} · not found in Starter Kit right now; still working with its last known structure`
                    : `${origin} → ${link.propertyName}`
            )

        if (orphaned) {
            setting.settingEl.addClass('lt-starter-kit-orphaned')
        }

        setting.addExtraButton((button) => {
            button
                .setIcon('unlink')
                .setTooltip('Unlink (keeps the property and its current settings)')
                .onClick(() => {
                    void this.unlink(definition.id)
                })
        })
    }

    /**
     * Drop the link, keeping the definition exactly as it is. Unlinking must
     * never cost the user anything — it only stops future refreshes.
     */
    private async unlink(definitionId: string): Promise<void> {
        await this.plugin.updateSettings(
            (draft) => {
                const definition = draft.propertyDefinitions.find((d) => d.id === definitionId)
                if (definition) {
                    definition.starterKitLink = null
                }
            },
            { type: 'property-definitions-changed' }
        )
        this.requestRerender()
    }
}
