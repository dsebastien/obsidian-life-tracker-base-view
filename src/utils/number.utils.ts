/**
 * Reduce-based min/max for numeric arrays.
 *
 * `Math.min(...arr)` / `Math.max(...arr)` spread the whole array onto the call
 * stack and overflow ("Maximum call stack size exceeded") on very large inputs
 * (tens of thousands of elements). These fold instead, so they are safe for
 * arbitrarily large datasets.
 *
 * Returns `undefined` for an empty array so callers must handle the empty case
 * explicitly rather than getting `Infinity` / `-Infinity`.
 */
export function minOf(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined
    let min = values[0]!
    for (let i = 1; i < values.length; i++) {
        const v = values[i]!
        if (v < min) min = v
    }
    return min
}

export function maxOf(values: readonly number[]): number | undefined {
    if (values.length === 0) return undefined
    let max = values[0]!
    for (let i = 1; i < values.length; i++) {
        const v = values[i]!
        if (v > max) max = v
    }
    return max
}
