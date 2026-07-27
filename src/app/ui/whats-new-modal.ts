import { App, Component, MarkdownRenderer, Modal, Setting } from 'obsidian'
import type { PluginManifest } from 'obsidian'

const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dsebastien'
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/dsebastien'
const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@dsebastien'

/**
 * Dialog shown once after a plugin update: renders the release notes of the
 * version(s) the user just received, plus ways to support development.
 */
export class WhatsNewModal extends Modal {
    /** Owns the lifecycle of components created by the Markdown renderer. */
    private readonly renderLifecycle = new Component()

    constructor(
        app: App,
        private readonly manifest: PluginManifest,
        private readonly notesMarkdown: string
    ) {
        super(app)
    }

    override onOpen(): void {
        const { contentEl } = this
        this.titleEl.setText(`What's new in ${this.manifest.name} ${this.manifest.version}`)
        this.renderLifecycle.load()

        const notesEl = contentEl.createDiv({ cls: 'markdown-rendered' })
        const markdown =
            '' !== this.notesMarkdown
                ? this.notesMarkdown
                : `Updated to version ${this.manifest.version}.`
        void MarkdownRenderer.render(this.app, markdown, notesEl, '', this.renderLifecycle)

        new Setting(contentEl)
            .setName('Enjoying this plugin?')
            .setDesc('Your support keeps development and maintenance going ❤️')
            .addButton((button) => {
                button
                    .setCta()
                    .setButtonText('Buy me a coffee')
                    .onClick(() => {
                        window.open(BUY_ME_A_COFFEE_URL)
                    })
            })
            .addButton((button) => {
                button.setButtonText('GitHub Sponsors').onClick(() => {
                    window.open(GITHUB_SPONSORS_URL)
                })
            })
            .addButton((button) => {
                button.setButtonText('YouTube channel').onClick(() => {
                    window.open(YOUTUBE_CHANNEL_URL)
                })
            })
    }

    override onClose(): void {
        this.renderLifecycle.unload()
        this.contentEl.empty()
    }
}
