import { mock } from 'bun:test'

/**
 * Test preload (registered via bunfig.toml `[test] preload`).
 *
 * The `obsidian` package ships type declarations only — it has no runtime entry
 * point — so any module under test that imports a *value* from it (rather than a
 * type) fails to load with "Cannot find package 'obsidian'". ESM hoists imports
 * above any in-file `mock.module(...)` call, so the mock must be registered in a
 * preload that runs before the test modules are imported.
 *
 * Only runtime values actually used by tested code need stubs. Today that is
 * `parseFrontMatterTags` (PropertyRecognitionService); add more as needed.
 */
void mock.module('obsidian', () => ({
    /**
     * Minimal stand-in for Obsidian's `parseFrontMatterTags`: reads the `tags`
     * (or `tag`) frontmatter field and returns `#`-prefixed tag strings, or null
     * when there are none.
     */
    parseFrontMatterTags(frontmatter: Record<string, unknown> | null | undefined): string[] | null {
        if (!frontmatter) return null
        const raw = frontmatter['tags'] ?? frontmatter['tag']
        if (raw == null) return null
        const list: unknown[] = Array.isArray(raw)
            ? raw
            : typeof raw === 'string'
              ? raw.split(/[\s,]+/)
              : []
        const tags = list
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0)
            .map((value) => (value.startsWith('#') ? value : `#${value}`))
        return tags.length > 0 ? tags : null
    }
}))
