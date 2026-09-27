import { mock } from 'bun:test'
import type { moment as ObsidianMoment } from 'obsidian'

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
 * `parseFrontMatterTags` (PropertyRecognitionService) and `moment`; add more as
 * needed.
 */

/**
 * Obsidian re-exports the `moment` package at runtime, and `moment` is a direct
 * dependency of the `obsidian` package, so it is present wherever the types are.
 *
 * Loaded with Bun's `import.meta.require` rather than an `import`: plugin code
 * must take moment from 'obsidian' so no build bundles a second copy, and the
 * lint rules enforcing that are deliberately left on. A test bootstrap wiring
 * module mocks is the one place that legitimately needs the module itself.
 * `require` is untyped, so the value is given the type Obsidian declares for it.
 */
const moment = import.meta.require('moment') as typeof ObsidianMoment

/**
 * Plugin code calls `window.setTimeout` and friends for popout-window
 * compatibility, and Bun's test runner has no `window`. Point it at the global
 * object, reached through `self` (Bun defines it, like browsers and workers
 * do): obsidianmd/no-global-this bans the `global` and `globalThis` names.
 */
const root = self as unknown as { window?: unknown }
root.window ??= root

void mock.module('obsidian', () => ({
    moment,

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
