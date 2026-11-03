import { describe, expect, test } from 'bun:test'
import type { App } from 'obsidian'
import { StarterKitService } from './starter-kit.service'

/** An app whose Starter Kit returns `noteTypes` */
function appWith(noteTypes: unknown[]): App {
    const api = {
        listNoteTypes: () => ({ success: true, data: noteTypes }),
        listGlobalProperties: () => ({ success: true, data: [] })
    }
    const host = { plugins: { plugins: { 'obsidian-starter-kit': { api } } } }
    return host as never
}

const STRENGTH = {
    id: 'nt-strength',
    name: 'Strength Sessions',
    description: '',
    icon: null,
    mappings: [],
    properties: [],
    associatedFolder: '  40 Journal/46 Sessions/Sport/Strength/{{year}} ',
    templatePath: 'TPL Strength Session.md',
    noteNamePrefix: '   ',
    noteNameSuffix: ' (Strength Session)',
    tags: ['zone/journal', 3]
}

describe('StarterKitService.listNoteTypes', () => {
    test('keeps the spaces of name affixes; blank affixes count as absent', () => {
        const [noteType] = new StarterKitService(appWith([STRENGTH])).listNoteTypes()
        expect(noteType?.noteNameSuffix).toBe(' (Strength Session)')
        expect(noteType?.noteNamePrefix).toBeNull()
    })

    test('still trims folders and drops non-string tags', () => {
        const [noteType] = new StarterKitService(appWith([STRENGTH])).listNoteTypes()
        expect(noteType?.associatedFolder).toBe('40 Journal/46 Sessions/Sport/Strength/{{year}}')
        expect(noteType?.tags).toEqual(['zone/journal'])
    })
})
