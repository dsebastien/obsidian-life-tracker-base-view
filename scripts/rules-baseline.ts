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

/**
 * The gate must still be wired in. Removing the CI step or unregistering the
 * hook is the cheapest way to make a red check disappear, so the check that
 * would have caught the regression also checks that it is still plugged in.
 *
 * This does not stop someone who edits every wiring point at once — nothing
 * running inside the repo can. It stops the single-file removal, and because
 * `rules:check` runs on `pre-commit`, the commit that unwires it is refused
 * before it exists.
 */
const wiringFaults = async (): Promise<string[]> => {
    const faults: string[] = []

    const hook = 'scripts/git-hooks/check-rule-integrity.sh'
    if (!(await file(hook).exists())) {
        faults.push(`${hook} is missing`)
    }

    const gitconfig = await file('.gitconfig')
        .text()
        .catch(() => '')
    if (!gitconfig.includes('check-rule-integrity.sh')) {
        faults.push('.gitconfig no longer registers the pre-commit hook')
    }

    const pkg = (await file('package.json').json()) as { scripts?: Record<string, string> }
    if (!(pkg.scripts?.['validate'] ?? '').includes('rules:check')) {
        faults.push('package.json: validate no longer runs rules:check')
    }

    const ci = await file('.github/workflows/ci.yml')
        .text()
        .catch(() => '')
    if (ci === '') {
        faults.push('.github/workflows/ci.yml is missing')
    } else if (!ci.includes('rules:check')) {
        faults.push('ci.yml no longer runs rules:check — the floor would be local-only')
    }

    return faults
}

/**
 * The Obsidian community catalog's automated review runs a bun older than
 * 1.4.0 and cannot parse `lockfileVersion: 2` — it reports "Unknown lockfile
 * version", ignores the lockfile, and then fails the frozen install. On the
 * review page that surfaces as TWO errors, "The bun lockfile is out of date"
 * and "Build verification dependency installation failed", plus a flood of
 * @typescript-eslint/no-unsafe-* warnings, because nothing installed so no
 * types resolved.
 *
 * bun 1.4.0 PRESERVES an existing v1 lockfile but writes v2 whenever it
 * generates one from scratch, so any repo is one `rm bun.lock` — or one
 * dependency change that forces a regeneration — away from silently shipping
 * a release the catalog cannot review. Graph Explorer Base View hit this and
 * failed two reviews before it was found.
 *
 * Regenerate with an older bun until the catalog catches up:
 *   ~/.local/share/mise/installs/bun/1.3.14/bin/bun install
 * Both 1.3.x and 1.4.x read a v1 lockfile, so v1 is strictly the safer format.
 */
const MAX_LOCKFILE_VERSION = 1

const lockfileFaults = async (): Promise<string[]> => {
    const raw = await file('bun.lock')
        .text()
        .catch(() => '')
    if (raw === '') {
        return ['bun.lock is missing']
    }
    const match = /"lockfileVersion"\s*:\s*(\d+)/.exec(raw)
    if (match?.[1] === undefined) {
        return ['bun.lock has no lockfileVersion']
    }
    const version = Number(match[1])
    if (version > MAX_LOCKFILE_VERSION) {
        return [
            `bun.lock is lockfileVersion ${version}; the catalog review cannot parse above ` +
                `${MAX_LOCKFILE_VERSION} and will fail the release`
        ]
    }
    return []
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
    const wiring = [...(await wiringFaults()), ...(await lockfileFaults())]
    const weakened = regressions(baseline, current)

    if (wiring.length > 0) {
        console.error('The gate is no longer wired in:\n')
        for (const line of wiring) {
            console.error(`  - ${line}`)
        }
        console.error(
            '\nPut it back. Unwiring the gate is not a way to get a commit through,' +
                '\nand regenerating the baseline will not silence this. If the failure is' +
                '\nthe lockfile version, regenerate bun.lock with bun 1.3.x — see the' +
                '\ncomment on MAX_LOCKFILE_VERSION in this file.'
        )
    }

    if (weakened.length > 0) {
        console.error(
            `${wiring.length > 0 ? '\n' : ''}The resolved configuration is weaker than the baseline:\n`
        )
        for (const line of weakened) {
            console.error(`  - ${line}`)
        }
        console.error(
            '\nFix the finding rather than the rule. If the loosening is intended and' +
                '\napproved, run `bun run rules:baseline` in its own commit so it is reviewable.'
        )
    }

    if (wiring.length > 0 || weakened.length > 0) {
        process.exit(1)
    }

    console.log(
        `Rule floor intact: ${Object.keys(baseline.rules).length} rules checked, gate still wired in.`
    )
}
