import { AbstractInputSuggest, type App, type TFile } from 'obsidian'

/** Most suggestions shown at once; a large vault has thousands of notes */
const MAX_SUGGESTIONS = 50

/**
 * Autocomplete suggester for markdown files (e.g. a template path).
 * Attaches to an input element and suggests vault paths as the user types.
 */
export class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
    constructor(
        private readonly inputEl: HTMLInputElement,
        app: App
    ) {
        super(app, inputEl)
    }

    getSuggestions(inputStr: string): TFile[] {
        const query = inputStr.toLowerCase()
        return this.app.vault
            .getMarkdownFiles()
            .filter((file) => file.path.toLowerCase().includes(query))
            .slice(0, MAX_SUGGESTIONS)
    }

    override renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path)
    }

    override selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path
        this.inputEl.trigger('input')
        this.close()
    }
}
