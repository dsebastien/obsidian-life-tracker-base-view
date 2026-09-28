import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import obsidianmd from 'eslint-plugin-obsidianmd'
import { defineConfig } from 'eslint/config'

// eslint-plugin-obsidianmd 0.4.x lowered these rules from error to warn in its
// recommended preset. --max-warnings 0 would still fail on them, but the rule
// floor (rules-baseline.json) guards the RESOLVED severity, and a warn is one
// config edit away from being ignored. Keep them at error, with the preset's
// own options, so upgrading the plugin never weakens the floor.
const PRESET_WARNINGS_KEPT_AT_ERROR = [
    'no-undef',
    'no-implicit-globals',
    'no-restricted-globals',
    '@typescript-eslint/no-unused-expressions',
    // Carries moment, the one restricted import the core rule cannot hold
    // (it needs allowTypeImports); at warn, a value import of moment would
    // sit below the floor.
    '@typescript-eslint/no-restricted-imports',
    '@microsoft/sdl/no-document-write',
    '@microsoft/sdl/no-inner-html',
    'import/no-extraneous-dependencies',
    'obsidianmd/commands/no-command-in-command-id',
    'obsidianmd/commands/no-command-in-command-name',
    'obsidianmd/commands/no-default-hotkeys',
    'obsidianmd/commands/no-plugin-id-in-command-id',
    'obsidianmd/commands/no-plugin-name-in-command-name',
    'obsidianmd/vault/iterate',
    'obsidianmd/hardcoded-config-path',
    'obsidianmd/no-tfile-tfolder-cast',
    'obsidianmd/object-assign',
    'obsidianmd/prefer-abstract-input-suggest',
    'obsidianmd/validate-manifest',
    'obsidianmd/validate-license'
] as const

/** The obsidianmd preset's own entry for a rule, or undefined. */
const presetEntry = (rule: string): unknown => {
    let entry: unknown
    for (const config of obsidianmd.configs['recommended']) {
        const value = (config as { rules?: Record<string, unknown> }).rules?.[rule]
        if (value !== undefined) {
            entry = value
        }
    }
    return entry
}

/** Severity names, which are never meaningful as a rule's options. */
const SEVERITY_NAMES: readonly unknown[] = ['off', 'warn', 'error']

/**
 * The preset's rules raised to error with their options intact. A rule the
 * preset stops configuring is skipped rather than thrown on: this config also
 * loads in the community catalog reviewer's environment, where a throw fails
 * the whole review. rules:check reports the vanished rule instead.
 *
 * Severity strings are dropped from the options: the 0.4.x preset lists a
 * stray 'warn' among no-restricted-globals' entries, which copied as-is
 * restricts a global named `warn`.
 */
const keptAtError = Object.fromEntries(
    PRESET_WARNINGS_KEPT_AT_ERROR.flatMap((rule): [string, unknown][] => {
        const entry = presetEntry(rule)
        if (entry === undefined) {
            return []
        }
        if (!Array.isArray(entry)) {
            return [[rule, 'error']]
        }
        const options = (entry.slice(1) as unknown[]).filter(
            (option) => !SEVERITY_NAMES.includes(option)
        )
        return [[rule, ['error', ...options]]]
    })
)

/**
 * The preset's restricted-import list for the core rule. Entries that rely
 * on allowTypeImports (moment) stay with the @typescript-eslint variant only:
 * the core rule has no such option, so it would report the type-only import
 * the message itself recommends.
 */
const coreRestrictedImports = (): unknown[] => {
    const entry = presetEntry('@typescript-eslint/no-restricted-imports')
    const paths: unknown[] = Array.isArray(entry) ? (entry.slice(1) as unknown[]) : []
    return paths.filter(
        (path) => !(typeof path === 'object' && path !== null && 'allowTypeImports' in path)
    )
}

export default defineConfig([
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...obsidianmd.configs['recommended'],
    eslintConfigPrettier,
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'scripts/**',
            '.cz-config.cjs',
            'prettier.config.cjs',
            'package.json'
        ]
    },
    {
        files: ['**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser,
                // Tests and build tooling run under the Bun runtime
                Bun: 'readonly',
                // Obsidian global functions
                createDiv: 'readonly',
                createEl: 'readonly',
                createSpan: 'readonly',
                createFragment: 'readonly',
                // Obsidian popout-window-aware globals
                activeWindow: 'readonly',
                activeDocument: 'readonly'
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'error',
            // The community-plugin reviewer treats both the rule violation
            // and any `eslint-disable @typescript-eslint/no-explicit-any` as
            // an ERROR that blocks the scorecard. Catch locally as error,
            // not warn. See AGENTS.md "Community catalog review".
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            // Nothing is switched off here: fix the finding, or scope a
            // reasoned exemption to the one file that needs it and let the
            // rule floor (rules-baseline.json) show it in review.
            '@typescript-eslint/ban-ts-comment': 'error',
            // Also reports Obsidian API deprecations. A replacement API may be
            // newer than minAppVersion: check before swapping, and raise the
            // floor (versions.json records it) only if the plugin needs it.
            '@typescript-eslint/no-deprecated': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-enum-comparison': 'error',
            // The preset switches both off; the core variant stays off only
            // because @typescript-eslint/require-await replaces it.
            '@typescript-eslint/require-await': 'error',
            'prefer-const': 'error',
            'no-prototype-builtins': 'error',
            'no-alert': 'error',
            ...keptAtError,
            // keptAtError copies the preset's options, and 0.4.x allows short
            // circuits and ternaries as statements. Before the upgrade both
            // were errors; keep them errors.
            '@typescript-eslint/no-unused-expressions': [
                'error',
                { allowShortCircuit: false, allowTernary: false, allowTaggedTemplates: false }
            ],
            // 0.4.x switched these three off in favour of replacements, which
            // stay on: no-console -> obsidianmd/rule-custom-message,
            // no-restricted-imports -> @typescript-eslint/no-restricted-imports,
            // import/no-nodejs-modules -> obsidianmd/no-nodejs-modules. The
            // originals stay on too, so the floor never records an `off`.
            'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
            'no-restricted-imports': ['error', ...coreRestrictedImports()],
            // Mobile safety, so it follows the preset's own reading of the
            // manifest: a desktop-only plugin (isDesktopOnly) may import Node
            // modules, and the preset turns obsidianmd/no-nodejs-modules off
            // for it. Every other plugin gets the core rule at error.
            'import/no-nodejs-modules':
                presetEntry('obsidianmd/no-nodejs-modules') === 'off' ? 'off' : 'error',
            // The preset ships these two off; nothing here gets switched off.
            'no-new-func': 'error',
            'obsidianmd/prefer-active-doc': 'error',
            // Never disable obsidianmd/* rules here: the community catalog
            // reviewer runs its own ruleset against the git archive, so a
            // local disable only hides the finding until submission.
            // Brand names are the supported escape hatch for sentence-case.
            // Sentence case is a community-review requirement, so the rule is an
            // ERROR here rather than off. The catalog reviewer runs its OWN
            // ruleset against the source archive, so switching it off locally
            // suppresses nothing on their side — it only hides the finding until
            // submission. It compares every UI string against a word list, so the
            // vocabulary this plugin's copy uses has to be declared or correct
            // text gets reported:
            //
            // - `brands` REPLACES the plugin's default list (`?? DEFAULT_BRANDS`),
            //   so this array must carry every brand this codebase names. A new
            //   brand in a UI string is reported until it is added here — loud,
            //   which is the point.
            // - `ignoreRegex` matches whole strings — anchor each entry to the
            //   exact literal it exempts, never a broad pattern.
            'obsidianmd/ui/sentence-case': [
                'error',
                {
                    enforceCamelCaseLower: true,
                    brands: [
                        // Defaults this codebase relies on
                        'Obsidian',
                        'Obsidian Sync',
                        'Obsidian Publish',
                        'iOS',
                        'macOS',
                        'Windows',
                        'Linux',
                        'Android',
                        'GitHub',
                        'GitHub Sponsors',
                        'Git',
                        'YouTube',
                        'Markdown',
                        'JavaScript',
                        'TypeScript',
                        'Node.js',
                        // The follow CTA links to x.com
                        'X',
                        // Obsidian's feature name for `.base` files and the
                        // views they host — no UI copy uses it lowercase, so
                        // the both-ways enforcement is safe.
                        'Base',
                        'Bases',
                        // This plugin's own name, spelled exactly as the
                        // manifest does — used across settings and notices.
                        'Life Tracker',
                        // The companion plugin this one imports properties
                        // from, plus the short form its settings copy uses.
                        'Obsidian Starter Kit',
                        'Starter Kit',
                        // Community this plugin's support CTAs link to
                        'Knowii'
                    ],
                    ignoreRegex: [
                        // Dropdown placeholder fragment, not a sentence
                        '^— Select$',
                        // Date-format token must stay uppercase
                        "^No note for today found\\. Expected a note named after today's date \\(YYYY-MM-DD\\), or matching one of your filename date patterns\\.$",
                        // ISO and Monday are correct as written
                        '^Starting day for week grouping and heatmap columns\\. ISO week labels stay Monday-based\\.$',
                        // Input placeholder fragment; the rule misreads the example
                        '^Value or range \\(e\\.g\\. 3 or 1-2\\)$',
                        // OR names the boolean operator
                        '^Define which notes this property applies to\\. If no filters are set, property applies to all notes\\. Multiple filters use OR logic\\.$',
                        // Placeholder examples — lowercase is deliberate
                        '^value1, value2, value3$',
                        '^value1, value2 \\(comma-separated\\)$',
                        // "Use default" quotes a button label verbatim
                        '^Click "Use default" in capture dialog to apply this value and advance$',
                        // "Refresh" references the setting rendered just below
                        '^Import properties to track them here without redefining them\\. Starter Kit keeps ownership of their structure — name, type, constraints and which notes they apply to — refreshed when Obsidian starts, or with Refresh below\\. Value direction, emojis and value mappings stay with Life Tracker and are never overwritten\\.$',
                        // Author credit — proper noun + handle
                        '^Sébastien Dubois \\(@dSebastien\\)$'
                    ]
                }
            ]
        }
    }
])
