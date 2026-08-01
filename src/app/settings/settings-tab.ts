import { App, PluginSettingTab, Setting } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { BUY_ME_A_COFFEE_BADGE_DATA_URL } from '../assets/buy-me-a-coffee'
import { renderSupportSection } from '../ui/support-links'
import { PropertyDefinitionSection } from './property-definition-section'
import { VisualizationPresetSection } from './visualization-preset-section'
import { DateSettingsSection } from './date-settings-section'
import { StarterKitSection } from './starter-kit-section'

type SettingsTab = 'properties' | 'visualizations' | 'dates' | 'starter-kit' | 'about'

export class LifeTrackerPluginSettingTab extends PluginSettingTab {
    plugin: LifeTrackerPlugin
    private activeTab: SettingsTab = 'properties'
    // Track which property definitions are expanded (by id). Shared with the
    // property-definition section so expansion survives re-renders.
    private expandedDefinitions: Set<string> = new Set()

    private readonly propertySection: PropertyDefinitionSection
    private readonly presetSection: VisualizationPresetSection
    private readonly dateSection: DateSettingsSection
    private readonly starterKitSection: StarterKitSection

    constructor(app: App, plugin: LifeTrackerPlugin) {
        super(app, plugin)
        this.plugin = plugin
        this.propertySection = new PropertyDefinitionSection(
            plugin,
            app,
            () => this.display(),
            this.expandedDefinitions
        )
        this.presetSection = new VisualizationPresetSection(plugin, () => this.display())
        this.dateSection = new DateSettingsSection(plugin, () => this.display())
        this.starterKitSection = new StarterKitSection(plugin, () => this.display())
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()
        containerEl.addClass('lt-settings')

        // The Starter Kit tab only exists when Starter Kit does. Fall back when
        // it was the active tab and Starter Kit was disabled since.
        if (this.activeTab === 'starter-kit' && !this.plugin.starterKit.isAvailable()) {
            this.activeTab = 'properties'
        }

        // Render tab navigation
        this.renderTabNav(containerEl)

        // Render content container
        const contentEl = containerEl.createDiv({ cls: 'lt-settings-content' })

        // Render active tab content
        switch (this.activeTab) {
            case 'properties':
                this.renderPropertiesTab(contentEl)
                break
            case 'visualizations':
                this.presetSection.render(contentEl)
                break
            case 'dates':
                this.dateSection.render(contentEl)
                break
            case 'starter-kit':
                this.starterKitSection.render(contentEl)
                break
            case 'about':
                this.renderAboutTab(contentEl)
                break
        }
    }

    private renderTabNav(containerEl: HTMLElement): void {
        const navEl = containerEl.createDiv({ cls: 'lt-settings-nav' })

        const tabs: Array<{ id: SettingsTab; label: string }> = [
            { id: 'properties', label: 'Property definitions' },
            { id: 'visualizations', label: 'Visualizations' },
            { id: 'dates', label: 'Dates' }
        ]

        // Hidden entirely when Starter Kit is not installed/enabled: nothing in
        // that tab is actionable without it.
        if (this.plugin.starterKit.isAvailable()) {
            tabs.push({ id: 'starter-kit', label: 'Obsidian Starter Kit' })
        }

        tabs.push({ id: 'about', label: 'About' })

        for (const tab of tabs) {
            const tabEl = navEl.createDiv({
                cls: `lt-settings-nav-tab ${this.activeTab === tab.id ? 'lt-settings-nav-tab--active' : ''}`
            })
            tabEl.textContent = tab.label
            tabEl.addEventListener('click', () => {
                this.activeTab = tab.id
                this.display()
            })
        }
    }

    private renderPropertiesTab(containerEl: HTMLElement): void {
        const desc = new DocumentFragment()
        desc.createDiv({
            text: 'Define properties to track. These determine what appears in the capture dialog and editing views.'
        })
        new Setting(containerEl).setDesc(desc)

        // Capture settings
        new Setting(containerEl)
            .setName('Confetti celebration')
            .setDesc('Show confetti animation when completing property capture')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showConfettiOnCapture)
                    .onChange(async (value) => {
                        await this.plugin.updateSettings((draft) => {
                            draft.showConfettiOnCapture = value
                        })
                    })
            })

        // Separator
        containerEl.createEl('hr', { cls: 'lt-settings-separator' })

        // Property definitions list + management
        this.propertySection.render(containerEl)
    }

    private renderAboutTab(containerEl: HTMLElement): void {
        new Setting(containerEl)
            .setName('Follow me on X')
            .setDesc('Sébastien Dubois (@dSebastien)')
            .addButton((button) => {
                button.setCta()
                button.setButtonText('Follow me on X').onClick(() => {
                    window.open('https://x.com/dSebastien')
                })
            })

        renderSupportSection(containerEl, (el) => {
            this.renderBuyMeACoffeeBadge(el)
        })
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
