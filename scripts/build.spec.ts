import { describe, expect, test } from 'bun:test'
import {
    ASSETS_SRC,
    BANNER,
    DIST,
    EXTERNAL_MODULES,
    PLUGIN_ID,
    SRC,
    STYLES_OUT,
    STYLES_SRC
} from './build'

describe('build constants', () => {
    test('SRC is set to src', () => {
        expect(SRC).toBe('src')
    })

    test('DIST is set to dist', () => {
        expect(DIST).toBe('dist')
    })

    test('ASSETS_SRC is set to src/assets', () => {
        expect(ASSETS_SRC).toBe('src/assets')
    })

    test('STYLES_SRC is set to src/styles.src.css', () => {
        expect(STYLES_SRC).toBe('src/styles.src.css')
    })

    test('STYLES_OUT is set to dist/styles.css', () => {
        expect(STYLES_OUT).toBe('dist/styles.css')
    })

    test('PLUGIN_ID matches package.json name', async () => {
        const packageJson = (await Bun.file('package.json').json()) as { name: string }
        expect(PLUGIN_ID).toBe(packageJson.name)
    })

    test('BANNER contains expected text', () => {
        expect(BANNER).toContain('GENERATED/BUNDLED FILE BY BUN')
        expect(BANNER).toContain('github repository')
    })
})

describe('EXTERNAL_MODULES', () => {
    test('includes obsidian', () => {
        expect(EXTERNAL_MODULES).toContain('obsidian')
    })

    test('includes electron', () => {
        expect(EXTERNAL_MODULES).toContain('electron')
    })

    test('includes codemirror modules', () => {
        expect(EXTERNAL_MODULES).toContain('@codemirror/autocomplete')
        expect(EXTERNAL_MODULES).toContain('@codemirror/state')
        expect(EXTERNAL_MODULES).toContain('@codemirror/view')
    })

    test('includes lezer modules', () => {
        expect(EXTERNAL_MODULES).toContain('@lezer/common')
        expect(EXTERNAL_MODULES).toContain('@lezer/highlight')
        expect(EXTERNAL_MODULES).toContain('@lezer/lr')
    })

    test('has expected number of external modules', () => {
        expect(EXTERNAL_MODULES.length).toBe(13)
    })
})
