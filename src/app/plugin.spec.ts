import { describe, expect, test } from 'bun:test'
import { LifeTrackerPlugin } from './plugin'
import { createDefaultPropertyDefinition } from './types'
import type { PluginSettings, SettingsChangeInfo } from './types'
import type { LifeTrackerPluginSettingTab } from './settings/settings-tab'
import { NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION } from './settings/settings-migrations'

const definition = (name: string) => ({ ...createDefaultPropertyDefinition(`id-${name}`, 0), name })

/** A plugin whose `data.json` is `disk.data`: loads read it, saves replace it */
async function createPlugin(initial: unknown) {
    const disk = { data: initial }
    const plugin = new LifeTrackerPlugin({} as never, {} as never)
    plugin.loadData = () => Promise.resolve(structuredClone(disk.data))
    plugin.saveData = (data: unknown) => {
        disk.data = structuredClone(data)
        return Promise.resolve()
    }
    await plugin.loadSettings()
    return { plugin, disk }
}

describe('onExternalSettingsChange', () => {
    test('a later save keeps the external change instead of overwriting it', async () => {
        const { plugin, disk } = await createPlugin({ propertyDefinitions: [definition('mood')] })

        disk.data = { propertyDefinitions: [definition('mood'), definition('sleep')] }
        await plugin.onExternalSettingsChange()
        await plugin.updateSettings((draft) => {
            draft.showConfettiOnCapture = false
        })

        const saved = disk.data as PluginSettings
        expect(saved.propertyDefinitions.map((d) => d.name)).toEqual(['mood', 'sleep'])
        expect(saved.showConfettiOnCapture).toBe(false)
    })

    test('notifies listeners with a full refresh', async () => {
        const { plugin } = await createPlugin({ propertyDefinitions: [definition('mood')] })
        const changes: SettingsChangeInfo[] = []
        plugin.onSettingsChange((_settings, info) => changes.push(info))

        await plugin.onExternalSettingsChange()

        expect(changes).toEqual([{ type: 'full' }])
    })

    test('refreshes an open settings tab with the reloaded values', async () => {
        const { plugin, disk } = await createPlugin({ propertyDefinitions: [definition('mood')] })
        const seen: string[][] = []
        plugin.settingTab = {
            refreshFromSettings: () =>
                seen.push(plugin.settings.propertyDefinitions.map((d) => d.name))
        } as unknown as LifeTrackerPluginSettingTab

        disk.data = { propertyDefinitions: [definition('mood'), definition('sleep')] }
        await plugin.onExternalSettingsChange()

        expect(seen).toEqual([['mood', 'sleep']])
    })

    test('an unreadable file keeps the current settings', async () => {
        const { plugin } = await createPlugin({ propertyDefinitions: [definition('mood')] })
        const changes: SettingsChangeInfo[] = []
        plugin.onSettingsChange((_settings, info) => changes.push(info))
        plugin.loadData = () => Promise.reject(new SyntaxError('Unexpected end of JSON input'))

        await plugin.onExternalSettingsChange()

        expect(plugin.settings.propertyDefinitions.map((d) => d.name)).toEqual(['mood'])
        expect(changes).toEqual([])
    })

    test('a missing file keeps the current settings, so a later save cannot wipe them', async () => {
        const { plugin, disk } = await createPlugin({ propertyDefinitions: [definition('mood')] })

        disk.data = null
        await plugin.onExternalSettingsChange()
        await plugin.updateSettings((draft) => {
            draft.showConfettiOnCapture = false
        })

        const saved = disk.data as PluginSettings | null
        expect(saved?.propertyDefinitions.map((d) => d.name)).toEqual(['mood'])
    })
})

describe('loading capture targets', () => {
    test('settings written before capture targets load with none, definitions untouched', async () => {
        const stored = { propertyDefinitions: [definition('mood')], dailyNoteTypeId: 'nt-0038' }
        const { plugin } = await createPlugin(stored)

        expect(plugin.settings.captureTargets).toEqual([])
        expect(plugin.settings.propertyDefinitions).toEqual(stored.propertyDefinitions)
        expect(plugin.settings.dailyNoteTypeId).toBe('nt-0038')
    })

    test('targets are read field by field and a malformed captureTargetId is dropped', async () => {
        const { plugin } = await createPlugin({
            propertyDefinitions: [
                { ...definition('push_ups'), captureTargetId: 't1' },
                { ...definition('squats'), captureTargetId: 42 }
            ],
            captureTargets: [{ id: 't1', name: 'Through the day', filters: 'oops' }, 'junk']
        })

        expect(plugin.settings.captureTargets).toHaveLength(1)
        expect(plugin.settings.captureTargets[0]).toMatchObject({
            id: 't1',
            name: 'Through the day',
            filters: [],
            dateProperty: 'date'
        })
        const [pushUps, squats] = plugin.settings.propertyDefinitions
        expect(pushUps?.captureTargetId).toBe('t1')
        expect(squats && 'captureTargetId' in squats).toBe(false)
    })
})

describe('unloaded while loading (review #6)', () => {
    test('nothing is registered when the plugin was unloaded during the settings load', async () => {
        let releaseLoad: (data: unknown) => void = () => undefined
        const app = {
            workspace: {
                onLayoutReady: (): void => undefined,
                detachLeavesOfType: (): void => undefined
            }
        }
        const plugin = new LifeTrackerPlugin(
            app as never,
            {
                id: 'life-tracker',
                name: 'Life Tracker',
                version: '3.3.0'
            } as never
        )
        const registered: string[] = []
        const record = (name: string) => (): unknown => {
            registered.push(name)
            return true
        }
        Object.assign(plugin, {
            registerView: (): void => undefined,
            register: (): void => undefined,
            registerBasesView: record('registerBasesView'),
            addSettingTab: record('addSettingTab'),
            addCommand: record('addCommand'),
            addRibbonIcon: record('addRibbonIcon'),
            registerObsidianProtocolHandler: record('registerObsidianProtocolHandler')
        })
        plugin.loadData = () =>
            new Promise((resolve) => {
                releaseLoad = resolve
            })

        const loading = plugin.onload()
        plugin.onunload()
        releaseLoad({})
        await loading

        expect(registered).toEqual([])
    })
})

describe('malformed property definitions (review #12)', () => {
    test('a null or non-object entry does not stop the settings from loading', async () => {
        const { plugin } = await createPlugin({
            propertyDefinitions: [null, 'junk', { ...definition('mood'), captureTargetId: 7 }]
        })
        expect(plugin.settings.propertyDefinitions).toHaveLength(3)
        const mood = plugin.settings.propertyDefinitions[2]
        expect(mood && 'captureTargetId' in mood).toBe(false)
    })
})

describe('one-time settings migrations', () => {
    const MIGRATION_ID = NOTE_TYPE_FILE_NAME_PATTERN_MIGRATION.id
    const hiddenPattern = {
        id: 't1',
        name: 'Through the day',
        noteTypeId: 'nt-strength',
        fileNamePattern: '{{date}} (Workout)'
    }

    test('settings from 3.5.0 get the hidden pattern reset once, and saved', async () => {
        const { plugin, disk } = await createPlugin({ captureTargets: [hiddenPattern] })

        expect(plugin.settings.captureTargets[0]?.fileNamePattern).toBe('{{date}}')
        const saved = disk.data as PluginSettings
        expect(saved.captureTargets[0]?.fileNamePattern).toBe('{{date}}')
        expect(saved.completedMigrations).toEqual([MIGRATION_ID])
    })

    test('a pattern set after the upgrade survives restarts', async () => {
        const { plugin, disk } = await createPlugin({ captureTargets: [hiddenPattern] })
        await plugin.updateSettings((draft) => {
            const target = draft.captureTargets[0]
            if (target) target.fileNamePattern = '{{date}} Gym'
        })

        const restarted = await createPlugin(disk.data)
        expect(restarted.plugin.settings.captureTargets[0]?.fileNamePattern).toBe('{{date}} Gym')
    })

    test('an external file without the marker does not run the migration again', async () => {
        const { plugin, disk } = await createPlugin({ captureTargets: [hiddenPattern] })

        // Written by 3.5.0 on another device: the marker is gone
        disk.data = { captureTargets: [{ ...hiddenPattern, fileNamePattern: '{{date}} Gym' }] }
        await plugin.onExternalSettingsChange()

        expect(plugin.settings.captureTargets[0]?.fileNamePattern).toBe('{{date}} Gym')
        expect(plugin.settings.completedMigrations).toEqual([MIGRATION_ID])
    })

    test('a fresh install marks every migration done and writes nothing', async () => {
        let saves = 0
        const plugin = new LifeTrackerPlugin({} as never, {} as never)
        plugin.loadData = () => Promise.resolve(null)
        plugin.saveData = () => {
            saves++
            return Promise.resolve()
        }
        await plugin.loadSettings()

        expect(plugin.settings.completedMigrations).toEqual([MIGRATION_ID])
        expect(saves).toBe(0)
    })

    test('settings that already ran it are left alone and not rewritten', async () => {
        const stored = { captureTargets: [hiddenPattern], completedMigrations: [MIGRATION_ID] }
        let saves = 0
        const plugin = new LifeTrackerPlugin({} as never, {} as never)
        plugin.loadData = () => Promise.resolve(structuredClone(stored))
        plugin.saveData = () => {
            saves++
            return Promise.resolve()
        }
        await plugin.loadSettings()

        expect(plugin.settings.captureTargets[0]?.fileNamePattern).toBe('{{date}} (Workout)')
        expect(saves).toBe(0)
    })
})
