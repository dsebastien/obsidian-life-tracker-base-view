import { describe, expect, test } from 'bun:test'
import { Glob, file } from 'bun'

/**
 * Source-level guard for the declarative settings API (Obsidian 1.13+).
 *
 * Nothing in CI renders a settings pane, so a broken settings control cannot
 * fail a normal test — settings controls have shipped invisible through a
 * fully green suite and two adversarial reviews. This spec is the cheap
 * partial guard: it fails on the patterns that caused those bugs.
 *
 * - `group.listEl` — a `render:` hook writing outside its own row. The
 *   framework owns that DOM and discards the write; the control is simply
 *   not there at runtime.
 * - `settingEl.remove()` / `settingEl.detach()` — deleting the row a
 *   `render:` hook would have drawn into. (`infoEl.remove()` is fine — that
 *   is the row's label block, not the row.)
 *
 * A live vault check remains the acceptance criterion for any settings
 * change; this spec only catches the known-fatal patterns early.
 *
 * Two things keep the guard from passing vacuously, because a guard that
 * quietly checks nothing is worse than no guard at all: the scan must reach a
 * file that actually declares `getSettingDefinitions`, and the self-test
 * below re-runs the detector against known-bad source. Comments are skipped
 * line by line rather than with a stateful block sweep: a sweep treats the
 * opener inside a glob string or a URL as a comment start and silently
 * deletes the real code that follows, offenders included.
 *
 * Known limitation, chosen deliberately: string literals are matched like any
 * other code, so a message or URL that spells out one of these patterns will
 * trip the guard. That direction is safe — a false positive fails loudly at
 * commit time and takes a minute to reword. A false negative is the one that
 * ships an invisible control.
 */

const LIST_EL = /(?<!\bthis)\.\s*listEl\b|\[\s*['"]listEl['"]\s*\]/
const ROW_REMOVAL = /settingEl\s*[?!]?\s*\.\s*(remove|detach)\s*\(/

/** Strips comments one line at a time, so no sweep can swallow real code. */
export const stripComments = (source: string): string =>
    source
        .split('\n')
        .map((line) => {
            // Whole-line comments, including the body of a JSDoc block.
            if (/^\s*(\/\/|\/\*|\*)/.test(line)) {
                return ''
            }
            // A self-contained block comment, then a trailing line comment —
            // but not the slashes of a `://` URL.
            return line.replace(/\/\*.*?\*\//g, '').replace(/(^|[^:])\/\/.*$/, '$1')
        })
        .join('\n')

/** The offenders in one chunk of source. Shared by the scan and its self-test. */
export const findOffenders = (source: string, label: string): string[] => {
    const content = stripComments(source)
    const offenders: string[] = []
    if (LIST_EL.test(content)) {
        offenders.push(`${label}: accesses a group listEl`)
    }
    if (ROW_REMOVAL.test(content)) {
        offenders.push(`${label}: removes the setting row`)
    }
    return offenders
}

describe('declarative settings guard', () => {
    test('no render hook writes outside its own row', async () => {
        const glob = new Glob('src/app/settings/**/*.ts')
        const offenders: string[] = []
        let sawSettingDefinitions = false
        for await (const filePath of glob.scan({ cwd: `${import.meta.dir}/../../..` })) {
            if (filePath.endsWith('.spec.ts')) {
                continue
            }
            const raw = await file(`${import.meta.dir}/../../../${filePath}`).text()
            if (raw.includes('getSettingDefinitions')) {
                sawSettingDefinitions = true
            }
            offenders.push(...findOffenders(raw, filePath))
        }
        // Failing here means the settings sources moved and the scan above
        // was checking nothing at all.
        expect(sawSettingDefinitions).toBe(true)
        expect(offenders).toEqual([])
    })

    test('detects a real offender, and leaves legitimate code alone', () => {
        const bad = [
            "const DEFAULT_EXCLUDE = '**/*.tmp'",
            "const DOCS = 'https://example.com/docs'",
            'function buildRow(group: SettingGroup, setting: Setting) {',
            "    group.listEl.createDiv({ text: 'invisible control' })",
            '    setting.settingEl.detach()',
            '}'
        ].join('\n')
        expect(findOffenders(bad, 'bad.ts')).toEqual([
            'bad.ts: accesses a group listEl',
            'bad.ts: removes the setting row'
        ])

        const good = [
            '// Never call settingEl.remove() from a render hook.',
            '/** Writing to group.listEl is discarded by the framework. */',
            "const DOCS = 'https://example.com/docs/settings'",
            'class ListWidget {',
            '    private listEl!: HTMLElement',
            '    clear(): void {',
            '        this.listEl.empty()',
            '        this.setting.infoEl.remove()',
            "        this.setting.settingEl.addClass('is-wide')",
            '    }',
            '}'
        ].join('\n')
        expect(findOffenders(good, 'good.ts')).toEqual([])
    })
})
