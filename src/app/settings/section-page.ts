import { SettingPage } from 'obsidian'

/**
 * A settings sub-page drawn imperatively by one of the section editors.
 *
 * The property definition, visualization preset and Starter Kit editors are
 * dynamic (drag reordering, per-row expansion, keystroke-level editing of
 * object keys, an import list with in-place selection), which a list of
 * declarations cannot express. The declarative API hosts them as sub-pages
 * through `SettingDefinitionPage.page`, the supported route for content that
 * does not fit definitions; everything that does fit is declared in the tab.
 *
 * The framework builds a new page each time it is opened, so state that must
 * survive navigation (expanded rows, selections) lives on the section editors,
 * which the tab owns.
 */
export class SectionPage extends SettingPage {
    constructor(
        title: string,
        private readonly draw: (containerEl: HTMLElement) => void,
        private readonly onHide: () => void
    ) {
        super()
        this.title = title
    }

    /** Whether the page has been drawn since it was opened */
    private drawn = false

    /**
     * Draws the page. A redraw (after an edit that changes the page's shape)
     * keeps the scroll position: emptying the page collapses it, which would
     * otherwise throw the user back to the top of a long list.
     */
    override display(): void {
        const scroller = this.containerEl.parentElement
        const scrollTop = this.drawn && scroller ? scroller.scrollTop : null

        this.containerEl.empty()
        this.containerEl.addClass('lt-settings')
        this.draw(this.containerEl)
        this.drawn = true

        if (scroller && scrollTop !== null) {
            scroller.scrollTop = scrollTop
        }
    }

    override hide(): void {
        this.drawn = false
        this.onHide()
        super.hide()
    }
}
