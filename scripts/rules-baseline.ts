/**
 * The rule floor, as a committed artefact.
 *
 * Grep cannot tell whether a config change weakened anything: a rule can be
 * relaxed by a preset swap, by an `overrides` block three levels down, or by
 * a file-scoped exemption that never mentions the rule's severity. What CAN
 * tell is the RESOLVED config — what ESLint and TypeScript actually decide for
 * each file — so that is what gets snapshotted and compared.
 *
 * Severity is taken as the MINIMUM across every source file. A file-scoped
 * `off` therefore shows up as a weakening, which is the point: exemptions are
 * allowed, but they land in a baseline diff a human reads, instead of
 * disappearing into a config file nobody re-reads.
 *
 *   bun run rules:check      compare against the baseline (CI + pre-commit)
 *   bun run rules:baseline   accept the current config as the new floor
 */
import { Glob, file, $ } from 'bun'
import { ESLint } from 'eslint'

const BASELINE = 'rules-baseline.json'

/** `off` | `warn` | `error` and their numeric forms collapse to 0 | 1 | 2. */
const SEVERITIES: Record<string, number> = { off: 0, warn: 1, error: 2 }

const severityOf = (entry: unknown): number => {
    const value = Array.isArray(entry) ? entry[0] : entry
    if (typeof value === 'number') {
        return value
    }
    if (typeof value === 'string' && value in SEVERITIES) {
        return SEVERITIES[value] ?? 0
    }
    return 0
}

/** The strictness switches worth guarding. Anything true must stay true. */
const TS_FLAGS = [
    'strict',
    'noImplicitAny',
    'strictNullChecks',
    'noUncheckedIndexedAccess',
    'noImplicitOverride',
    'noImplicitReturns',
    'noFallthroughCasesInSwitch',
    'noUnusedLocals',
    'noUnusedParameters',
    'exactOptionalPropertyTypes',
    'isolatedModules',
    'skipLibCheck'
] as const

type Baseline = {
    /** Lowest severity each rule resolves to, across all source files. */
    rules: Record<string, number>
    /** `--max-warnings` from the lint script. Must never rise. */
    maxWarnings: number
    /** TypeScript strictness switches. A `true` may not become false. */
    compilerOptions: Record<string, boolean>
    /** `types` must stay pinned — an empty array is how ~80 warnings once hid. */
    types: string[]
}

const sourceFiles = async (): Promise<string[]> => {
    const glob = new Glob('src/**/*.ts')
    const files: string[] = []
    for await (const path of glob.scan({ cwd: process.cwd() })) {
        files.push(path)
    }
    return files.sort()
}

const currentRules = async (files: string[]): Promise<Record<string, number>> => {
    const eslint = new ESLint()
    const floor: Record<string, number> = {}
    for (const path of files) {
        const config = (await eslint.calculateConfigForFile(path)) as {
            rules?: Record<string, unknown>
        }
        for (const [rule, entry] of Object.entries(config.rules ?? {})) {
            const severity = severityOf(entry)
            const seen = floor[rule]
            floor[rule] = seen === undefined ? severity : Math.min(seen, severity)
        }
    }
    return floor
}

const currentMaxWarnings = async (): Promise<number> => {
    const pkg = (await file('package.json').json()) as { scripts?: Record<string, string> }
    const lint = pkg.scripts?.['lint'] ?? ''
    const match = /--max-warnings[= ]+(\d+)/.exec(lint)
    // No flag at all means warnings pass silently, which is the worst case.
    return match?.[1] === undefined ? Number.POSITIVE_INFINITY : Number(match[1])
}

const currentCompilerOptions = async (): Promise<{
    compilerOptions: Record<string, boolean>
    types: string[]
}> => {
    const shown = await $`bunx tsc --showConfig`.quiet().text()
    const parsed = JSON.parse(shown) as {
        compilerOptions?: Record<string, unknown>
    }
    const options = parsed.compilerOptions ?? {}
    const compilerOptions: Record<string, boolean> = {}
    for (const flag of TS_FLAGS) {
        compilerOptions[flag] = options[flag] === true
    }
    const types = Array.isArray(options['types']) ? (options['types'] as string[]).sort() : []
    return { compilerOptions, types }
}

const collect = async (): Promise<Baseline> => {
    const files = await sourceFiles()
    if (files.length === 0) {
        throw new Error('No files matched src/**/*.ts — refusing to write an empty baseline.')
    }
    const { compilerOptions, types } = await currentCompilerOptions()
    return {
        rules: await currentRules(files),
        maxWarnings: await currentMaxWarnings(),
        compilerOptions,
        types
    }
}

/** Every way the current config is weaker than the floor. */
export const regressions = (baseline: Baseline, current: Baseline): string[] => {
    const found: string[] = []

    for (const [rule, floor] of Object.entries(baseline.rules)) {
        const now = current.rules[rule] ?? 0
        if (now < floor) {
            const names = ['off', 'warn', 'error']
            found.push(`${rule}: ${names[floor] ?? floor} -> ${names[now] ?? now}`)
        }
    }

    if (current.maxWarnings > baseline.maxWarnings) {
        found.push(`--max-warnings: ${baseline.maxWarnings} -> ${current.maxWarnings}`)
    }

    for (const [flag, required] of Object.entries(baseline.compilerOptions)) {
        if (required && current.compilerOptions[flag] !== true) {
            found.push(`compilerOptions.${flag}: true -> false`)
        }
    }

    for (const type of baseline.types) {
        if (!current.types.includes(type)) {
            found.push(`compilerOptions.types no longer pins "${type}"`)
        }
    }

    return found
}

if (import.meta.main) {
    const write = process.argv.includes('--write')
    const current = await collect()

    if (write) {
        await Bun.write(BASELINE, `${JSON.stringify(current, null, 4)}\n`)
        console.log(
            `Baseline written: ${Object.keys(current.rules).length} rules, ` +
                `--max-warnings ${current.maxWarnings}.`
        )
        process.exit(0)
    }

    if (!(await file(BASELINE).exists())) {
        console.error(`${BASELINE} is missing. Create it with: bun run rules:baseline`)
        process.exit(1)
    }

    const baseline = (await file(BASELINE).json()) as Baseline
    const found = regressions(baseline, current)

    if (found.length > 0) {
        console.error('The resolved configuration is weaker than the baseline:\n')
        for (const line of found) {
            console.error(`  - ${line}`)
        }
        console.error(
            '\nFix the finding rather than the rule. If the change is intended,' +
                '\nrun `bun run rules:baseline` in its own commit so it is reviewable.'
        )
        process.exit(1)
    }

    console.log(`Rule floor intact: ${Object.keys(baseline.rules).length} rules checked.`)
}
