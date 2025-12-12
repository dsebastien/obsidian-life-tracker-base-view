import { describe, expect, test } from 'bun:test'
import { VisualizationType } from './visualization-type.intf'
import {
    CONTEXT_MENU_VISUALIZATION_OPTIONS,
    CONFIG_CARD_VISUALIZATION_OPTIONS,
    SETTINGS_TAB_VISUALIZATION_OPTIONS
} from './visualization-options.intf'

/**
 * Get all values from the VisualizationType enum
 */
function getAllVisualizationTypes(): VisualizationType[] {
    return Object.values(VisualizationType)
}

describe('Visualization Options Synchronization', () => {
    const allTypes = getAllVisualizationTypes()

    describe('VisualizationType enum', () => {
        test('should have expected number of visualization types', () => {
            // Update this number when adding/removing visualization types
            expect(allTypes.length).toBe(12)
        })

        test('should contain all expected visualization types', () => {
            const expectedTypes: VisualizationType[] = [
                VisualizationType.Heatmap,
                VisualizationType.LineChart,
                VisualizationType.BarChart,
                VisualizationType.AreaChart,
                VisualizationType.PieChart,
                VisualizationType.DoughnutChart,
                VisualizationType.RadarChart,
                VisualizationType.PolarAreaChart,
                VisualizationType.ScatterChart,
                VisualizationType.BubbleChart,
                VisualizationType.TagCloud,
                VisualizationType.Timeline
            ]
            expect(allTypes.sort()).toEqual(expectedTypes.sort())
        })
    })

    describe('CONTEXT_MENU_VISUALIZATION_OPTIONS (card-context-menu)', () => {
        test('should include all visualization types from enum', () => {
            const contextMenuTypes = CONTEXT_MENU_VISUALIZATION_OPTIONS.map((opt) => opt.type)

            for (const vizType of allTypes) {
                expect(contextMenuTypes).toContain(vizType)
            }
        })

        test('should not have duplicate visualization types', () => {
            const contextMenuTypes = CONTEXT_MENU_VISUALIZATION_OPTIONS.map((opt) => opt.type)
            const uniqueTypes = new Set(contextMenuTypes)
            expect(uniqueTypes.size).toBe(contextMenuTypes.length)
        })

        test('should have same count as enum', () => {
            expect(CONTEXT_MENU_VISUALIZATION_OPTIONS.length).toBe(allTypes.length)
        })

        test('each option should have required properties', () => {
            for (const option of CONTEXT_MENU_VISUALIZATION_OPTIONS) {
                expect(option.type).toBeDefined()
                expect(option.label).toBeDefined()
                expect(option.label.length).toBeGreaterThan(0)
                expect(option.icon).toBeDefined()
                expect(option.icon.length).toBeGreaterThan(0)
            }
        })
    })

    describe('CONFIG_CARD_VISUALIZATION_OPTIONS (column-config-card)', () => {
        test('should include all visualization types from enum', () => {
            const configCardTypes = CONFIG_CARD_VISUALIZATION_OPTIONS.map((opt) => opt.type)

            for (const vizType of allTypes) {
                expect(configCardTypes).toContain(vizType)
            }
        })

        test('should not have duplicate visualization types', () => {
            const configCardTypes = CONFIG_CARD_VISUALIZATION_OPTIONS.map((opt) => opt.type)
            const uniqueTypes = new Set(configCardTypes)
            expect(uniqueTypes.size).toBe(configCardTypes.length)
        })

        test('should have same count as enum', () => {
            expect(CONFIG_CARD_VISUALIZATION_OPTIONS.length).toBe(allTypes.length)
        })

        test('each option should have required properties', () => {
            for (const option of CONFIG_CARD_VISUALIZATION_OPTIONS) {
                expect(option.type).toBeDefined()
                expect(option.label).toBeDefined()
                expect(option.label.length).toBeGreaterThan(0)
                expect(option.icon).toBeDefined()
                expect(option.icon.length).toBeGreaterThan(0)
                expect(option.description).toBeDefined()
                expect(option.description.length).toBeGreaterThan(0)
            }
        })
    })

    describe('SETTINGS_TAB_VISUALIZATION_OPTIONS (settings-tab)', () => {
        test('should include all visualization types from enum', () => {
            const settingsTabTypes = Object.keys(SETTINGS_TAB_VISUALIZATION_OPTIONS)

            for (const vizType of allTypes) {
                expect(settingsTabTypes).toContain(vizType)
            }
        })

        test('should not have extra types not in enum', () => {
            const settingsTabTypes = Object.keys(SETTINGS_TAB_VISUALIZATION_OPTIONS)

            for (const type of settingsTabTypes) {
                expect(allTypes).toContain(type as VisualizationType)
            }
        })

        test('should have same count as enum', () => {
            expect(Object.keys(SETTINGS_TAB_VISUALIZATION_OPTIONS).length).toBe(allTypes.length)
        })

        test('each option should have a non-empty label', () => {
            for (const [type, label] of Object.entries(SETTINGS_TAB_VISUALIZATION_OPTIONS)) {
                expect(type).toBeDefined()
                expect(label).toBeDefined()
                expect(label.length).toBeGreaterThan(0)
            }
        })
    })

    describe('Cross-component consistency', () => {
        test('all three components should have the same visualization types', () => {
            const contextMenuTypes = new Set(
                CONTEXT_MENU_VISUALIZATION_OPTIONS.map((opt) => opt.type)
            )
            const configCardTypes = new Set(
                CONFIG_CARD_VISUALIZATION_OPTIONS.map((opt) => opt.type)
            )
            const settingsTabTypes = new Set(
                Object.keys(SETTINGS_TAB_VISUALIZATION_OPTIONS) as VisualizationType[]
            )

            // Check context menu vs config card
            expect(contextMenuTypes).toEqual(configCardTypes)

            // Check context menu vs settings tab
            expect(contextMenuTypes).toEqual(settingsTabTypes)
        })

        test('labels should be consistent between context menu and config card', () => {
            const contextMenuLabels = new Map(
                CONTEXT_MENU_VISUALIZATION_OPTIONS.map((opt) => [opt.type, opt.label])
            )
            const configCardLabels = new Map(
                CONFIG_CARD_VISUALIZATION_OPTIONS.map((opt) => [opt.type, opt.label])
            )

            // Context menu and config card should have matching labels
            for (const [type, label] of contextMenuLabels) {
                expect(configCardLabels.get(type)).toBe(label)
            }
        })

        test('icons should be consistent between context menu and config card', () => {
            const contextMenuIcons = new Map(
                CONTEXT_MENU_VISUALIZATION_OPTIONS.map((opt) => [opt.type, opt.icon])
            )
            const configCardIcons = new Map(
                CONFIG_CARD_VISUALIZATION_OPTIONS.map((opt) => [opt.type, opt.icon])
            )

            // Context menu and config card should have matching icons
            for (const [type, icon] of contextMenuIcons) {
                expect(configCardIcons.get(type)).toBe(icon)
            }
        })
    })

    describe('Regression prevention', () => {
        test('adding a new VisualizationType should fail this test until all options arrays are updated', () => {
            // This test ensures that if someone adds a new visualization type to the enum,
            // they must also add it to all three options arrays
            const enumCount = allTypes.length
            const contextMenuCount = CONTEXT_MENU_VISUALIZATION_OPTIONS.length
            const configCardCount = CONFIG_CARD_VISUALIZATION_OPTIONS.length
            const settingsTabCount = Object.keys(SETTINGS_TAB_VISUALIZATION_OPTIONS).length

            expect(contextMenuCount).toBe(enumCount)
            expect(configCardCount).toBe(enumCount)
            expect(settingsTabCount).toBe(enumCount)
        })

        test('each visualization type in enum should exist in all option arrays', () => {
            for (const vizType of allTypes) {
                // Check context menu
                const inContextMenu = CONTEXT_MENU_VISUALIZATION_OPTIONS.some(
                    (opt) => opt.type === vizType
                )
                expect(inContextMenu).toBe(true)

                // Check config card
                const inConfigCard = CONFIG_CARD_VISUALIZATION_OPTIONS.some(
                    (opt) => opt.type === vizType
                )
                expect(inConfigCard).toBe(true)

                // Check settings tab
                const inSettingsTab = vizType in SETTINGS_TAB_VISUALIZATION_OPTIONS
                expect(inSettingsTab).toBe(true)
            }
        })
    })
})
