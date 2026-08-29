import { describe, expect, test } from 'bun:test'
import { regressions } from './rules-baseline'

type Floor = {
    rules: Record<string, number>
    maxWarnings: number
    compilerOptions: Record<string, boolean>
    types: string[]
}

const floor: Floor = {
    rules: { 'obsidianmd/no-tfile-tfolder-cast': 2, 'no-console': 1 },
    maxWarnings: 0,
    compilerOptions: { strict: true, noUncheckedIndexedAccess: true, skipLibCheck: false },
    types: ['bun', 'node']
}

/** The baseline shape with only the named fields changed. */
const drift = (patch: Partial<Floor>): Floor => ({ ...floor, ...patch })

describe('rule floor', () => {
    test('an unchanged config has no regressions', () => {
        expect(regressions(floor, floor)).toEqual([])
    })

    test('catches a rule switched off, which is the whole point', () => {
        const now = drift({ rules: { ...floor.rules, 'obsidianmd/no-tfile-tfolder-cast': 0 } })
        expect(regressions(floor, now)).toEqual(['obsidianmd/no-tfile-tfolder-cast: error -> off'])
    })

    test('catches error downgraded to warn — quieter, not fixed', () => {
        const now = drift({ rules: { ...floor.rules, 'obsidianmd/no-tfile-tfolder-cast': 1 } })
        expect(regressions(floor, now)).toEqual(['obsidianmd/no-tfile-tfolder-cast: error -> warn'])
    })

    test('a rule that vanishes from the config counts as off, not as absent', () => {
        // A preset swap drops the plugin entirely: the rule is not reported as
        // relaxed anywhere, it simply stops existing.
        const now = drift({ rules: { 'no-console': 1 } })
        expect(regressions(floor, now)).toEqual(['obsidianmd/no-tfile-tfolder-cast: error -> off'])
    })

    test('a rule raised or newly added is not a regression', () => {
        const now = drift({ rules: { ...floor.rules, 'no-console': 2, 'new-rule': 2 } })
        expect(regressions(floor, now)).toEqual([])
    })

    test('catches a raised --max-warnings, including the missing-flag case', () => {
        expect(regressions(floor, drift({ maxWarnings: 5 }))).toEqual(['--max-warnings: 0 -> 5'])
        expect(regressions(floor, drift({ maxWarnings: Number.POSITIVE_INFINITY }))).toHaveLength(1)
    })

    test('catches a strictness switch turned off', () => {
        const now = drift({ compilerOptions: { ...floor.compilerOptions, strict: false } })
        expect(regressions(floor, now)).toEqual(['compilerOptions.strict: true -> false'])
    })

    test('a flag the baseline never required stays free to change', () => {
        // `skipLibCheck: false` in the floor is a record, not a requirement —
        // only `true` is guarded, so this must not fire.
        const now = drift({ compilerOptions: { ...floor.compilerOptions, skipLibCheck: true } })
        expect(regressions(floor, now)).toEqual([])
    })

    test('catches an unpinned types array — the shape that once hid ~80 warnings', () => {
        expect(regressions(floor, drift({ types: [] }))).toEqual([
            'compilerOptions.types no longer pins "bun"',
            'compilerOptions.types no longer pins "node"'
        ])
    })

    test('reports every regression at once, not just the first', () => {
        const now = drift({
            rules: { 'no-console': 0 },
            maxWarnings: 3,
            compilerOptions: { ...floor.compilerOptions, noUncheckedIndexedAccess: false }
        })
        expect(regressions(floor, now)).toHaveLength(4)
    })
})
