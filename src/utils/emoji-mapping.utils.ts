import type { EmojiMapping } from '../app/types/property/property-definition.types'

/**
 * A mapping key parsed into what it actually matches (issue #22).
 */
export type ParsedEmojiKey =
    | { kind: 'exact'; value: number }
    | { kind: 'range'; min: number; max: number }

/**
 * Range keys accept `1-2` or `1..2`, and cope with negative bounds (`-5--1`,
 * `-5..-1`). The leading group is anchored so `-1` alone stays an exact key
 * rather than a half-parsed range.
 */
const RANGE_KEY_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(?:\.\.|-)\s*(-?\d+(?:\.\d+)?)$/

/** A key that is just a number, e.g. `3` or `-1.5` */
const EXACT_KEY_PATTERN = /^-?\d+(?:\.\d+)?$/

/**
 * Parse a mapping key into an exact value or an inclusive range.
 * Returns null for keys that are neither (typos, empty strings, text values).
 *
 * Reversed ranges (`5-1`) are normalized rather than rejected: the user clearly
 * meant the span between the two numbers.
 */
export function parseEmojiKey(key: string): ParsedEmojiKey | null {
    const trimmed = key.trim()
    if (trimmed.length === 0) return null

    if (EXACT_KEY_PATTERN.test(trimmed)) {
        const value = Number(trimmed)
        // A long enough digit string overflows to Infinity, which no cell value
        // could ever equal — reject rather than offer a key that never matches
        return Number.isFinite(value) ? { kind: 'exact', value } : null
    }

    const rangeMatch = RANGE_KEY_PATTERN.exec(trimmed)
    if (!rangeMatch) return null

    const first = Number(rangeMatch[1])
    const second = Number(rangeMatch[2])
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null

    return { kind: 'range', min: Math.min(first, second), max: Math.max(first, second) }
}

/** Whether a key can be used in an emoji mapping (drives the settings warning) */
export function isValidEmojiKey(key: string): boolean {
    return parseEmojiKey(key) !== null
}

/**
 * A mapping entry ready to render as a one-tap entry button (issue #22).
 * `value` is what tapping it should record: the exact value, or a range's lower
 * bound (the only member of a range we can name unambiguously).
 */
export interface EmojiEntry {
    key: string
    emoji: string
    value: number
}

/**
 * Find the mapping entry that applies to a value (issue #22).
 *
 * Exact keys win over ranges, so `{ "0-10": "🙂", "10": "🎉" }` still celebrates
 * a perfect score. Among ranges, the first match in insertion order wins, which
 * is the order the settings editor displays.
 *
 * The single source of truth for precedence: tooltips and the capture modal's
 * selected-button state both go through it, so what is shown and what is
 * highlighted can never disagree.
 *
 * Returns null when nothing matches — callers render the value unchanged.
 */
export function findEmojiEntry(
    value: number | null | undefined,
    mapping: EmojiMapping | null | undefined
): EmojiEntry | null {
    if (value === null || value === undefined || !Number.isFinite(value)) return null
    if (!mapping) return null

    let rangeMatch: EmojiEntry | null = null

    for (const [key, emoji] of Object.entries(mapping)) {
        if (!emoji) continue

        const parsed = parseEmojiKey(key)
        if (!parsed) continue

        if (parsed.kind === 'exact') {
            if (parsed.value === value) return { key, emoji, value: parsed.value }
        } else if (rangeMatch === null && value >= parsed.min && value <= parsed.max) {
            // Keep looking: a later exact key must still be able to win
            rangeMatch = { key, emoji, value: parsed.min }
        }
    }

    return rangeMatch
}

/**
 * The emoji configured for a value, or null when nothing matches.
 */
export function resolveValueEmoji(
    value: number | null | undefined,
    mapping: EmojiMapping | null | undefined
): string | null {
    return findEmojiEntry(value, mapping)?.emoji ?? null
}

/**
 * Prefix an already-formatted value with its emoji, when it has one.
 * Used by tooltips, where the emoji reads as an at-a-glance summary.
 */
export function formatValueWithEmoji(
    value: number | null | undefined,
    mapping: EmojiMapping | null | undefined,
    formatted: string
): string {
    const emoji = resolveValueEmoji(value, mapping)
    return emoji ? `${emoji} ${formatted}` : formatted
}

/**
 * List the usable entries of a mapping, in configured order, skipping keys that
 * do not parse and entries with no emoji.
 */
export function listEmojiEntries(mapping: EmojiMapping | null | undefined): EmojiEntry[] {
    if (!mapping) return []

    const entries: EmojiEntry[] = []
    for (const [key, emoji] of Object.entries(mapping)) {
        if (!emoji) continue

        const parsed = parseEmojiKey(key)
        if (!parsed) continue

        entries.push({
            key,
            emoji,
            value: parsed.kind === 'exact' ? parsed.value : parsed.min
        })
    }
    return entries
}
