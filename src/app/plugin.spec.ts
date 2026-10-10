import { describe, expect, mock, test } from 'bun:test'
import { LifeTrackerPlugin } from './plugin'
import type { PluginSettings, SettingsChangeInfo } from './types'

function definition(name: string): PluginSettings['propertyDefinitions'][number] {
    return {
        id: `id-${name}`,
        name,
        displayName: '',
        type: 'text',
        allowedValues: [],
        numberRange: null,
        defaultValue: null,
        required: false,
        description: '',
        order: 0,
        mappings: [],
        valueMapping: null,
        polarity: 'neutral',
        valueEmojis: null
    }
}

/**
 * A plugin whose `data.json` is the returned `disk.data`: loads read it,
 * saves replace it.
 */
async function createPlugin(initial: unknown) {
    const disk = { data: structuredClone(initial) }
    const plugin = new LifeTrackerPlugin({} as never, {} as never)
    const saveData = mock((data: unknown) => {
        disk.data = structuredClone(data)
        return Promise.resolve()
    })
    plugin.loadData = () => Promise.resolve(structuredClone(disk.data))
    plugin.saveData = saveData
    await plugin.loadSettings()
    return { plugin, disk, saveData }
}

describe('onExternalSettingsChange', () => {
    test('reloads settings edited on disk instead of keeping the stale copy', async () => {
        const { plugin, disk } = await createPlugin({
            propertyDefinitions: [definition('mood')],
            weekStartsOn: 1
        })

        disk.data = {
            propertyDefinitions: [definition('mood'), definition('sleep')],
            weekStartsOn: 0
        }
        await plugin.onExternalSettingsChange()

        expect(plugin.settings.propertyDefinitions.map((d) => d.name)).toEqual(['mood', 'sleep'])
        expect(plugin.settings.weekStartsOn).toBe(0)
    })

    test('notifies listeners with a full refresh', async () => {
        const { plugin, disk } = await createPlugin({ propertyDefinitions: [definition('mood')] })
        const changes: SettingsChangeInfo[] = []
        plugin.onSettingsChange((_settings, info) => changes.push(info))

        disk.data = { propertyDefinitions: [] }
        await plugin.onExternalSettingsChange()

        expect(changes).toEqual([{ type: 'full' }])
    })

    test('does not write the reloaded settings back to disk', async () => {
        const { plugin, disk, saveData } = await createPlugin({
            propertyDefinitions: [definition('mood')]
        })

        disk.data = { propertyDefinitions: [definition('energy')] }
        await plugin.onExternalSettingsChange()

        expect(saveData).not.toHaveBeenCalled()
    })

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
})
