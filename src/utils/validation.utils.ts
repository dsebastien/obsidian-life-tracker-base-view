import type { PropertyDefinition, ValidationResult } from '../app/types'

/**
 * Validate a value against a property definition
 * Can be used by editors for immediate feedback
 */
export function validateValue(value: unknown, definition: PropertyDefinition): ValidationResult {
    // Check required
    if (definition.required && isEmpty(value)) {
        return { valid: false, error: 'This field is required' }
    }

    // Skip validation for empty optional values
    if (isEmpty(value)) {
        return { valid: true }
    }

    switch (definition.type) {
        case 'text':
            return validateText(value, definition)
        case 'number':
            return validateNumber(value, definition)
        case 'checkbox':
            return validateBoolean(value)
        case 'date':
            return validateDate(value)
        case 'datetime':
            return validateDatetime(value)
        case 'list':
            return validateList(value, definition)
        case 'tags':
            return validateTags(value, definition)
        default:
            return { valid: true }
    }
}

/**
 * Check if a value is empty (null, undefined, or empty string)
 */
export function isEmpty(value: unknown): boolean {
    return value === null || value === undefined || value === ''
}

/**
 * Validate text value against allowed values
 */
export function validateText(value: unknown, definition: PropertyDefinition): ValidationResult {
    const strValue = String(value)

    if (definition.allowedValues.length > 0) {
        const lowerValue = strValue.toLowerCase()
        const isAllowed = definition.allowedValues.some(
            (allowed) => String(allowed).toLowerCase() === lowerValue
        )
        if (!isAllowed) {
            return {
                valid: false,
                error: `Value must be one of: ${definition.allowedValues.join(', ')}`
            }
        }
    }

    return { valid: true }
}

/**
 * Validate number value against constraints
 */
export function validateNumber(value: unknown, definition: PropertyDefinition): ValidationResult {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value))

    if (isNaN(numValue)) {
        return { valid: false, error: 'Value must be a number' }
    }

    const numberRange = definition.numberRange
    if (numberRange) {
        if (numValue < numberRange.min) {
            return { valid: false, error: `Value must be at least ${numberRange.min}` }
        }
        if (numValue > numberRange.max) {
            return { valid: false, error: `Value must be at most ${numberRange.max}` }
        }
    }

    return { valid: true }
}

/**
 * Validate boolean value
 */
export function validateBoolean(value: unknown): ValidationResult {
    if (typeof value === 'boolean') {
        return { valid: true }
    }

    const strValue = String(value).toLowerCase()
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(strValue)) {
        return { valid: true }
    }

    return { valid: false, error: 'Value must be true or false' }
}

/**
 * Validate date value (YYYY-MM-DD format)
 */
export function validateDate(value: unknown): ValidationResult {
    const strValue = String(value)

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(strValue)) {
        return { valid: false, error: 'Date must be in YYYY-MM-DD format' }
    }

    const date = new Date(strValue)
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid date' }
    }

    return { valid: true }
}

/**
 * Validate datetime value
 */
export function validateDatetime(value: unknown): ValidationResult {
    const strValue = String(value)

    const date = new Date(strValue)
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid datetime' }
    }

    return { valid: true }
}

/**
 * Validate list value against allowed values
 */
export function validateList(value: unknown, definition: PropertyDefinition): ValidationResult {
    const listValue = parseListValue(value)

    if (definition.allowedValues.length > 0) {
        const allowedLower = definition.allowedValues.map((v) => String(v).toLowerCase())
        for (const item of listValue) {
            if (!allowedLower.includes(item.toLowerCase())) {
                return {
                    valid: false,
                    error: `"${item}" is not allowed. Allowed: ${definition.allowedValues.join(', ')}`
                }
            }
        }
    }

    return { valid: true }
}

/**
 * Validate tags value
 */
export function validateTags(value: unknown, definition: PropertyDefinition): ValidationResult {
    const tagValues = parseTagsValue(value)

    // Check tag format
    for (const tag of tagValues) {
        if (!tag.startsWith('#') && !tag.match(/^[a-zA-Z0-9_-]+$/)) {
            return { valid: false, error: `Invalid tag format: "${tag}"` }
        }
    }

    if (definition.allowedValues.length > 0) {
        const allowedLower = definition.allowedValues.map((v) =>
            String(v).toLowerCase().replace(/^#/, '')
        )
        for (const tag of tagValues) {
            const normalizedTag = tag.toLowerCase().replace(/^#/, '')
            if (!allowedLower.includes(normalizedTag)) {
                return {
                    valid: false,
                    error: `"${tag}" is not allowed. Allowed: ${definition.allowedValues.join(', ')}`
                }
            }
        }
    }

    return { valid: true }
}

/**
 * Parse a value into a list of strings
 */
export function parseListValue(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(String)
    }
    return String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
}

/**
 * Parse a value into a list of tags
 */
export function parseTagsValue(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(String)
    }
    return String(value)
        .split(/[,\s]+/)
        .filter(Boolean)
}

/**
 * Convert value to appropriate type for the property
 */
export function coerceValue(value: unknown, definition: PropertyDefinition): unknown {
    if (isEmpty(value)) {
        return definition.defaultValue ?? undefined
    }

    switch (definition.type) {
        case 'number':
            return typeof value === 'number' ? value : parseFloat(String(value))
        case 'checkbox': {
            if (typeof value === 'boolean') return value
            const strVal = String(value).toLowerCase()
            return strVal === 'true' || strVal === 'yes' || strVal === '1'
        }
        case 'list':
            return parseListValue(value)
        case 'tags':
            return parseTagsValue(value)
        default:
            return value
    }
}
