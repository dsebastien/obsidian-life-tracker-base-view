# Custom date formats for filename parsing (issue #139)

Status: implemented.

## Problem

`parseDateFromFilename` only recognized five hardcoded, fully-anchored formats:
`YYYY-MM-DD`, `YYYY-Www`, `YYYY-MM`, `YYYY-Qq`, `YYYY`. Any other naming
convention (`Journal 2026-07-30`, `20260730`, `30-07-2026`, `2026.07.30`,
`Daily note 2026-07-30 (Thursday)`) resolved no date, so entries fell back to
the date anchor property or file metadata — or dropped out of visualizations
entirely. Same for the "Capture today" command, which requires a `Daily`
granularity filename match.

## Solution

User-configurable filename patterns written with `{{token}}` placeholders,
compiled to anchored regexes at load time. Token syntax mirrors
`obsidian-starter-kit-plugin`'s `expression-evaluator.ts` (`{{year}}`,
`{{quarter}}`, `{{month}}`, `{{week}}`, `{{date}}`) so users of both plugins
learn one vocabulary. `obsidian-ai-editor` has no equivalent mechanism.

Tokens: `{{date}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{week}}`,
`{{quarter}}`. `*` is a wildcard for arbitrary text (`*` is not legal in
filenames, so there is no ambiguity).

Granularity is inferred from the token set, not configured:

| Tokens                           | Granularity |
| -------------------------------- | ----------- |
| `{{date}}` or year + month + day | Daily       |
| year + `{{week}}`                | Weekly      |
| year + `{{quarter}}`             | Quarterly   |
| year + month                     | Monthly     |
| year only                        | Yearly      |

## Files

- `src/utils/filename-date.utils.ts` (new) — token table, compiler, validator,
  example renderer, built-in patterns, configured-pattern registry,
  `parseDateFromFilename`, `getDateFromISOWeek`. Moved out of `date.utils.ts`
  to keep the dependency one-way (`filename-date.utils` → `date.utils`).
- `src/utils/date.utils.ts` — built-in patterns + `getDateFromISOWeek` removed.
- `src/utils/index.ts` — re-exports the new API.
- `src/app/types/plugin/plugin-settings.intf.ts` — `FilenameDatePattern`
  interface + `filenameDatePatterns` setting (default `[]`).
- `src/app/plugin.ts` — load/validate the setting, push compiled patterns into
  the registry on load and on every settings update (same shape as
  `applyWeekStart`).
- `src/app/settings/date-settings-section.ts` (new) — "Dates" settings tab:
  first day of the week (moved from Visualizations) + pattern list editor with
  per-pattern validation and live example.
- `src/app/settings/settings-tab.ts` — new tab.
- `src/app/commands/capture-command.ts` — notice text mentions custom patterns.
- `src/styles.src.css` — pattern editor classes.

## Rules

- Configured patterns are tried first, in list order; built-ins always remain
  as a fallback so existing vaults keep working with no configuration.
- Patterns match the whole basename (anchored), case-insensitively.
- Invalid patterns are rejected in the settings UI and skipped at parse time
  (logged as a warning), never thrown.
- A pattern needs `{{date}}` or `{{year}}`; `{{day}}` needs `{{month}}`;
  `{{week}}`, `{{quarter}}` and month/day tokens are mutually exclusive;
  `{{date}}` cannot be combined with other date tokens; no token twice.
- Impossible calendar dates (`2026-02-31`) do not match.

## Manual verification (cannot be self-verified by an agent)

- Settings → Life Tracker → Dates: add `Journal {{date}}`, confirm the green
  example line and that an invalid pattern shows an error and no example.
- A note named `Journal 2026-07-30` appears on today's cell in a heatmap.
- "Capture today" finds `Journal 2026-07-30` when that pattern is configured.
