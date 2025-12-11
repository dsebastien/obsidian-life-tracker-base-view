import { describe, expect, test } from 'bun:test'

// Note: Integration tests for createReleaseZip should be run from project root
// These are unit tests that don't depend on file system

describe('zip path format', () => {
    test('zip path includes dist directory', () => {
        const DIST = 'dist'
        const name = 'test-plugin'
        const zipPath = `${DIST}/${name}.zip`

        expect(zipPath).toBe('dist/test-plugin.zip')
        expect(zipPath).toStartWith('dist/')
        expect(zipPath).toEndWith('.zip')
    })

    test('zip path handles package names with hyphens', () => {
        const DIST = 'dist'
        const name = 'obsidian-life-tracker-base-view-plugin'
        const zipPath = `${DIST}/${name}.zip`

        expect(zipPath).toBe('dist/obsidian-life-tracker-base-view-plugin.zip')
    })
})

describe('file filtering logic', () => {
    test('filters out zip files', () => {
        const files = ['main.js', 'manifest.json', 'styles.css', 'old.zip', 'another.zip']
        const filtered = files.filter((f) => !f.endsWith('.zip'))

        expect(filtered).toEqual(['main.js', 'manifest.json', 'styles.css'])
        expect(filtered).not.toContain('old.zip')
        expect(filtered).not.toContain('another.zip')
    })

    test('keeps all non-zip files', () => {
        const files = ['main.js', 'manifest.json', 'styles.css', 'image.png', 'data.json']
        const filtered = files.filter((f) => !f.endsWith('.zip'))

        expect(filtered).toEqual(files)
        expect(filtered.length).toBe(5)
    })

    test('handles empty array', () => {
        const files: string[] = []
        const filtered = files.filter((f) => !f.endsWith('.zip'))

        expect(filtered).toEqual([])
        expect(filtered.length).toBe(0)
    })
})

describe('package name validation', () => {
    test('expected package name format', () => {
        const expectedName = 'obsidian-life-tracker-base-view-plugin'

        expect(expectedName).toMatch(/^[a-z0-9-]+$/)
        expect(expectedName).toContain('obsidian')
        expect(expectedName).toContain('plugin')
    })
})
