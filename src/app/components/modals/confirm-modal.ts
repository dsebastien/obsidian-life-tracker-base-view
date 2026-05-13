import { App, Modal, Setting } from 'obsidian'

/**
 * Lightweight confirmation modal used in place of the browser's global `confirm()`.
 *
 * Obsidian's scorecard forbids `confirm()` (modal blocking calls don't play well with
 * popout windows and are non-themeable). This modal mirrors the same semantics:
 * present a message, run `onConfirm` if the user clicks the destructive button, and
 * close otherwise.
 */
export class ConfirmModal extends Modal {
    constructor(
        app: App,
        private message: string,
        private onConfirm: () => void,
        private options: {
            title?: string
            confirmText?: string
            cancelText?: string
            destructive?: boolean
        } = {}
    ) {
        super(app)
    }

    override onOpen(): void {
        const { titleEl, contentEl } = this
        titleEl.setText(this.options.title ?? 'Confirm')

        // Preserve newlines from the message in the displayed text
        const messageEl = contentEl.createEl('p')
        const lines = this.message.split('\n')
        lines.forEach((line, index) => {
            if (index > 0) messageEl.createEl('br')
            messageEl.appendText(line)
        })

        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText(this.options.cancelText ?? 'Cancel').onClick(() => this.close())
            )
            .addButton((btn) => {
                btn.setButtonText(this.options.confirmText ?? 'Confirm')
                if (this.options.destructive ?? true) {
                    btn.setWarning()
                } else {
                    btn.setCta()
                }
                btn.onClick(() => {
                    this.onConfirm()
                    this.close()
                })
            })
    }

    override onClose(): void {
        this.contentEl.empty()
    }
}
