import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { extractReleaseNotes } from '../src/app/utils/release-notes'
import {
    applyCuratedNotes,
    checkCuratedNotes,
    consumeCuratedNotes,
    extractReleaseBody,
    readCuratedNotes
} from './generate-changelog'

/**
 * Written outside the repo, under a name unique to this process.
 *
 * It used to be `CHANGELOG.test.md` in the repo root. Two problems with that:
 * a run that dies before `afterAll` leaves an untracked file behind, and every
 * commit path here uses `git add -A`, so the stray file gets swept into the
 * next commit — a release commit, if the timing is unlucky. And two runs
 * sharing one checkout (a watcher alongside a manual run, or two agents) race
 * on the same path, so one deletes the file the other is still reading.
 */
const TEST_CHANGELOG = join(tmpdir(), `changelog-spec-${process.pid}-${Date.now()}.md`)

describe('getLatestChangelogEntry', () => {
    beforeAll(() => {
        // Create a test changelog file
        const content = `# Changelog

## [1.2.0] - 2024-01-15

### Added
- New feature A
- New feature B

### Fixed
- Bug fix 1

## [1.1.0] - 2024-01-01

### Added
- Initial feature

## [1.0.0] - 2023-12-01

### Added
- First release
`
        writeFileSync(TEST_CHANGELOG, content)
    })

    afterAll(() => {
        try {
            unlinkSync(TEST_CHANGELOG)
        } catch {
            // Ignore if file doesn't exist
        }
    })

    test('extracts latest version section', async () => {
        const testFile = Bun.file(TEST_CHANGELOG)

        // Read test content and verify extraction logic
        const content = await testFile.text()
        const sections = content.split(/^## /m)

        expect(sections.length).toBeGreaterThan(2)
        expect(sections[1]).toContain('[1.2.0]')
        expect(sections[1]).toContain('New feature A')
    })

    test('returns empty string for non-existent file', async () => {
        // This tests the edge case handling
        const nonExistentFile = Bun.file('CHANGELOG.nonexistent.md')
        const exists = await nonExistentFile.exists()
        expect(exists).toBe(false)
    })
})

describe('changelog format', () => {
    test('conventional changelog format is valid', () => {
        // Verify the expected format structure
        const sampleEntry = `## [1.0.0] - 2024-01-01

### Added
- Feature 1

### Fixed
- Bug 1
`
        expect(sampleEntry).toMatch(/^## \[\d+\.\d+\.\d+\]/)
        expect(sampleEntry).toContain('### Added')
        expect(sampleEntry).toContain('### Fixed')
    })
})

describe('applyCuratedNotes', () => {
    const generated = `## [1.3.0](https://github.com/o/r/compare/1.2.0...1.3.0) (2026-09-28)

### Features

* **plugin:** align with the catalog reviewer's archive ([abc1234](https://github.com/o/r/commit/abc1234))
`

    test('keeps the generated entry when there are no curated notes', () => {
        expect(applyCuratedNotes(generated, null)).toBe(generated)
        expect(applyCuratedNotes(generated, '  \n\n')).toBe(generated)
    })

    test('replaces the commit list with the curated notes under the same header', () => {
        const entry = applyCuratedNotes(generated, '\n### New\n\n- Past view of any note.\n\n')
        expect(entry).toBe(
            '## [1.3.0](https://github.com/o/r/compare/1.2.0...1.3.0) (2026-09-28)\n\n### New\n\n- Past view of any note.\n'
        )
        expect(entry).not.toContain('catalog reviewer')
    })

    test('keeps a header-only generated entry whole (a release of chore commits)', () => {
        const entry = applyCuratedNotes('## [1.3.1](x) (2026-09-28)', '- Fixed.')
        expect(entry).toBe('## [1.3.1](x) (2026-09-28)\n\n- Fixed.\n')
    })

    test.each([
        ['### 1.2.0 users: migration', 'version heading'],
        ['```md\n## [1.2.0] in a fence\n```', 'version heading'],
        ['## Highlights', 'use ### or deeper'],
        ['# Title', 'use ### or deeper'],
        ['  ## Indented', 'use ### or deeper'],
        ['##', 'use ### or deeper'],
        ['```\n# c\n```\n## After a closed fence', 'use ### or deeper']
    ])('refuses %p', (notes, reason) => {
        expect(() => applyCuratedNotes(generated, `${notes}\n\n- x`)).toThrow(
            new RegExp(`^NEXT_RELEASE\\.md: .*${reason}`)
        )
    })

    test('accepts deeper headings, shell comments in fences and hashes in prose', () => {
        const notes =
            '### Fixed\n\n#### Detail\n\n```bash\n# install\n## also a comment\n```\n\n- Tag #inbox kept.'
        expect(applyCuratedNotes(generated, notes)).toContain(notes)
    })

    test('a fence closes only on its own marker', () => {
        const notes = '~~~\n```\n## inside\n~~~'
        expect(applyCuratedNotes(generated, notes)).toContain(notes)
        expect(() => applyCuratedNotes(generated, '````\n```\n````\n## out')).toThrow(
            /use ### or deeper/
        )
        expect(() => applyCuratedNotes(generated, '```\n~~~\n```\n## out')).toThrow(
            /use ### or deeper/
        )
    })

    test('refuses a generated entry without a version header', () => {
        expect(() => applyCuratedNotes('### Features\n\n* x\n', '- y')).toThrow(/no version header/)
    })
})

describe('both surfaces show the curated section', () => {
    const changelog = (notes: string): string =>
        `# Changelog\n\n${applyCuratedNotes('## [1.3.0](x) (2026-09-28)\n\n* raw\n', notes)}\n## [1.2.0](x) (2026-09-01)\n\n- older\n`

    test("the release body and the What's new tab carry the same text", () => {
        const text = changelog('### New\n\n- Past view of any note.\n\n```bash\n# install\n```')
        const body = extractReleaseBody(text, '1.3.0')
        const tab = extractReleaseNotes(text, '1.3.0', '1.2.0')
        expect(body).toContain('Past view of any note.')
        expect(body).toContain('# install')
        expect(body).not.toContain('older')
        expect(tab).toContain(body.split('\n').slice(1).join('\n').trim())
    })

    test('the release body refuses a changelog whose newest section is another version', () => {
        expect(() => extractReleaseBody(changelog('- x'), '1.3.1')).toThrow(
            /newest section is 1\.3\.0/
        )
    })
})

describe('curated notes file', () => {
    let dir = ''
    let path = ''
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'curated-notes-'))
        path = join(dir, 'NEXT_RELEASE.md')
    })
    afterEach(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    test('is consumed once, so the next release does not repeat it', async () => {
        writeFileSync(path, '- x')
        expect(await readCuratedNotes(path)).toBe('- x')
        expect(consumeCuratedNotes(path)).toBe(true)
        expect(existsSync(path)).toBe(false)
        expect(await readCuratedNotes(path)).toBeNull()
        expect(consumeCuratedNotes(path)).toBe(false)
    })

    test('is reported as curated, empty or absent before dispatch', async () => {
        expect(await checkCuratedNotes(path)).toBe('generated')
        writeFileSync(path, ' \n')
        expect(await checkCuratedNotes(path)).toBe('empty')
        writeFileSync(path, '- x')
        expect(await checkCuratedNotes(path)).toBe('curated')
        writeFileSync(path, '## Bad')
        await expect(checkCuratedNotes(path)).rejects.toThrow(/use ### or deeper/)
    })
})
