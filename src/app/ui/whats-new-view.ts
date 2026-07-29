import { ItemView, MarkdownRenderer, Setting } from 'obsidian'
import type { ViewCreator, WorkspaceLeaf } from 'obsidian'

import {
    BUY_ME_A_COFFEE_URL,
    GITHUB_SPONSORS_URL,
    KNOWII_COMMUNITY_URL,
    YOUTUBE_CHANNEL_URL
} from './support-links'
import {
    WHATS_NEW_MARKER_CLASS,
    getWhatsNewTitle,
    getWhatsNewViewType
} from '../utils/whats-new-identity'

export { WHATS_NEW_MARKER_CLASS, getWhatsNewViewType }

/** What a plugin's "What's new" tab shows. */
export interface WhatsNewEntry {
    pluginId: string
    pluginName: string
    version: string
    notesMarkdown: string
}

/**
 * Build the view creator for a plugin's "What's new" tab: the tab shown once
 * after an update, with that plugin's release notes, the Knowii community, and
 * ways to support development.
 *
 * One tab per plugin: the view type is namespaced with the plugin id, so
 * plugins updated in the same session (e.g. "Update all") each open their own
 * tab. Content is resolved lazily through `getEntry`, so a tab restored with
 * the workspace layout still renders the plugin's current release notes.
 *
 * `viewType` and `getEntry` are captured in this closure rather than stored as
 * instance fields on purpose: Obsidian's `View` constructor calls
 * `getViewType()` from within `super(leaf)`, before any subclass field is
 * assigned, so an instance-field lookup there would throw.
 *
 * Styling lives in the owning plugin's stylesheet under
 * `<plugin-id>-whats-new-*` classes.
 */
export function createWhatsNewViewCreator(
    viewType: string,
    getEntry: () => WhatsNewEntry
): ViewCreator {
    class WhatsNewView extends ItemView {
        /** Static view: nothing here can be navigated to or away from. */
        override navigation = false

        constructor(leaf: WorkspaceLeaf) {
            super(leaf)
            this.icon = 'sparkles'
        }

        override getViewType(): string {
            return viewType
        }

        override getDisplayText(): string {
            const entry = getEntry()
            return getWhatsNewTitle(entry.pluginName, entry.version)
        }

        protected override async onOpen(): Promise<void> {
            const entry = getEntry()
            const prefix = entry.pluginId

            this.containerEl.addClass(WHATS_NEW_MARKER_CLASS, `${prefix}-whats-new-view`)
            // Styling hooks onto this class rather than Obsidian's own
            // `.view-content`, so the layout does not depend on internal DOM.
            this.contentEl.addClass(`${prefix}-whats-new-content`)
            this.contentEl.empty()

            // Single wrapper holds the readable measure. Centering each child
            // instead would break as soon as a child sets a margin shorthand.
            const bodyEl = this.contentEl.createDiv({ cls: `${prefix}-whats-new-body` })

            bodyEl.createEl('h2', {
                cls: `${prefix}-whats-new-title`,
                text: getWhatsNewTitle(entry.pluginName, entry.version)
            })

            const notesEl = bodyEl.createDiv({
                cls: `markdown-rendered ${prefix}-whats-new-notes`
            })
            const markdown =
                '' !== entry.notesMarkdown
                    ? entry.notesMarkdown
                    : `Updated to version ${entry.version}.`
            await MarkdownRenderer.render(this.app, markdown, notesEl, '', this)

            const linksEl = bodyEl.createDiv({ cls: `${prefix}-whats-new-links` })

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

        protected override async onClose(): Promise<void> {
            this.contentEl.empty()
        }
    }

    return (leaf: WorkspaceLeaf): ItemView => new WhatsNewView(leaf)
}
