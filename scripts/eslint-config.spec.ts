import { describe, expect, test } from 'bun:test'
import { ESLint } from 'eslint'

// The rule floor (rules-baseline.ts) guards severities only, so a severity
// string slipping back into a rule's copied options would pass rules:check.
// The 0.4.x preset lists a stray 'warn' among no-restricted-globals' entries;
// eslint.config.ts filters it out of what it copies.
describe('resolved eslint config', () => {
    test('no copied rule options carry a severity string', async () => {
        const config = (await new ESLint().calculateConfigForFile('src/main.ts')) as {
            rules?: Record<string, unknown>
        }
        const withSeverityOptions = Object.entries(config.rules ?? {})
            .filter(
                ([, entry]) =>
                    Array.isArray(entry) &&
                    entry.slice(1).some((option) => ['off', 'warn', 'error'].includes(option))
            )
            .map(([rule]) => rule)
        expect(withSeverityOptions).toEqual([])
    }, 60_000)
})
