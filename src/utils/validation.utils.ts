import type { PropertyDefinition, ValidationResult, NumberRange } from '../app/types'

// ============================================================================
// Input Blocking Utilities
// These utilities prevent invalid input at the keystroke/paste level
// ============================================================================

/**
 * Check if a keystroke should be allowed for a number input.
 * Allows: digits, minus sign (at start), decimal point, backspace, delete, arrows, tab
 */
export function isValidNumberKeystroke(event: KeyboardEvent, currentValue: string): boolean {
    const key = event.key

    // Always allow control keys
    if (
        key === 'Backspace' ||
        key === 'Delete' ||
        key === 'Tab' ||
        key === 'Enter' ||
        key === 'Escape' ||
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'Home' ||
        key === 'End'
    ) {
        return true
    }

    // Allow Ctrl/Cmd combinations (copy, paste, select all, etc.)
    if (event.ctrlKey || event.metaKey) {
        return true
    }

    // Allow digits
    if (/^[0-9]$/.test(key)) {
        return true
    }

    // Allow minus sign only at the start
    if (key === '-') {
        const input = event.target as HTMLInputElement
        const selectionStart = input.selectionStart ?? 0
        // Allow minus at position 0, or if entire value is selected
        return (
            selectionStart === 0 ||
            (input.selectionStart === 0 && input.selectionEnd === currentValue.length)
        )
    }

    // Allow decimal point only if not already present
    if (key === '.') {
        return !currentValue.includes('.')
    }

    return false
}

/**
 * Clamp a numeric value to a range.
 * Returns the clamped value, or null if the input is not a valid number.
 */
export function clampToRange(value: string | number, range: NumberRange | null): number | null {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value))

    if (isNaN(numValue)) {
        return null
    }

    if (!range) {
        return numValue
    }

    return Math.max(range.min, Math.min(range.max, numValue))
}

/**
 * Validate and potentially modify pasted text for a number input.
 * Returns the sanitized value or null if completely invalid.
 */
export function sanitizeNumberPaste(
    pastedText: string,
    currentValue: string,
    selectionStart: number,
    selectionEnd: number,
    range: NumberRange | null
): string | null {
    // Build the resulting string after paste
    const before = currentValue.slice(0, selectionStart)
    const after = currentValue.slice(selectionEnd)
    const resultString = before + pastedText + after

    // Check if result would be a valid number format
    // Allow: optional minus, digits, optional decimal with digits
    const numberRegex = /^-?\d*\.?\d*$/
    if (!numberRegex.test(resultString)) {
        return null
    }

    // If it's just a minus or empty, allow it (partial input)
    if (resultString === '-' || resultString === '' || resultString === '.') {
        return pastedText
    }

    // Parse and validate the number
    const numValue = parseFloat(resultString)
    if (isNaN(numValue)) {
        return null
    }

    // If there's a range, clamp the final value
    if (range) {
        const clamped = clampToRange(numValue, range)
        if (clamped !== null && clamped !== numValue) {
            // Return the clamped value as the paste content
            return String(clamped)
        }
    }

    return pastedText
}

/**
 * Check if a value is in the allowed values list (case-insensitive).
 */
export function isInAllowedValues(value: string, allowedValues: (string | number)[]): boolean {
    if (allowedValues.length === 0) {
        return true // No restriction
    }

    const normalizedValue = value.toLowerCase().trim()
    return allowedValues.some((allowed) => String(allowed).toLowerCase() === normalizedValue)
}

/**
 * Check if a tag value is allowed (handles # prefix).
 */
export function isTagAllowed(tag: string, allowedValues: (string | number)[]): boolean {
    if (allowedValues.length === 0) {
        return true // No restriction
    }

    const normalizedTag = tag.toLowerCase().replace(/^#/, '').trim()
    return allowedValues.some(
        (allowed) => String(allowed).toLowerCase().replace(/^#/, '') === normalizedTag
    )
}

/**
 * Setup input blocking for a number input element.
 * Prevents invalid keystrokes and handles paste validation.
 */
export function setupNumberInputBlocking(
    input: HTMLInputElement,
    range: NumberRange | null,
    onValueClamped?: (clampedValue: number) => void
): () => void {
    const handleKeydown = (event: KeyboardEvent): void => {
        if (!isValidNumberKeystroke(event, input.value)) {
            event.preventDefault()
        }
    }

    const handlePaste = (event: ClipboardEvent): void => {
        const pastedText = event.clipboardData?.getData('text') ?? ''
        const selectionStart = input.selectionStart ?? 0
        const selectionEnd = input.selectionEnd ?? 0

        const sanitized = sanitizeNumberPaste(
            pastedText,
            input.value,
            selectionStart,
            selectionEnd,
            range
        )

        if (sanitized === null) {
            // Invalid paste, block it entirely
            event.preventDefault()
        } else if (sanitized !== pastedText) {
            // Paste was modified (clamped), insert manually
            event.preventDefault()
            const before = input.value.slice(0, selectionStart)
            const after = input.value.slice(selectionEnd)
            const newValue = before + sanitized + after
            input.value = newValue

            // Trigger input event for change listeners
            input.dispatchEvent(new Event('input', { bubbles: true }))

            if (onValueClamped && range) {
                const numValue = parseFloat(newValue)
                if (!isNaN(numValue)) {
                    onValueClamped(numValue)
                }
            }
        }
    }

    const handleInput = (): void => {
        // Additional validation after input - clamp if outside range
        if (range && input.value !== '' && input.value !== '-') {
            const numValue = parseFloat(input.value)
            if (!isNaN(numValue)) {
                const clamped = clampToRange(numValue, range)
                if (clamped !== null && clamped !== numValue) {
                    input.value = String(clamped)
                    onValueClamped?.(clamped)
                }
            }
        }
    }

    input.addEventListener('keydown', handleKeydown)
    input.addEventListener('paste', handlePaste)
    input.addEventListener('input', handleInput)

    // Return cleanup function
    return () => {
        input.removeEventListener('keydown', handleKeydown)
        input.removeEventListener('paste', handlePaste)
        input.removeEventListener('input', handleInput)
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
