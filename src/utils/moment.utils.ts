import { moment } from 'obsidian'

/**
 * Format a date with a moment pattern, using the moment Obsidian bundles.
 *
 * Periodic Notes stores its filename formats as moment patterns, so producing
 * the path it would produce means formatting with moment rather than with
 * date-fns and a translation layer that could disagree at the edges.
 *
 * `moment.unix` rather than `moment(date)` because Obsidian's typings export
 * moment as `typeof Moment` from an `import * as Moment`, which `esModuleInterop`
 * makes a non-callable namespace: `moment(date)` does not type-check, and
 * `moment.default(date)` type-checks but is `undefined` at runtime. Calling a
 * function *on* the namespace sidesteps both. `unix` builds a local-mode moment,
 * so it formats identically to `moment(date)` — asserted in the spec.
 */
export function formatMomentPattern(date: Date, pattern: string): string {
    return moment.unix(date.getTime() / 1000).format(pattern)
}
