import { describe, expect, test } from 'bun:test'
import { templaterWillAutoApply } from './templater-autofire.utils'

/** Templater's real settings in the reference vault */
const DISPATCHER_VAULT = {
    trigger_on_file_creation: true,
    enable_folder_templates: true,
    folder_templates: [
        { folder: '/', template: '50 Resources/54 Templates/Templater/TPL Dispatcher.md' }
    ],
    enable_file_templates: false,
    file_templates: []
}

const TARGET = '40 Journal/41 Daily Notes/2026/35/2026-08-30.md'

describe('templaterWillAutoApply', () => {
    test('a root folder template with the trigger on covers every note', () => {
        // The reference vault. Applying a template on top of this duplicates the
        // whole note, so creation must defer to Templater here.
        expect(templaterWillAutoApply(DISPATCHER_VAULT, TARGET)).toBe(true)
        expect(templaterWillAutoApply(DISPATCHER_VAULT, 'Note.md')).toBe(true)
    })

    test('the trigger being off means Templater never fires on its own', () => {
        expect(
            templaterWillAutoApply({ ...DISPATCHER_VAULT, trigger_on_file_creation: false }, TARGET)
        ).toBe(false)
    })

    test('folder templates disabled are not consulted', () => {
        expect(
            templaterWillAutoApply({ ...DISPATCHER_VAULT, enable_folder_templates: false }, TARGET)
        ).toBe(false)
    })

    test('a folder template covers its own folder and everything beneath', () => {
        const settings = {
            trigger_on_file_creation: true,
            enable_folder_templates: true,
            folder_templates: [{ folder: '40 Journal', template: 'T.md' }]
        }

        expect(templaterWillAutoApply(settings, TARGET)).toBe(true)
        expect(templaterWillAutoApply(settings, '40 Journal/Note.md')).toBe(true)
    })

    test('a folder template does not cover a sibling with a shared prefix', () => {
        // '40 Journal' must not match '40 Journal Archive' — a prefix test that
        // ignores the separator would template the wrong notes.
        const settings = {
            trigger_on_file_creation: true,
            enable_folder_templates: true,
            folder_templates: [{ folder: '40 Journal', template: 'T.md' }]
        }

        expect(templaterWillAutoApply(settings, '40 Journal Archive/2026-08-30.md')).toBe(false)
    })

    test('an unrelated folder template does not cover the target', () => {
        const settings = {
            trigger_on_file_creation: true,
            enable_folder_templates: true,
            folder_templates: [{ folder: 'Meetings', template: 'T.md' }]
        }

        expect(templaterWillAutoApply(settings, TARGET)).toBe(false)
    })

    test('an entry with no template configured templates nothing', () => {
        const settings = {
            trigger_on_file_creation: true,
            enable_folder_templates: true,
            folder_templates: [{ folder: '/', template: '' }]
        }

        expect(templaterWillAutoApply(settings, TARGET)).toBe(false)
    })

    test('a matching file template counts', () => {
        const settings = {
            trigger_on_file_creation: true,
            enable_file_templates: true,
            file_templates: [{ regex: '\\d{4}-\\d{2}-\\d{2}', template: 'T.md' }]
        }

        expect(templaterWillAutoApply(settings, TARGET)).toBe(true)
    })

    test('a malformed file-template regex matches nothing instead of throwing', () => {
        const settings = {
            trigger_on_file_creation: true,
            enable_file_templates: true,
            file_templates: [{ regex: '([unclosed', template: 'T.md' }]
        }

        expect(templaterWillAutoApply(settings, TARGET)).toBe(false)
    })

    test('absent or malformed settings mean Templater is not going to fire', () => {
        expect(templaterWillAutoApply(null, TARGET)).toBe(false)
        expect(templaterWillAutoApply({}, TARGET)).toBe(false)
        expect(
            templaterWillAutoApply(
                { trigger_on_file_creation: true, enable_folder_templates: true },
                TARGET
            )
        ).toBe(false)
        expect(
            templaterWillAutoApply(
                {
                    trigger_on_file_creation: true,
                    enable_folder_templates: true,
                    folder_templates: 'nope'
                },
                TARGET
            )
        ).toBe(false)
    })

    test('a note at the vault root is covered by a root folder template', () => {
        expect(templaterWillAutoApply(DISPATCHER_VAULT, '2026-08-30.md')).toBe(true)
    })
})
