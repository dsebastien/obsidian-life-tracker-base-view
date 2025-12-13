import { AbstractInputSuggest, type App, type TAbstractFile, TFolder } from 'obsidian'

/**
 * Autocomplete suggester for vault folders.
 * Attaches to an input element and shows folder suggestions as the user types.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    constructor(
        private inputEl: HTMLInputElement,
        app: App
    ) {
        super(app, inputEl)
    }

    /**
     * Get folder suggestions matching the input string
     */
    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles()
        const folders: TFolder[] = []
        const lowerCaseInputStr = inputStr.toLowerCase()

        abstractFiles.forEach((file: TAbstractFile) => {
            if (file instanceof TFolder && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                folders.push(file)
            }
        })

        return folders
    }

    override renderSuggestion(folder: TFolder, el: HTMLElement): void {
        el.setText(folder.path)
    }

    override selectSuggestion(folder: TFolder): void {
        this.inputEl.value = folder.path
        this.inputEl.trigger('input')
        this.close()
    }
}
