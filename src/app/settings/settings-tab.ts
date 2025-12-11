import { App, PluginSettingTab, Setting } from 'obsidian'
import type LifeTrackerBaseViewPlugin from '../../main'

export class LifeTrackerBaseViewPluginSettingTab extends PluginSettingTab {
    plugin: LifeTrackerBaseViewPlugin

    constructor(app: App, plugin: LifeTrackerBaseViewPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        const { containerEl } = this
        containerEl.empty()

        this.renderFollowButton(containerEl)
        this.renderSupportHeader(containerEl)
    }

    renderFollowButton(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Follow me on X')
            .setDesc('@dSebastien')
            .addButton((button) => {
                button.setCta()
                button.setButtonText('Follow me on X').onClick(() => {
                    window.open('https://x.com/dSebastien')
                })
            })
    }

    renderSupportHeader(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Support').setHeading()

        const supportDesc = new DocumentFragment()
        supportDesc.createDiv({
            text: 'Buy me a coffee to support the development of this plugin ❤️'
        })

        new Setting(containerEl).setDesc(supportDesc)

        this.renderBuyMeACoffeeBadge(containerEl)
        const spacing = containerEl.createDiv()
        spacing.classList.add('support-header-margin')
    }

    renderBuyMeACoffeeBadge(contentEl: HTMLElement | DocumentFragment, width = 175) {
        const linkEl = contentEl.createEl('a', {
            href: 'https://www.buymeacoffee.com/dsebastien'
        })
        const imgEl = linkEl.createEl('img')
        imgEl.src =
            'https://github.com/dsebastien/obsidian-plugin-template/raw/main/apps/plugin/src/assets/buy-me-a-coffee.png'
        imgEl.alt = 'Buy me a coffee'
        imgEl.width = width
    }
}
