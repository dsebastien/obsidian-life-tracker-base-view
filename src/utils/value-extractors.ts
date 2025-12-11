import { Value } from 'obsidian'

/**
 * Extract number value from Obsidian Value type
 */
export function extractNumber(value: Value | null): number | null {
    if (!value) return null

    const str = value.toString()

    // Try to parse as number
    const num = parseFloat(str)
    if (!isNaN(num)) {
        return num
    }

    // Boolean-like values
    const lower = str.toLowerCase()
    if (lower === 'true' || lower === 'yes') return 1
    if (lower === 'false' || lower === 'no') return 0

    return null
}

/**
 * Extract date value from Obsidian Value type
 */
export function extractDate(value: Value | null): Date | null {
    if (!value) return null

    const str = value.toString()

    // Try to parse as date
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
        return date
    }

    return null
}

/**
 * Extract list/array from Obsidian Value type
 * Works with ListValue and comma-separated strings
 */
export function extractList(value: Value | null): string[] {
    if (!value) return []

    const str = value.toString()

    // Handle array-like strings: ["a", "b"] or [a, b]
    if (str.startsWith('[') && str.endsWith(']')) {
        const inner = str.slice(1, -1)
        return parseListItems(inner)
    }

    // Handle comma-separated values
    if (str.includes(',')) {
        return parseListItems(str)
    }

    // Single value
    const trimmed = str.trim()
    return trimmed ? [trimmed] : []
}

/**
 * Parse comma-separated list items
 */
function parseListItems(str: string): string[] {
    return str
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter((item) => item.length > 0)
}

/**
 * Check if a value appears to be a date
 */
export function isDateLike(value: Value | null): boolean {
    if (!value) return false

    const str = value.toString()

    // ISO date format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return true

    // Try parsing
    const date = new Date(str)
    return !isNaN(date.getTime())
}

/**
 * Normalize a value to a number between 0 and 1
 */
export function normalizeValue(value: number, min: number, max: number): number {
    if (max === min) return 0.5
    return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Get color level (0-4) for heatmap based on normalized value
 */
export function getColorLevel(normalizedValue: number): 0 | 1 | 2 | 3 | 4 {
    if (normalizedValue <= 0) return 0
    if (normalizedValue <= 0.25) return 1
    if (normalizedValue <= 0.5) return 2
    if (normalizedValue <= 0.75) return 3
    return 4
}
