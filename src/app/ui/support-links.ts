import { Setting } from 'obsidian'

/**
 * Single source of truth for the support calls to action shown across every
 * surface of the plugin: the settings tab, the "What's new" dialog, the README
 * and the documentation site. Keep these in sync with `manifest.json`'s
 * `fundingUrl` and with `.github/FUNDING.yml`.
 */
export const KNOWII_COMMUNITY_URL = 'https://www.store.dsebastien.net/product/knowii-community/'
export const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/dsebastien'
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dsebastien'
export const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@dsebastien'
export const NEWSLETTER_URL = 'https://dsebastien.net/newsletter'

/** Renders a Buy me a coffee badge (or anything else) below the settings. */
export type SupportBadgeRenderer = (containerEl: HTMLElement) => void

/**
 * Renders the shared support section: community, sponsoring and follow calls to
 * action. Every plugin's settings tab delegates to this so the wording and the
 * links stay identical across the whole plugin collection.
 *
 * @param containerEl where to render
 * @param renderBadge optional renderer for the Buy me a coffee badge, called
 * last (the badge asset lives in each plugin, so it is injected)
 */
export function renderSupportSection(
    containerEl: HTMLElement,
    renderBadge?: SupportBadgeRenderer
): void {
    new Setting(containerEl).setName('Support').setHeading()

    new Setting(containerEl)
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

    new Setting(containerEl)
        .setName('Support this plugin')
        .setDesc('Your support keeps development and maintenance going ❤️')
        .addButton((button) => {
            button.setButtonText('GitHub Sponsors').onClick(() => {
                window.open(GITHUB_SPONSORS_URL)
            })
        })

    new Setting(containerEl)
        .setName('Stay in touch')
        .setDesc(
            'Obsidian, Personal Knowledge Management and note-taking, straight to your inbox and feed.'
        )
        .addButton((button) => {
            button.setButtonText('Newsletter').onClick(() => {
                window.open(NEWSLETTER_URL)
            })
        })
        .addButton((button) => {
            button.setButtonText('YouTube').onClick(() => {
                window.open(YOUTUBE_CHANNEL_URL)
            })
        })

    if (renderBadge) {
        renderBadge(containerEl)
    }

    const spacing = containerEl.createDiv()
    spacing.classList.add('support-header-margin')
}
