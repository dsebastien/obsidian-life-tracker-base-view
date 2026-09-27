import { describe, expect, test } from 'bun:test'
import type { Setting, SettingDefinitionList } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import type { FilenameDatePattern, PluginSettings } from '../types'
import { DateSettingsSection } from './date-settings-section'

/**
 * Stands in for the plugin's write path as it really behaves: the change is
 * committed to memory synchronously, then the save is awaited. Saves settle
 * only when the test settles them, so callbacks can race a pending write.
 *
 * `declared()` is the list as the framework last received it: the section
 * re-declares it through `refresh`, and Obsidian (1.13.7) keeps drawing the
 * previous rows, deleted ones included, until then. Like Obsidian, each
 * declaration runs the rows' render hooks (after the previous rows' cleanups)
 * against stand-in rows that record focus.
 */
function createHost(patterns: FilenameDatePattern[]) {
    const pendingSaves: { resolve: () => void; reject: (error: Error) => void }[] = []
    const events: string[] = []
    const failures: unknown[] = []
    const host = {
        settings: { filenameDatePatterns: patterns } as PluginSettings,
        async updateSettings(updater: (draft: PluginSettings) => void): Promise<void> {
            const draft = structuredClone(host.settings)
            updater(draft)
            host.settings = draft
            events.push('commit')
            await new Promise<void>((resolve, reject) => pendingSaves.push({ resolve, reject }))
            events.push('saved')
        }
    }
    const doc = { body: { name: 'body' }, activeElement: null as unknown }
    doc.activeElement = doc.body
    const rows: { settingEl: { name: string } }[] = []
    const cleanups: (() => void)[] = []
    const draw = (list: SettingDefinitionList): void => {
        for (const cleanup of cleanups.splice(0)) cleanup()
        const items = list.items ?? []
        // Obsidian 1.13.7 keys rows by name ("Pattern 1", ...), so a redraw
        // reuses the rows at the same positions and removes the extra ones;
        // a removed row takes focus with it
        for (const removed of rows.splice(items.length)) {
            if (removed.settingEl === doc.activeElement) doc.activeElement = doc.body
        }
        items.forEach((item, index) => {
            const reused = rows[index]
            const settingEl = reused?.settingEl ?? {
                name: `row ${index}`,
                doc,
                focus(): void {
                    doc.activeElement = settingEl
                }
            }
            if (!reused) rows.push({ settingEl })
            const statusEl = { textContent: '', addClass() {}, removeClass() {}, remove() {} }
            const text = {
                inputEl: { classList: { add() {} } },
                setPlaceholder: () => text,
                setValue: () => text,
                onChange: () => text
            }
            const setting = {
                settingEl,
                descEl: { createDiv: () => statusEl },
                addText(build: (component: typeof text) => void) {
                    build(text)
                    return setting
                }
            }
            if ('render' in item && item.render) {
                const cleanup = item.render(setting as unknown as Setting, {} as never)
                if (cleanup) cleanups.push(cleanup)
            }
        })
    }
    const section = new DateSettingsSection(
        host as unknown as LifeTrackerPlugin,
        () => {
            events.push('refresh')
            declaredList = readList()
            draw(declaredList)
        },
        (error) => {
            failures.push(error)
        }
    )
    const readList = (): SettingDefinitionList => {
        const page = section.patternsPage()
        const found = page.items?.find((item) => 'type' in item && item.type === 'list')
        if (!found) throw new Error('no pattern list declared')
        return found as SettingDefinitionList
    }
    let declaredList = readList()
    draw(declaredList)
    const settle = async (outcome: 'save' | 'fail'): Promise<void> => {
        for (const save of pendingSaves.splice(0)) {
            if (outcome === 'save') save.resolve()
            else save.reject(new Error('disk full'))
        }
        // Let the awaiting callbacks finish
        for (let i = 0; i < 3; i += 1) await Promise.resolve()
    }
    const current = (): string[] => host.settings.filenameDatePatterns.map((entry) => entry.id)
    const focused = (): unknown => doc.activeElement
    const rowEl = (index: number): unknown => rows[index]?.settingEl
    const focusElsewhere = (): void => {
        doc.activeElement = { name: 'another control' }
    }
    return {
        declared: () => declaredList,
        settle,
        current,
        events,
        failures,
        focused,
        rowEl,
        focusElsewhere
    }
}

const patterns = (...ids: string[]): FilenameDatePattern[] =>
    ids.map((id) => ({ id, pattern: `${id} {{date}}` }))

describe('DateSettingsSection filename pattern list', () => {
    test('declares one row per pattern, kept out of the settings search', () => {
        const { declared } = createHost(patterns('a', 'b'))
        const items = declared().items ?? []
        expect(items.map((item) => item.name)).toEqual(['Pattern 1', 'Pattern 2'])
        expect(items.every((item) => 'searchable' in item && item.searchable === false)).toBe(true)
    })

    test('the list is re-declared as soon as a change is committed, before the save lands', async () => {
        // Until it is, the deleted row stays drawn and focused: a second
        // Delete on it would hit whichever pattern moved into its position
        const { declared, settle, events } = createHost(patterns('a', 'b'))
        declared().onDelete?.(1)
        expect(events).toEqual(['commit', 'refresh'])
        await settle('save')
        expect(events).toEqual(['commit', 'refresh', 'saved'])
    })

    test('deleting twice while the first save is pending removes the rows the user saw', async () => {
        // Row A deleted, then the row now drawn first (B) deleted
        const { declared, settle, current } = createHost(patterns('a', 'b', 'c'))
        declared().onDelete?.(0)
        declared().onDelete?.(0)
        expect(current()).toEqual(['c'])
        expect(declared().items).toHaveLength(1)
        await settle('save')
    })

    test('a deletion past the end writes nothing', async () => {
        const { declared, current, events } = createHost(patterns('a'))
        declared().onDelete?.(5)
        expect(current()).toEqual(['a'])
        expect(events).toEqual([])
        await Promise.resolve()
    })

    test('a reorder moves the pattern the framework moved, by id', async () => {
        const { declared, settle, current } = createHost(patterns('a', 'b', 'c'))
        declared().onReorder?.(0, 2)
        expect(current()).toEqual(['b', 'c', 'a'])
        declared().onReorder?.(0, 1)
        expect(current()).toEqual(['c', 'b', 'a'])
        await settle('save')
    })

    test('adding appends an empty pattern with a fresh id', async () => {
        const { declared, settle, current } = createHost(patterns('a'))
        declared().addItem?.action({} as HTMLElement)
        await settle('save')
        expect(current()).toHaveLength(2)
        expect(current()[1]).not.toBe('a')
        expect(declared().items).toHaveLength(2)
    })

    test('a failed save is reported and the list still matches memory', async () => {
        const { declared, settle, current, failures } = createHost(patterns('a', 'b'))
        declared().onDelete?.(0)
        await settle('fail')
        expect(failures).toHaveLength(1)
        expect(current()).toEqual(['b'])
        expect(declared().items).toHaveLength(1)
    })

    test('deleting the focused last row moves focus to the row now last', async () => {
        // Its row is removed rather than reused, so focus would fall back to
        // the page and keyboard deletion could not go on
        const { declared, settle, focused, rowEl } = createHost(patterns('a', 'b', 'c'))
        ;(rowEl(2) as { focus: () => void }).focus()
        declared().onDelete?.(2)
        expect(focused()).toBe(rowEl(1))
        declared().onDelete?.(1)
        expect(focused()).toBe(rowEl(0))
        await settle('save')
    })

    test('a deletion does not steal focus the user has put elsewhere', async () => {
        const { declared, settle, focused, focusElsewhere } = createHost(patterns('a', 'b'))
        focusElsewhere()
        const before = focused()
        declared().onDelete?.(0)
        expect(focused()).toBe(before)
        await settle('save')
    })
})
