import { Value } from 'obsidian'
import { parseISO, isValid, parse } from 'date-fns'

/**
 * Common date formats to try when parsing dates.
 * Order matters - more specific/common formats first.
 */
const DATE_FORMATS = [
    // ISO-like formats (most common in Obsidian)
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    // European formats (day first)
    'dd-MM-yyyy',
    'dd/MM/yyyy',
    'dd.MM.yyyy',
    // US formats (month first)
    'MM-dd-yyyy',
    'MM/dd/yyyy',
    // With time
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    "yyyy-MM-dd'T'HH:mm:ss",
    "yyyy-MM-dd'T'HH:mm",
    'dd-MM-yyyy HH:mm:ss',
    'dd/MM/yyyy HH:mm:ss',
    'MM-dd-yyyy HH:mm:ss',
    'MM/dd/yyyy HH:mm:ss'
]

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
 * Parse a date string using multiple format attempts.
 * Returns the parsed Date or null if no format matches.
 */
export function parseDateString(str: string): Date | null {
    // Trim whitespace
    const trimmed = str.trim()
    if (!trimmed) return null

    // Try ISO parsing first (handles full ISO 8601 with timezone)
    const isoDate = parseISO(trimmed)
    if (isValid(isoDate)) {
        return isoDate
    }

    // Try each format in order
    const referenceDate = new Date()
    for (const format of DATE_FORMATS) {
        try {
            const parsed = parse(trimmed, format, referenceDate)
            if (isValid(parsed)) {
                return parsed
            }
        } catch {
            // Format didn't match, continue to next
        }
    }

    return null
}

/**
 * Extract date value from Obsidian Value type
 */
export function extractDate(value: Value | null): Date | null {
    if (!value) return null

    const str = value.toString()
    return parseDateString(str)
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

    // Quick regex check for common date patterns before expensive parsing
    // Matches: YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, etc.
    if (/^\d{2,4}[-/.]\d{2}[-/.]\d{2,4}/.test(str)) {
        // Looks like a date, try parsing
        return parseDateString(str) !== null
    }

    // Try parsing anyway for other formats
    return parseDateString(str) !== null
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
