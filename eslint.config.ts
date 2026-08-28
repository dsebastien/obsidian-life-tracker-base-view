import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import globals from 'globals'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // eslint-plugin-obsidianmd 0.4.x ships complete config types, so the
    // `@ts-expect-error` this line used to carry is no longer needed.
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
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-deprecated': 'off',
            // These are too strict for dynamic Chart.js API usage
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            // Obsidian methods are dynamically added to prototypes
            '@typescript-eslint/no-unsafe-enum-comparison': 'off',
            'no-prototype-builtins': 'off',
            // Allow confirm for delete confirmations
            'no-alert': 'off',
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
                        '^Sébastien Dubois \\(@dSebastien\\)$',
                        // Fleet-wide template copy, kept byte-identical
                        'Personal Knowledge Management'
                    ]
                }
            ]
        }
    },
    {
        // The declarative settings API port (getSettingDefinitions) is
        // deliberately deferred: this settings UI is a five-sub-tab app with a
        // coalescing writer and targeted change notifications that need a
        // dedicated design pass, not a mechanical transplant (fleet review
        // decision, 2026-08-28). Re-enable when that pass lands.
        files: ['src/app/settings/settings-tab.ts'],
        rules: {
            'obsidianmd/settings-tab/prefer-setting-definitions': 'off'
        }
    },
    {
        // Specs and the test bootstrap import the bun:test runner and poke
        // test-only globals; the mobile-compatibility and popout-window rules
        // read those as violations. Tests are never bundled into the plugin
        // and are not scanned by the community scorecard.
        files: ['**/*.spec.ts', 'src/test-preload.ts'],
        rules: {
            'obsidianmd/no-nodejs-modules': 'off',
            'obsidianmd/no-global-this': 'off',
            'obsidianmd/prefer-window-timers': 'off'
        }
    }
)
