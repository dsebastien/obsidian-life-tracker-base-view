// ESLint must run under Node, as the community catalog reviewer's does.
// bunfig.toml sets [run] bun = false, but when no Node is on PATH, bun run
// falls back to Bun for the node shebang. Under Bun, node:module
// isBuiltin('bun:test') is true, so obsidianmd/no-nodejs-modules misreads
// every spec's bun:test import and lint fails with findings the reviewer
// never raises. Say so plainly instead.
//
// A desktop-only plugin is exempt: the preset turns the Node-module rules
// off for it, so Bun and Node lint it the same way.
import { readFileSync } from 'node:fs'

const desktopOnly = (() => {
    try {
        return JSON.parse(readFileSync('manifest.json', 'utf8')).isDesktopOnly === true
    } catch {
        return false
    }
})()

if (process.versions.bun && !desktopOnly) {
    console.error(
        'Lint needs Node on PATH (see .nvmrc); it is running under Bun ' +
            process.versions.bun +
            '. Install Node, e.g. with mise or nvm, and run bun run lint again.'
    )
    process.exit(1)
}
