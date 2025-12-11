import { describe, expect, test } from 'bun:test'
import { parseVersion } from './update-version'

describe('parseVersion', () => {
    test('parses version without prefix', () => {
        expect(parseVersion('1.2.3')).toBe('1.2.3')
    })

    test('parses version with v prefix', () => {
        expect(parseVersion('v1.2.3')).toBe('1.2.3')
    })

    test('parses version with leading zeros', () => {
        expect(parseVersion('0.0.1')).toBe('0.0.1')
    })

    test('parses version with large numbers', () => {
        expect(parseVersion('10.20.30')).toBe('10.20.30')
    })

    test('throws on invalid format - missing parts', () => {
        expect(() => parseVersion('1.2')).toThrow('Invalid version format')
    })

    test('throws on invalid format - extra parts', () => {
        expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version format')
    })

    test('throws on invalid format - non-numeric', () => {
        expect(() => parseVersion('1.2.x')).toThrow('Invalid version format')
    })

    test('throws on invalid format - empty string', () => {
        expect(() => parseVersion('')).toThrow('Invalid version format')
    })

    test('throws on invalid prefix', () => {
        expect(() => parseVersion('version1.2.3')).toThrow('Invalid version format')
    })
})
