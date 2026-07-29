import { App, Component, MarkdownRenderer, Modal, Setting } from 'obsidian'

const KNOWII_COMMUNITY_URL = 'https://www.store.dsebastien.net/product/knowii-community/'
const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/dsebastien'
const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dsebastien'
const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@dsebastien'

/**
 * Marker class shared by every plugin shipping this dialog (useful for
 * end-to-end tests); styling hooks onto the owner-plugin-prefixed classes.
 */
export const WHATS_NEW_MARKER_CLASS = 'whats-new-dialog'

/** One updated plugin's contribution to the aggregated dialog. */
export interface WhatsNewEntry {
    pluginId: string
    pluginName: string
    version: string
    notesMarkdown: string
}

/**
 * Window-level registry shared by every plugin shipping this dialog. When
 * several plugins update in the same session (e.g. "Update all"), their
 * entries aggregate into a single dialog instead of stacking modals: entries
 * collect during a short window before the dialog opens, and late arrivals
 * append live into the open dialog.
 */
export interface WhatsNewRegistry {
    pending: WhatsNewEntry[]
    timer?: number
    open?: boolean
    ownerId?: string
    append?: (entry: WhatsNewEntry) => void
    close?: () => void
}

interface WhatsNewWindow extends Window {
    /** Legacy single-dialog flag (older versions of this feature set/read it). */
    dsebastienWhatsNewDialogOpen?: boolean
    dsebastienWhatsNewRegistry?: WhatsNewRegistry
}

export function getWhatsNewRegistry(): WhatsNewRegistry {
    const win = window as WhatsNewWindow
    win.dsebastienWhatsNewRegistry ??= { pending: [] }
    return win.dsebastienWhatsNewRegistry
}

/** True when any plugin's what's-new dialog (any version) is on screen. */
export function isAnyWhatsNewDialogOpen(): boolean {
    return true === (window as WhatsNewWindow).dsebastienWhatsNewDialogOpen
}

function setLegacyDialogFlag(open: boolean): void {
    ;(window as WhatsNewWindow).dsebastienWhatsNewDialogOpen = open
}

/**
 * Dialog shown once after plugin updates: renders the release notes of every
 * plugin updated in this session (one section each), plus the Knowii
 * community and ways to support development. Styling lives in the owning
 * plugin's stylesheet under `<plugin-id>-whats-new-*` classes.
 */
export class WhatsNewModal extends Modal {
    /** Owns the lifecycle of components created by the Markdown renderer. */
    private readonly renderLifecycle = new Component()
    private readonly entries: WhatsNewEntry[]
    private notesEl: HTMLElement | null = null

    constructor(
        app: App,
        private readonly ownerId: string,
        entries: WhatsNewEntry[]
    ) {
        super(app)
        this.entries = [...entries]
    }

    override onOpen(): void {
        const registry = getWhatsNewRegistry()
        registry.open = true
        registry.ownerId = this.ownerId
        registry.append = (entry): void => {
            this.entries.push(entry)
            this.renderEntry(entry)
            this.updateTitle()
        }
        registry.close = (): void => {
            this.close()
        }
        setLegacyDialogFlag(true)

        const prefix = this.ownerId
        this.modalEl.addClass(WHATS_NEW_MARKER_CLASS, `${prefix}-whats-new-dialog`)
        this.renderLifecycle.load()

        this.notesEl = this.contentEl.createDiv({
            cls: `markdown-rendered ${prefix}-whats-new-notes`
        })
        for (const entry of this.entries) {
            this.renderEntry(entry)
        }
        this.updateTitle()

        const linksEl = this.contentEl.createDiv({ cls: `${prefix}-whats-new-links` })

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

    /** Single update: plugin name in the title. Several: generic title. */
    private updateTitle(): void {
        const only = 1 === this.entries.length ? this.entries[0] : undefined
        this.titleEl.setText(
            only
                ? `What's new in ${only.pluginName} ${only.version}`
                : "What's new in dSebastien's plugins?"
        )
    }

    /**
     * Render one plugin's section. The per-section plugin title is hidden via
     * CSS (`:only-child`) while there is a single section, since the modal
     * title already names the plugin in that case.
     */
    private renderEntry(entry: WhatsNewEntry): void {
        if (!this.notesEl) {
            return
        }
        const section = this.notesEl.createDiv({ cls: `${this.ownerId}-whats-new-section` })
        section.createDiv({
            cls: `${this.ownerId}-whats-new-section-title`,
            text: `${entry.pluginName} ${entry.version}`
        })
        const body = section.createDiv()
        const markdown =
            '' !== entry.notesMarkdown
                ? entry.notesMarkdown
                : `Updated to version ${entry.version}.`
        void MarkdownRenderer.render(this.app, markdown, body, '', this.renderLifecycle)
    }

    override onClose(): void {
        const registry = getWhatsNewRegistry()
        registry.open = false
        registry.ownerId = undefined
        registry.append = undefined
        registry.close = undefined
        setLegacyDialogFlag(false)
        this.renderLifecycle.unload()
        this.contentEl.empty()
    }
}
