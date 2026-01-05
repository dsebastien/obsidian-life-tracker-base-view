import { describe, expect, test } from 'bun:test'
import {
    isEmpty,
    validateText,
    validateNumber,
    validateBoolean,
    validateDate,
    validateDatetime,
    validateList,
    validateTags,
    parseListValue,
    parseTagsValue,
    isValidNumberKeystroke,
    clampToRange,
    sanitizeNumberPaste,
    isInAllowedValues,
    isTagAllowed
} from './validation.utils'

import type { PropertyDefinition } from '../app/types'

// Helper to create a mock PropertyDefinition
function createMockDefinition(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
    return {
        id: 'test-id',
        name: 'test',
        displayName: 'Test',
        type: 'text',
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

// Helper to create a mock KeyboardEvent
function createKeyEvent(key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        key,
        ctrlKey: false,
        metaKey: false,
        target: { selectionStart: 0, selectionEnd: 0 } as HTMLInputElement,
        ...options
    } as KeyboardEvent
}

describe('validation.utils', () => {
    describe('isEmpty', () => {
        test('returns true for null', () => {
            expect(isEmpty(null)).toBe(true)
        })

        test('returns true for undefined', () => {
            expect(isEmpty(undefined)).toBe(true)
        })

        test('returns true for empty string', () => {
            expect(isEmpty('')).toBe(true)
        })

        test('returns false for non-empty string', () => {
            expect(isEmpty('hello')).toBe(false)
        })

        test('returns false for zero', () => {
            expect(isEmpty(0)).toBe(false)
        })

        test('returns false for false', () => {
            expect(isEmpty(false)).toBe(false)
        })
    })

    describe('validateNumber', () => {
        test('returns valid for number within range', () => {
            const def = createMockDefinition({ type: 'number', numberRange: { min: 0, max: 10 } })
            expect(validateNumber(5, def)).toEqual({ valid: true })
        })

        test('returns invalid for number below range', () => {
            const def = createMockDefinition({ type: 'number', numberRange: { min: 0, max: 10 } })
            const result = validateNumber(-1, def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('at least 0')
        })

        test('returns invalid for number above range', () => {
            const def = createMockDefinition({ type: 'number', numberRange: { min: 0, max: 10 } })
            const result = validateNumber(15, def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('at most 10')
        })

        test('returns invalid for non-number', () => {
            const def = createMockDefinition({ type: 'number' })
            const result = validateNumber('abc', def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('must be a number')
        })
    })

    describe('validateText', () => {
        test('returns valid when no allowed values', () => {
            const def = createMockDefinition({ type: 'text' })
            expect(validateText('anything', def)).toEqual({ valid: true })
        })

        test('returns valid for allowed value', () => {
            const def = createMockDefinition({ type: 'text', allowedValues: ['yes', 'no'] })
            expect(validateText('yes', def)).toEqual({ valid: true })
        })

        test('returns valid for allowed value (case insensitive)', () => {
            const def = createMockDefinition({ type: 'text', allowedValues: ['Yes', 'No'] })
            expect(validateText('YES', def)).toEqual({ valid: true })
        })

        test('returns invalid for non-allowed value', () => {
            const def = createMockDefinition({ type: 'text', allowedValues: ['yes', 'no'] })
            const result = validateText('maybe', def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('must be one of')
        })
    })

    describe('validateDate', () => {
        test('returns valid for correct date format', () => {
            expect(validateDate('2024-01-15')).toEqual({ valid: true })
        })

        test('returns invalid for wrong format', () => {
            const result = validateDate('01/15/2024')
            expect(result.valid).toBe(false)
        })

        test('returns invalid for invalid date', () => {
            const result = validateDate('2024-13-45')
            expect(result.valid).toBe(false)
        })
    })

    describe('isValidNumberKeystroke', () => {
        test('allows digits', () => {
            expect(isValidNumberKeystroke(createKeyEvent('5'), '')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('0'), '')).toBe(true)
        })

        test('allows control keys', () => {
            expect(isValidNumberKeystroke(createKeyEvent('Backspace'), '')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('Delete'), '')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('Tab'), '')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('ArrowLeft'), '')).toBe(true)
        })

        test('allows decimal point once', () => {
            expect(isValidNumberKeystroke(createKeyEvent('.'), '5')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('.'), '5.5')).toBe(false)
        })

        test('allows minus at start only', () => {
            const eventAtStart = createKeyEvent('-', {
                target: { selectionStart: 0, selectionEnd: 0 } as HTMLInputElement
            })
            expect(isValidNumberKeystroke(eventAtStart, '5')).toBe(true)

            const eventInMiddle = createKeyEvent('-', {
                target: { selectionStart: 1, selectionEnd: 1 } as HTMLInputElement
            })
            expect(isValidNumberKeystroke(eventInMiddle, '5')).toBe(false)
        })

        test('blocks letters', () => {
            expect(isValidNumberKeystroke(createKeyEvent('a'), '')).toBe(false)
            expect(isValidNumberKeystroke(createKeyEvent('z'), '')).toBe(false)
        })

        test('allows ctrl/cmd combinations', () => {
            expect(isValidNumberKeystroke(createKeyEvent('v', { ctrlKey: true }), '')).toBe(true)
            expect(isValidNumberKeystroke(createKeyEvent('c', { metaKey: true }), '')).toBe(true)
        })
    })

    describe('clampToRange', () => {
        test('returns value within range unchanged', () => {
            expect(clampToRange(5, { min: 0, max: 10 })).toBe(5)
        })

        test('clamps value below min to min', () => {
            expect(clampToRange(-5, { min: 0, max: 10 })).toBe(0)
        })

        test('clamps value above max to max', () => {
            expect(clampToRange(15, { min: 0, max: 10 })).toBe(10)
        })

        test('returns null for NaN', () => {
            expect(clampToRange('abc', { min: 0, max: 10 })).toBe(null)
        })

        test('returns value unchanged when no range', () => {
            expect(clampToRange(100, null)).toBe(100)
        })
    })

    describe('sanitizeNumberPaste', () => {
        test('allows valid number paste', () => {
            expect(sanitizeNumberPaste('123', '', 0, 0, null)).toBe('123')
        })

        test('blocks non-numeric paste', () => {
            expect(sanitizeNumberPaste('abc', '', 0, 0, null)).toBe(null)
        })

        test('clamps pasted value to range', () => {
            expect(sanitizeNumberPaste('100', '', 0, 0, { min: 0, max: 10 })).toBe('10')
        })

        test('allows negative numbers', () => {
            expect(sanitizeNumberPaste('-5', '', 0, 0, null)).toBe('-5')
        })

        test('allows decimal numbers', () => {
            expect(sanitizeNumberPaste('3.14', '', 0, 0, null)).toBe('3.14')
        })
    })

    describe('isInAllowedValues', () => {
        test('returns true when no allowed values', () => {
            expect(isInAllowedValues('anything', [])).toBe(true)
        })

        test('returns true for allowed value', () => {
            expect(isInAllowedValues('yes', ['yes', 'no'])).toBe(true)
        })

        test('returns true case-insensitively', () => {
            expect(isInAllowedValues('YES', ['yes', 'no'])).toBe(true)
        })

        test('returns false for non-allowed value', () => {
            expect(isInAllowedValues('maybe', ['yes', 'no'])).toBe(false)
        })
    })

    describe('isTagAllowed', () => {
        test('returns true when no allowed values', () => {
            expect(isTagAllowed('anything', [])).toBe(true)
        })

        test('returns true for allowed tag without hash', () => {
            expect(isTagAllowed('important', ['#important', '#urgent'])).toBe(true)
        })

        test('returns true for allowed tag with hash', () => {
            expect(isTagAllowed('#important', ['#important', '#urgent'])).toBe(true)
        })

        test('returns false for non-allowed tag', () => {
            expect(isTagAllowed('other', ['#important', '#urgent'])).toBe(false)
        })
    })

    describe('parseListValue', () => {
        test('parses comma-separated string', () => {
            expect(parseListValue('a, b, c')).toEqual(['a', 'b', 'c'])
        })

        test('returns array as-is', () => {
            expect(parseListValue(['a', 'b'])).toEqual(['a', 'b'])
        })

        test('filters empty values', () => {
            expect(parseListValue('a, , b')).toEqual(['a', 'b'])
        })
    })

    describe('parseTagsValue', () => {
        test('parses space-separated tags', () => {
            expect(parseTagsValue('#tag1 #tag2')).toEqual(['#tag1', '#tag2'])
        })

        test('parses comma-separated tags', () => {
            expect(parseTagsValue('#tag1, #tag2')).toEqual(['#tag1', '#tag2'])
        })

        test('returns array as-is', () => {
            expect(parseTagsValue(['#tag1', '#tag2'])).toEqual(['#tag1', '#tag2'])
        })
    })

    describe('validateBoolean', () => {
        test('returns valid for true/false', () => {
            expect(validateBoolean(true)).toEqual({ valid: true })
            expect(validateBoolean(false)).toEqual({ valid: true })
        })

        test('returns valid for string boolean values', () => {
            expect(validateBoolean('true')).toEqual({ valid: true })
            expect(validateBoolean('false')).toEqual({ valid: true })
            expect(validateBoolean('yes')).toEqual({ valid: true })
            expect(validateBoolean('no')).toEqual({ valid: true })
            expect(validateBoolean('1')).toEqual({ valid: true })
            expect(validateBoolean('0')).toEqual({ valid: true })
        })

        test('returns invalid for non-boolean values', () => {
            const result = validateBoolean('maybe')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('true or false')
        })
    })

    describe('validateDatetime', () => {
        test('returns valid for ISO datetime', () => {
            expect(validateDatetime('2024-01-15T10:30:00')).toEqual({ valid: true })
        })

        test('returns valid for date with timezone', () => {
            expect(validateDatetime('2024-01-15T10:30:00Z')).toEqual({ valid: true })
        })

        test('returns invalid for invalid datetime', () => {
            const result = validateDatetime('not-a-date')
            expect(result.valid).toBe(false)
            expect(result.error).toContain('Invalid datetime')
        })
    })

    describe('validateList', () => {
        test('returns valid when no allowed values', () => {
            const def = createMockDefinition({ type: 'list' })
            expect(validateList(['a', 'b'], def)).toEqual({ valid: true })
        })

        test('returns valid for allowed values', () => {
            const def = createMockDefinition({ type: 'list', allowedValues: ['a', 'b', 'c'] })
            expect(validateList(['a', 'b'], def)).toEqual({ valid: true })
        })

        test('returns invalid for non-allowed value', () => {
            const def = createMockDefinition({ type: 'list', allowedValues: ['a', 'b'] })
            const result = validateList(['a', 'x'], def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('"x" is not allowed')
        })
    })

    describe('validateTags', () => {
        test('returns valid when no allowed values', () => {
            const def = createMockDefinition({ type: 'tags' })
            expect(validateTags(['#tag1', '#tag2'], def)).toEqual({ valid: true })
        })

        test('returns valid for allowed tags', () => {
            const def = createMockDefinition({ type: 'tags', allowedValues: ['#tag1', '#tag2'] })
            expect(validateTags(['#tag1'], def)).toEqual({ valid: true })
        })

        test('returns invalid for non-allowed tag', () => {
            const def = createMockDefinition({ type: 'tags', allowedValues: ['#tag1', '#tag2'] })
            const result = validateTags(['#tag1', '#other'], def)
            expect(result.valid).toBe(false)
            expect(result.error).toContain('"#other" is not allowed')
        })
    })
})
