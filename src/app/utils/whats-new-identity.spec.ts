import { describe, expect, test } from 'bun:test'
import { getWhatsNewTitle, getWhatsNewViewType } from './whats-new-identity'

describe('getWhatsNewViewType', () => {
    test('namespaces the view type per plugin', () => {
        expect(getWhatsNewViewType('my-plugin')).toBe('my-plugin-whats-new')
    })

    test('gives distinct view types to distinct plugins', () => {
        expect(getWhatsNewViewType('a')).not.toBe(getWhatsNewViewType('b'))
    })
})

describe('getWhatsNewTitle', () => {
    test('names the plugin and its version', () => {
        expect(getWhatsNewTitle('My Plugin', '1.2.3')).toBe("What's new: My Plugin 1.2.3")
    })
})
