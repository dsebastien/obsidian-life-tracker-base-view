import { describe, expect, test } from 'bun:test'
import { compareSemver, extractReleaseNotes, parseChangelogSections } from './release-notes'

const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [1.8.0](https://github.com/x/y/compare/1.7.2...1.8.0) (2026-07-18)

### Features

- shiny new board ([abc1234](https://github.com/x/y/commit/abc1234))

### [1.7.2](https://github.com/x/y/compare/1.7.1...1.7.2) (2026-07-17)

### Bug Fixes

- fix drag and drop ([def5678](https://github.com/x/y/commit/def5678))

## [1.7.0](https://github.com/x/y/compare/1.6.0...1.7.0) (2026-07-17)

### Features

- calendar mode ([aaa1111](https://github.com/x/y/commit/aaa1111))
`

describe('compareSemver', () => {
    test('orders versions correctly', () => {
        expect(compareSemver('1.8.0', '1.7.2')).toBeGreaterThan(0)
        expect(compareSemver('1.7.2', '1.8.0')).toBeLessThan(0)
        expect(compareSemver('1.8.0', '1.8.0')).toBe(0)
        expect(compareSemver('1.10.0', '1.9.9')).toBeGreaterThan(0)
    })
})

describe('parseChangelogSections', () => {
    test('splits ## and ### version headings into sections, newest first', () => {
        const sections = parseChangelogSections(CHANGELOG)
        expect(sections.map((s) => s.version)).toEqual(['1.8.0', '1.7.2', '1.7.0'])
        expect(sections[0]?.markdown).toContain('shiny new board')
        expect(sections[1]?.markdown).toContain('fix drag and drop')
    })

    test('ignores non-version headings and preamble', () => {
        const sections = parseChangelogSections(CHANGELOG)
        expect(sections[0]?.markdown).not.toContain('All notable changes')
    })
})

describe('extractReleaseNotes', () => {
    test('returns only the current version section without a sinceVersion', () => {
        const notes = extractReleaseNotes(CHANGELOG, '1.8.0')
        expect(notes).toContain('shiny new board')
        expect(notes).not.toContain('fix drag and drop')
    })

    test('returns all sections between since (exclusive) and current (inclusive)', () => {
        const notes = extractReleaseNotes(CHANGELOG, '1.8.0', '1.7.0')
        expect(notes).toContain('shiny new board')
        expect(notes).toContain('fix drag and drop')
        expect(notes).not.toContain('calendar mode')
    })

    test('excludes sections newer than the current version', () => {
        const notes = extractReleaseNotes(CHANGELOG, '1.7.2', '1.7.0')
        expect(notes).toContain('fix drag and drop')
        expect(notes).not.toContain('shiny new board')
    })

    test('returns an empty string when the version is not in the changelog', () => {
        expect(extractReleaseNotes(CHANGELOG, '9.9.9')).toBe('')
    })

    test('caps the number of sections', () => {
        const notes = extractReleaseNotes(CHANGELOG, '1.8.0', '0.0.1', 1)
        expect(notes).toContain('shiny new board')
        expect(notes).not.toContain('fix drag and drop')
    })
})
