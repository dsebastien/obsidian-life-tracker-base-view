import { describe, expect, test } from 'bun:test'
import type { App, TFile } from 'obsidian'
import type { PropertyDefinition } from '../types'
import { FrontmatterService } from './frontmatter.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal TFile mock (FrontmatterService.validate() doesn't touch the
 * file object directly — only processFrontMatter does via the app mock).
 */
function makeFile(): TFile {
    // @ts-expect-error -- TFile is a class; we build a structural stand-in for tests
    return {}
}

/**
 * Build a minimal App mock that captures the frontmatter mutator from write().
 * `metadataCache.getFileCache` returns the provided frontmatter map so that
 * `read()` works without a real vault.
 */
function makeApp(initialFrontmatter: Record<string, unknown> = {}): {
    app: App
    getFrontmatter: () => Record<string, unknown>
} {
    // We keep the frontmatter in a mutable object so the processFrontMatter
    // callback can mutate it and we can inspect the result.
    const fm: Record<string, unknown> = { ...initialFrontmatter }

    const app = {
        metadataCache: {
            getFileCache: () => ({ frontmatter: fm })
        },
        fileManager: {
            processFrontMatter: (
                _file: TFile,
                callback: (fm: Record<string, unknown>) => void
            ): Promise<void> => {
                callback(fm)
                return Promise.resolve()
            }
        }
    } as unknown as App

    return { app, getFrontmatter: () => fm }
}

/**
 * Build a PropertyDefinition for the given type with sensible defaults.
 */
function makeDef(
    type: PropertyDefinition['type'],
    overrides: Partial<PropertyDefinition> = {}
): PropertyDefinition {
    return {
        id: 'def-1',
        name: 'test_prop',
        displayName: 'Test Prop',
        type,
        allowedValues: [],
        numberRange: null,
        defaultValue: null,
        required: false,
        description: '',
        order: 0,
        mappings: [],
        valueMapping: null,
        ...overrides
    }
}

// ─── validate() ───────────────────────────────────────────────────────────────

describe('FrontmatterService.validate()', () => {
    const { app } = makeApp()
    const service = new FrontmatterService(app)

    // required check
    describe('required field', () => {
        test('required field with empty string is invalid', () => {
            const def = makeDef('text', { required: true })
            expect(service.validate('', def).valid).toBe(false)
        })

        test('required field with null is invalid', () => {
            const def = makeDef('text', { required: true })
            expect(service.validate(null, def).valid).toBe(false)
        })

        test('required field with non-empty value is valid', () => {
            const def = makeDef('text', { required: true })
            expect(service.validate('hello', def).valid).toBe(true)
        })
    })

    // optional empty values — always valid
    describe('optional empty values', () => {
        test('null value for optional field is valid (not required)', () => {
            const def = makeDef('number')
            expect(service.validate(null, def).valid).toBe(true)
        })

        test('empty string for optional field is valid', () => {
            const def = makeDef('text')
            expect(service.validate('', def).valid).toBe(true)
        })
    })

    // text type
    describe('type: text', () => {
        test('any string is valid when allowedValues is empty', () => {
            const def = makeDef('text')
            expect(service.validate('hello', def).valid).toBe(true)
        })

        test('value in allowedValues is valid', () => {
            const def = makeDef('text', { allowedValues: ['low', 'medium', 'high'] })
            expect(service.validate('medium', def).valid).toBe(true)
        })

        test('value NOT in allowedValues is invalid', () => {
            const def = makeDef('text', { allowedValues: ['low', 'medium', 'high'] })
            const result = service.validate('unknown', def)
            expect(result.valid).toBe(false)
            expect(result.error).toMatch(/low, medium, high/)
        })

        test('allowedValues check is case-insensitive', () => {
            const def = makeDef('text', { allowedValues: ['Active'] })
            expect(service.validate('active', def).valid).toBe(true)
        })
    })

    // number type
    describe('type: number', () => {
        test('valid number passes', () => {
            const def = makeDef('number')
            expect(service.validate(7, def).valid).toBe(true)
        })

        test('non-numeric string fails', () => {
            const def = makeDef('number')
            expect(service.validate('not-a-number', def).valid).toBe(false)
        })

        test('numeric string is accepted', () => {
            const def = makeDef('number')
            expect(service.validate('3.14', def).valid).toBe(true)
        })

        test('value below numberRange.min is invalid', () => {
            const def = makeDef('number', { numberRange: { min: 1, max: 10 } })
            const result = service.validate(0, def)
            expect(result.valid).toBe(false)
            expect(result.error).toMatch(/at least 1/)
        })

        test('value above numberRange.max is invalid', () => {
            const def = makeDef('number', { numberRange: { min: 1, max: 10 } })
            const result = service.validate(11, def)
            expect(result.valid).toBe(false)
            expect(result.error).toMatch(/at most 10/)
        })

        test('value at boundary is valid', () => {
            const def = makeDef('number', { numberRange: { min: 1, max: 10 } })
            expect(service.validate(1, def).valid).toBe(true)
            expect(service.validate(10, def).valid).toBe(true)
        })
    })

    // checkbox type
    describe('type: checkbox', () => {
        test('boolean true is valid', () => {
            expect(service.validate(true, makeDef('checkbox')).valid).toBe(true)
        })

        test('boolean false is valid', () => {
            expect(service.validate(false, makeDef('checkbox')).valid).toBe(true)
        })

        test('"true" and "false" strings are valid', () => {
            expect(service.validate('true', makeDef('checkbox')).valid).toBe(true)
            expect(service.validate('false', makeDef('checkbox')).valid).toBe(true)
        })

        test('arbitrary string is invalid', () => {
            expect(service.validate('maybe', makeDef('checkbox')).valid).toBe(false)
        })
    })

    // date type
    describe('type: date', () => {
        test('YYYY-MM-DD format is valid', () => {
            expect(service.validate('2024-03-15', makeDef('date')).valid).toBe(true)
        })

        test('other date formats are invalid', () => {
            expect(service.validate('03/15/2024', makeDef('date')).valid).toBe(false)
            expect(service.validate('2024-13-01', makeDef('date')).valid).toBe(false)
        })

        test('non-date string is invalid', () => {
            expect(service.validate('not-a-date', makeDef('date')).valid).toBe(false)
        })
    })

    // datetime type
    describe('type: datetime', () => {
        test('ISO datetime string is valid', () => {
            expect(service.validate('2024-03-15T10:30:00', makeDef('datetime')).valid).toBe(true)
        })

        test('invalid datetime is invalid', () => {
            expect(service.validate('not-a-datetime', makeDef('datetime')).valid).toBe(false)
        })
    })

    // list type
    describe('type: list', () => {
        test('array of strings is valid when no allowedValues', () => {
            expect(service.validate(['a', 'b'], makeDef('list')).valid).toBe(true)
        })

        test('comma-separated string is parsed as list', () => {
            expect(service.validate('a, b, c', makeDef('list')).valid).toBe(true)
        })

        test('item not in allowedValues makes the whole list invalid', () => {
            const def = makeDef('list', { allowedValues: ['red', 'green', 'blue'] })
            const result = service.validate(['red', 'purple'], def)
            expect(result.valid).toBe(false)
        })

        test('all items in allowedValues is valid', () => {
            const def = makeDef('list', { allowedValues: ['red', 'green', 'blue'] })
            expect(service.validate(['red', 'blue'], def).valid).toBe(true)
        })
    })
})

// ─── write() ─────────────────────────────────────────────────────────────────

describe('FrontmatterService.write()', () => {
    test('writes values to frontmatter', async () => {
        const { app, getFrontmatter } = makeApp({ existing: 'keep' })
        const service = new FrontmatterService(app)

        await service.write(makeFile(), { energy: 8 })

        expect(getFrontmatter()['energy']).toBe(8)
        expect(getFrontmatter()['existing']).toBe('keep')
    })

    test('EMPTY STRING deletes the key from frontmatter (silent data-loss surface)', async () => {
        const { app, getFrontmatter } = makeApp({ energy: 5 })
        const service = new FrontmatterService(app)

        await service.write(makeFile(), { energy: '' })

        expect(Object.prototype.hasOwnProperty.call(getFrontmatter(), 'energy')).toBe(false)
    })

    test('NULL deletes the key from frontmatter', async () => {
        const { app, getFrontmatter } = makeApp({ energy: 5 })
        const service = new FrontmatterService(app)

        await service.write(makeFile(), { energy: null })

        expect(Object.prototype.hasOwnProperty.call(getFrontmatter(), 'energy')).toBe(false)
    })

    test('UNDEFINED deletes the key from frontmatter', async () => {
        const { app, getFrontmatter } = makeApp({ energy: 5 })
        const service = new FrontmatterService(app)

        await service.write(makeFile(), { energy: undefined })

        expect(Object.prototype.hasOwnProperty.call(getFrontmatter(), 'energy')).toBe(false)
    })

    test('writing a non-empty value after a delete restores the key', async () => {
        const { app, getFrontmatter } = makeApp({ energy: 5 })
        const service = new FrontmatterService(app)

        await service.write(makeFile(), { energy: null })
        await service.write(makeFile(), { energy: 7 })

        expect(getFrontmatter()['energy']).toBe(7)
    })
})

// ─── read() and readDefinedProperties() ──────────────────────────────────────

describe('FrontmatterService.read()', () => {
    test('returns frontmatter from metadata cache', () => {
        const { app } = makeApp({ title: 'Hello' })
        const service = new FrontmatterService(app)
        const result = service.read(makeFile())
        expect(result['title']).toBe('Hello')
    })

    test('returns empty object when cache has no frontmatter', () => {
        const appNullCache = {
            metadataCache: { getFileCache: () => null }
        } as unknown as App
        const service = new FrontmatterService(appNullCache)
        expect(service.read(makeFile())).toEqual({})
    })
})

describe('FrontmatterService.getIssues()', () => {
    const { app } = makeApp()
    const service = new FrontmatterService(app)

    test('returns missing issue for required property not in frontmatter', () => {
        const def = makeDef('text', { name: 'energy', displayName: 'Energy', required: true })
        const issues = service.getIssues({}, [def])
        expect(issues).toHaveLength(1)
        expect(issues[0]!.type).toBe('missing')
    })

    test('returns invalid issue for out-of-range number', () => {
        const def = makeDef('number', {
            name: 'energy',
            displayName: 'Energy',
            numberRange: { min: 1, max: 5 }
        })
        const issues = service.getIssues({ energy: 10 }, [def])
        expect(issues).toHaveLength(1)
        expect(issues[0]!.type).toBe('invalid')
    })

    test('returns no issues for valid frontmatter', () => {
        const def = makeDef('number', {
            name: 'energy',
            displayName: 'Energy',
            numberRange: { min: 1, max: 10 }
        })
        const issues = service.getIssues({ energy: 7 }, [def])
        expect(issues).toHaveLength(0)
    })

    test('hasIssues returns true when there are issues', () => {
        const def = makeDef('text', { name: 'energy', required: true })
        expect(service.hasIssues({}, [def])).toBe(true)
    })

    test('hasIssues returns false when frontmatter is valid', () => {
        const def = makeDef('text', { name: 'energy', required: true })
        expect(service.hasIssues({ energy: 'good' }, [def])).toBe(false)
    })
})

describe('FrontmatterService.update (review #2: lost increments)', () => {
    /**
     * A vault where the metadata cache lags (always the old snapshot) and
     * processFrontMatter is atomic per file, like Obsidian's vault.process.
     */
    function laggingApp(initial: Record<string, unknown>): {
        app: App
        disk: Record<string, unknown>
    } {
        const disk: Record<string, unknown> = { ...initial }
        const staleCache = { ...initial }
        let queue = Promise.resolve()
        const app = {
            metadataCache: { getFileCache: () => ({ frontmatter: staleCache }) },
            fileManager: {
                processFrontMatter: (
                    _file: TFile,
                    callback: (fm: Record<string, unknown>) => void
                ): Promise<void> => {
                    const run = queue.then(() => callback(disk))
                    queue = run.catch(() => undefined)
                    return run
                }
            }
        }
        return { app: app as never, disk }
    }

    const increment = (current: unknown): { ok: true; value: unknown } => ({
        ok: true,
        value: (typeof current === 'number' ? current : 0) + 1
    })

    test('two concurrent increments both count, whatever the cache says', async () => {
        const { app, disk } = laggingApp({ push_ups: 0 })
        const service = new FrontmatterService(app)

        await Promise.all([
            service.update(makeFile(), 'push_ups', increment),
            service.update(makeFile(), 'push_ups', increment)
        ])

        expect(disk['push_ups']).toBe(2)
    })

    test('two concurrent appends keep both sets', async () => {
        const { app, disk } = laggingApp({ leg_press: ['10@50'] })
        const service = new FrontmatterService(app)
        const append =
            (entry: string) =>
            (current: unknown): { ok: true; value: unknown } => ({
                ok: true,
                value: [...(Array.isArray(current) ? (current as unknown[]) : []), entry]
            })

        await Promise.all([
            service.update(makeFile(), 'leg_press', append('12@60')),
            service.update(makeFile(), 'leg_press', append('12@65'))
        ])

        expect(disk['leg_press']).toEqual(['10@50', '12@60', '12@65'])
    })

    test('a refused update leaves the note untouched and reports why', async () => {
        const { app, disk } = laggingApp({ push_ups: 3 })
        const result = await new FrontmatterService(app).update(makeFile(), 'push_ups', () => ({
            ok: false,
            error: 'too many'
        }))
        expect(result).toEqual({ ok: false, error: 'too many' })
        expect(disk).toEqual({ push_ups: 3 })
    })

    test('an empty value removes the property', async () => {
        const { app, disk } = laggingApp({ note: 'x' })
        await new FrontmatterService(app).update(makeFile(), 'note', () => ({
            ok: true,
            value: ''
        }))
        expect('note' in disk).toBe(false)
    })
})
