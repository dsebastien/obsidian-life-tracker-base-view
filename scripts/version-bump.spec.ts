import { describe, expect, test } from 'bun:test'
import { recordVersion } from './version-bump'
import type { ManifestJson, VersionsJson } from './version-bump'

describe('ManifestJson interface', () => {
    test('valid manifest structure', () => {
        const manifest: ManifestJson = {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            minAppVersion: '1.4.0'
        }

        expect(manifest.id).toBe('test-plugin')
        expect(manifest.name).toBe('Test Plugin')
        expect(manifest.version).toBe('1.0.0')
        expect(manifest.minAppVersion).toBe('1.4.0')
    })

    test('manifest allows additional properties', () => {
        const manifest: ManifestJson = {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            minAppVersion: '1.4.0',
            author: 'Test Author',
            description: 'A test plugin'
        }

        expect(manifest.author).toBe('Test Author')
        expect(manifest.description).toBe('A test plugin')
    })
})

describe('VersionsJson interface', () => {
    test('valid versions structure', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0',
            '1.1.0': '1.0.0'
        }

        expect(versions['1.0.0']).toBe('0.15.0')
        expect(versions['1.1.0']).toBe('1.0.0')
    })

    test('versions keys should be semver', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0'
        }

        const key = Object.keys(versions)[0]
        expect(key).toMatch(/^\d+\.\d+\.\d+$/)
    })

    test('versions values should be semver', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0'
        }

        const value = Object.values(versions)[0]
        expect(value).toMatch(/^\d+\.\d+\.\d+$/)
    })
})

describe('version format validation', () => {
    test('valid semver formats', () => {
        const validVersions = ['0.0.1', '1.0.0', '1.2.3', '10.20.30']
        const semverRegex = /^\d+\.\d+\.\d+$/

        for (const version of validVersions) {
            expect(version).toMatch(semverRegex)
        }
    })

    test('invalid semver formats', () => {
        const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0-beta', '1.0.0.0']
        const semverRegex = /^\d+\.\d+\.\d+$/

        for (const version of invalidVersions) {
            expect(version).not.toMatch(semverRegex)
        }
    })
})

describe('recordVersion (issue #117)', () => {
    test('records every release, not just ones with a new minAppVersion', () => {
        // The original bug: `2.7.4 -> 1.12.0` was already present, so every
        // later release sharing that minimum was skipped and versions.json
        // stalled while 2.7.5 through 2.19.0 shipped
        const existing: VersionsJson = { '0.1.0': '1.10.0', '2.7.4': '1.12.0' }

        const result = recordVersion(existing, '2.20.0', '1.12.0')

        expect(result['2.20.0']).toBe('1.12.0')
        expect(Object.keys(result)).toHaveLength(3)
    })

    test('records a release that does raise the minimum', () => {
        const result = recordVersion({ '1.0.0': '1.10.0' }, '2.0.0', '1.12.0')
        expect(result).toEqual({ '1.0.0': '1.10.0', '2.0.0': '1.12.0' })
    })

    test('re-recording the same version is idempotent', () => {
        const existing: VersionsJson = { '1.0.0': '1.10.0' }
        expect(recordVersion(existing, '1.0.0', '1.10.0')).toEqual(existing)
    })

    test('a corrected minAppVersion overwrites the entry for that version', () => {
        expect(recordVersion({ '1.0.0': '1.10.0' }, '1.0.0', '1.12.0')).toEqual({
            '1.0.0': '1.12.0'
        })
    })

    test('does not mutate the input', () => {
        const existing: VersionsJson = { '1.0.0': '1.10.0' }
        recordVersion(existing, '2.0.0', '1.12.0')
        expect(existing).toEqual({ '1.0.0': '1.10.0' })
    })

    test('works from an empty map', () => {
        expect(recordVersion({}, '1.0.0', '1.10.0')).toEqual({ '1.0.0': '1.10.0' })
    })
})
