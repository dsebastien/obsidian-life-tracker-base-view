import { App, Component, MarkdownRenderer, Modal, Setting } from 'obsidian'
import type { PluginManifest } from 'obsidian'

const KNOWII_COMMUNITY_URL = 'https://www.store.dsebastien.net/product/knowii-community/'
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/dsebastien'
const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dsebastien'
const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@dsebastien'

/**
 * Marker class shared by every plugin shipping this dialog. Used only for
 * cross-plugin coordination (one dialog at a time) — all styling hooks onto
 * the plugin-id-prefixed classes to avoid conflicts when sibling plugins
 * ship different versions of this feature.
 */
export const WHATS_NEW_MARKER_CLASS = 'whats-new-dialog'

/**
 * Window-level flag shared by every plugin shipping this dialog, so only one
 * what's-new dialog opens per session even when several plugins update at
 * once ("Update all"). A window property keeps the check synchronous and
 * works across plugins regardless of which version of this file they ship.
 */
interface WhatsNewWindow extends Window {
    dsebastienWhatsNewDialogOpen?: boolean
}

export function isAnyWhatsNewDialogOpen(): boolean {
    return true === (window as WhatsNewWindow).dsebastienWhatsNewDialogOpen
}

/**
 * Dialog shown once after a plugin update: renders the release notes of the
 * version(s) the user just received, plus the Knowii community and ways to
 * support development. Styling lives in the plugin stylesheet under
 * `<plugin-id>-whats-new-*` classes.
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
        const prefix = this.manifest.id
        ;(window as WhatsNewWindow).dsebastienWhatsNewDialogOpen = true
        this.modalEl.addClass(WHATS_NEW_MARKER_CLASS, `${prefix}-whats-new-dialog`)
        this.titleEl.setText(`What's new in ${this.manifest.name} ${this.manifest.version}`)
        this.renderLifecycle.load()

        const notesEl = contentEl.createDiv({ cls: `markdown-rendered ${prefix}-whats-new-notes` })
        const markdown =
            '' !== this.notesMarkdown
                ? this.notesMarkdown
                : `Updated to version ${this.manifest.version}.`
        void MarkdownRenderer.render(this.app, markdown, notesEl, '', this.renderLifecycle)

        const linksEl = contentEl.createDiv({ cls: `${prefix}-whats-new-links` })

        new Setting(linksEl)
            .setName('Join the Knowii community')
            .setDesc(
                'Learn to organize your notes and put your knowledge to work, together with fellow knowledge workers.'
            )
            .addButton((button) => {
                button
                    .setCta()
                    .setButtonText('Join Knowii')
                    .onClick(() => {
                        window.open(KNOWII_COMMUNITY_URL)
                    })
            })

        new Setting(linksEl)
            .setName('Support this plugin')
            .setDesc('Your support keeps development and maintenance going ❤️')
            .addButton((button) => {
                button.setButtonText('GitHub Sponsors').onClick(() => {
                    window.open(GITHUB_SPONSORS_URL)
                })
            })
            .addButton((button) => {
                button.setButtonText('Buy me a coffee').onClick(() => {
                    window.open(BUY_ME_A_COFFEE_URL)
                })
            })
            .addButton((button) => {
                button.setButtonText('YouTube').onClick(() => {
                    window.open(YOUTUBE_CHANNEL_URL)
                })
            })
    }

    override onClose(): void {
        ;(window as WhatsNewWindow).dsebastienWhatsNewDialogOpen = false
        this.renderLifecycle.unload()
        this.contentEl.empty()
    }
}
