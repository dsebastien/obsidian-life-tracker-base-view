import type { ConfigGetter } from '../types'

/**
 * Typed, runtime-narrowing accessors for Bases view configuration.
 *
 * `ConfigGetter` returns `unknown`, so a bare `config.get(key) as T` cast is
 * unsafe: a value stored with the wrong runtime type (e.g. the string `"true"`
 * for a boolean flag) would satisfy the cast and silently bypass the `?? fallback`.
 * These helpers check the runtime type and return `undefined` on mismatch, so
 * callers keep their `?? fallback` and always get a value of the declared type.
 */

/** Read a boolean view-config value, or `undefined` if it is not a real boolean. */
export function getBoolConfig(get: ConfigGetter, key: string): boolean | undefined {
    const value = get(key)
    return typeof value === 'boolean' ? value : undefined
}

/** Read a finite number view-config value, or `undefined` otherwise. */
export function getNumberConfig(get: ConfigGetter, key: string): number | undefined {
    const value = get(key)
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Read a string view-config value, or `undefined` otherwise. */
export function getStringConfig(get: ConfigGetter, key: string): string | undefined {
    const value = get(key)
    return typeof value === 'string' ? value : undefined
}

/**
 * Read a string view-config value constrained to an allowed set, or `undefined`
 * if the stored value is missing or not one of the allowed members.
 */
export function getEnumConfig<T extends string>(
    get: ConfigGetter,
    key: string,
    allowed: readonly T[]
): T | undefined {
    const value = get(key)
    return typeof value === 'string' && (allowed as readonly string[]).includes(value)
        ? (value as T)
        : undefined
}
