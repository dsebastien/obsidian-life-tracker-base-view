import { test, expect, describe } from 'bun:test'
import { getBoolConfig, getNumberConfig, getStringConfig, getEnumConfig } from './config-accessors'
import type { ConfigGetter } from '../types'

/** Build a ConfigGetter backed by a plain record. */
function makeGetter(store: Record<string, unknown>): ConfigGetter {
    return (key: string) => store[key]
}

describe('getBoolConfig', () => {
    test('returns the boolean when stored as a real boolean', () => {
        const get = makeGetter({ flag: true, off: false })
        expect(getBoolConfig(get, 'flag')).toBe(true)
        expect(getBoolConfig(get, 'off')).toBe(false)
    })

    test('returns undefined for a string "true" (does not pass the cast)', () => {
        const get = makeGetter({ flag: 'true' })
        expect(getBoolConfig(get, 'flag')).toBeUndefined()
    })

    test('returns undefined for missing keys and non-booleans', () => {
        const get = makeGetter({ n: 1 })
        expect(getBoolConfig(get, 'missing')).toBeUndefined()
        expect(getBoolConfig(get, 'n')).toBeUndefined()
    })
})

describe('getNumberConfig', () => {
    test('returns finite numbers including zero', () => {
        const get = makeGetter({ a: 0, b: 42, c: -1.5 })
        expect(getNumberConfig(get, 'a')).toBe(0)
        expect(getNumberConfig(get, 'b')).toBe(42)
        expect(getNumberConfig(get, 'c')).toBe(-1.5)
    })

    test('rejects non-finite numbers and numeric strings', () => {
        const get = makeGetter({ nan: NaN, inf: Infinity, str: '5' })
        expect(getNumberConfig(get, 'nan')).toBeUndefined()
        expect(getNumberConfig(get, 'inf')).toBeUndefined()
        expect(getNumberConfig(get, 'str')).toBeUndefined()
    })
})

describe('getStringConfig', () => {
    test('returns strings including empty string', () => {
        const get = makeGetter({ s: 'hello', empty: '' })
        expect(getStringConfig(get, 's')).toBe('hello')
        expect(getStringConfig(get, 'empty')).toBe('')
    })

    test('returns undefined for non-strings', () => {
        const get = makeGetter({ n: 1, b: true })
        expect(getStringConfig(get, 'n')).toBeUndefined()
        expect(getStringConfig(get, 'b')).toBeUndefined()
    })
})

describe('getEnumConfig', () => {
    const allowed = ['required', 'all', 'never'] as const

    test('returns the value when it is an allowed member', () => {
        const get = makeGetter({ mode: 'all' })
        expect(getEnumConfig(get, 'mode', allowed)).toBe('all')
    })

    test('returns undefined for a string outside the allowed set', () => {
        const get = makeGetter({ mode: 'sometimes' })
        expect(getEnumConfig(get, 'mode', allowed)).toBeUndefined()
    })

    test('returns undefined for missing keys and non-strings', () => {
        const get = makeGetter({ mode: 1 })
        expect(getEnumConfig(get, 'missing', allowed)).toBeUndefined()
        expect(getEnumConfig(get, 'mode', allowed)).toBeUndefined()
    })
})
