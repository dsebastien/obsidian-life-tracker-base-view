import 'obsidian'

/**
 * Obsidian's plugin registry, which its public typings do not declare.
 *
 * Reading another plugin's settings requires reaching `app.plugins`. The
 * alternative — a cast at every call site — is exactly the kind of escape hatch
 * `scripts/git-hooks/check-rule-integrity.sh` refuses, so the shape is declared
 * once here instead and every consumer stays plainly typed.
 *
 * Everything is optional because none of it is contractual: a future Obsidian
 * may rename or remove it, and code that reads it must feature-detect rather
 * than assume. `unknown` values force callers to validate before use.
 */
declare module 'obsidian' {
    interface App {
        plugins?: {
            enabledPlugins?: Set<string>
            plugins?: Record<string, unknown>
        }
    }
}
