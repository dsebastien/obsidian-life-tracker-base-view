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
 * Extract a display label from any value (Obsidian Value, object, array, primitive).
 * Returns null if the value has no meaningful displayable content.
 *
 * @param value - The value to extract a label from
 * @returns Display label string, or null if the value should be skipped
 */
export function extractDisplayLabel(
    propertyDisplayName: string,
    numericValue: number | null,
    booleanValue: boolean | null,
    listValues: string[]
): string | null {
    if (numericValue === null && booleanValue === null && listValues.length === 0) {
        return null
    }

    if (booleanValue) {
        if (booleanValue === true) {
            return `${propertyDisplayName}: True`
        } else {
            return `${propertyDisplayName}: False`
        }
    }

    if (listValues.length > 0) {
        return `${propertyDisplayName}: ${listValues.join(', ')}`
    }

    return `${propertyDisplayName}: ${numericValue}`
}

/**
 * Extract number value.
 * Returns null if the value is not numeric.
 * Note: Boolean values are NOT converted to numbers - use extractBoolean instead.
 */
export function extractNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null

    // If already a number, return it
    if (typeof value === 'number') {
        return isNaN(value) ? null : value
    }

    // If it's a boolean, don't convert - let booleanValue handle it
    if (typeof value === 'boolean') {
        return null
    }

    const str = value.toString().trim()
    if (!str) return null

    // Check if it's a boolean-like string - don't convert
    const lower = str.toLowerCase()
    if (lower === 'true' || lower === 'false' || lower === 'yes' || lower === 'no') {
        return null
    }

    // Try to parse as number
    const num = parseFloat(str)
    if (!isNaN(num)) {
        return num
    }

    return null
}

/**
 * Extract boolean value.
 * Returns true/false for boolean values, null otherwise.
 */
export function extractBoolean(value: unknown): boolean | null {
    if (value === null || value === undefined) return null

    // If already a boolean, return it
    if (typeof value === 'boolean') {
        return value
    }

    // If it's a number, don't convert - let numericValue handle it
    if (typeof value === 'number') {
        return null
    }

    const str = value.toString().trim().toLowerCase()
    if (!str || str === 'null' || str === 'undefined') return null

    // Check for boolean-like strings
    if (str === 'true' || str === 'yes') return true
    if (str === 'false' || str === 'no') return false

    return null
}

/**
 * Parse a date string using multiple format attempts.
 * Returns the parsed Date or null if no format matches.
 */
function parseDateString(str: string): Date | null {
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
