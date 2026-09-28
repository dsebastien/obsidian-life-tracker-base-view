/**
 * Generates or updates CHANGELOG.md using conventional-changelog.
 * Also syncs to docs/release-notes.md for documentation.
 * Usage: bun scripts/generate-changelog.ts
 *
 * Curated notes: when NEXT_RELEASE.md exists, its text becomes the body of the
 * new CHANGELOG.md section in place of the generated commit list, and the file
 * is removed (the release commit records the removal). CHANGELOG.md feeds both
 * the in-app "What's new" tab and the GitHub release body, so the two cannot
 * disagree. Without the file, the generated list is used as before.
 */

import { existsSync, unlinkSync } from 'node:fs'
import { $ } from 'bun'
import { parseChangelogSections, VERSION_HEADING_REGEX } from '../src/app/utils/release-notes'

/** Hand-written notes for the next release, consumed by the release. */
export const CURATED_NOTES_FILE = 'NEXT_RELEASE.md'

const CHANGELOG_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

`

/**
 * Why the curated notes cannot be used, or null when they can.
 *
 * Both readers of CHANGELOG.md (the in-app "What's new" tab and the GitHub
 * release body) split it with `parseChangelogSections`, so a line that parser
 * reads as a version heading would end the release's section early, fenced
 * code included (the parser does not know about fences). Such a line is
 * refused anywhere. Outside fences, `#` and `##` headings are refused too:
 * they would outrank the release's own `##` version heading.
 */
export function curatedNotesProblem(curated: string): string | null {
    let fence: string | null = null
    for (const line of curated.split('\n')) {
        if (VERSION_HEADING_REGEX.test(line)) {
            return `"${line}" reads as a version heading and would split the release section`
        }
        const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1]
        if (marker !== undefined) {
            if (fence === null) {
                fence = marker
            } else if (marker[0] === fence[0] && marker.length >= fence.length) {
                fence = null
            }
            continue
        }
        if (fence === null && /^\s{0,3}#{1,2}(\s|$)/.test(line)) {
            return `"${line}": use ### or deeper headings under the release's own heading`
        }
    }
    return null
}

/**
 * The CHANGELOG.md entry for a release: the generated version header, followed
 * by the curated notes when there are any, else the generated commit list.
 */
export function applyCuratedNotes(generatedEntry: string, curated: string | null): string {
    const notes = curated?.trim() ?? ''
    if (notes === '') {
        return generatedEntry
    }
    const problem = curatedNotesProblem(notes)
    if (problem !== null) {
        throw new Error(`${CURATED_NOTES_FILE}: ${problem}.`)
    }
    const entry = generatedEntry.trim()
    const headerEnd = entry.indexOf('\n')
    const header = headerEnd === -1 ? entry : entry.slice(0, headerEnd)
    if (!/^## /.test(header)) {
        throw new Error(`Generated changelog entry has no version header: "${header}"`)
    }
    return `${header}\n\n${notes}\n`
}

/**
 * Read the curated notes, or null when there are none. Removal is separate
 * (`consumeCuratedNotes`) so the file survives any failure before CHANGELOG.md
 * is written.
 */
export async function readCuratedNotes(path = CURATED_NOTES_FILE): Promise<string | null> {
    const file = Bun.file(path)
    return (await file.exists()) ? await file.text() : null
}

/**
 * Remove the consumed notes so the next release does not repeat them. The
 * release commit records the removal.
 */
export function consumeCuratedNotes(path = CURATED_NOTES_FILE): boolean {
    if (!existsSync(path)) {
        return false
    }
    unlinkSync(path)
    return true
}

/**
 * The GitHub release body: the newest CHANGELOG.md section, cut by the same
 * parser the "What's new" tab uses, so the two surfaces show the same text.
 */
export function extractReleaseBody(changelog: string, version: string): string {
    const newest = parseChangelogSections(changelog)[0]
    if (newest?.version !== version) {
        throw new Error(
            `CHANGELOG.md's newest section is ${newest?.version ?? 'missing'}, not the released ${version}.`
        )
    }
    return newest.markdown
}

export async function generateChangelog(): Promise<string> {
    const changelogFile = Bun.file('CHANGELOG.md')

    // Read existing changelog content (excluding header)
    let existingContent = ''
    if (await changelogFile.exists()) {
        const content = await changelogFile.text()
        // Remove the header if present (everything before first ## version line)
        const match = content.match(/^(## \[?\d)/m)
        if (match?.index !== undefined) {
            existingContent = content.substring(match.index)
        } else if (!content.startsWith('#')) {
            // No header, keep all content
            existingContent = content
        }
    }

    // Generate new changelog entry to stdout
    const generatedEntry = await $`bunx conventional-changelog -p conventionalcommits -r 1`.text()
    const curated = await readCuratedNotes()
    const newEntry = applyCuratedNotes(generatedEntry, curated)

    // Combine header + new entry + existing content
    const finalContent =
        CHANGELOG_HEADER +
        newEntry.trim() +
        (existingContent ? '\n\n' + existingContent : '') +
        '\n'

    // Write the combined content
    await Bun.write('CHANGELOG.md', finalContent)
    if (consumeCuratedNotes()) {
        console.log(`Used ${CURATED_NOTES_FILE} as the release notes, and removed it.`)
    }

    return newEntry
}

export async function getLatestChangelogEntry(): Promise<string> {
    const changelogFile = Bun.file('CHANGELOG.md')
    if (!(await changelogFile.exists())) {
        return ''
    }

    const content = await changelogFile.text()
    // Extract the latest version section (between first and second ## headers)
    const sections = content.split(/^## /m)
    if (sections.length < 2) {
        return content
    }
    // Return the first version section (sections[0] is content before first ##)
    return '## ' + (sections[1] ?? '')
}

/**
 * Converts CHANGELOG.md format to docs/release-notes.md format.
 * Strips GitHub links and commit hashes for cleaner documentation.
 */
export async function syncToDocsReleaseNotes(): Promise<void> {
    const changelogFile = Bun.file('CHANGELOG.md')
    if (!(await changelogFile.exists())) {
        console.log('No CHANGELOG.md found, skipping docs sync.')
        return
    }

    // Check if docs folder exists
    try {
        const stat = await Bun.file('docs/README.md').exists()
        if (!stat) {
            console.log('No docs folder found, skipping docs sync.')
            return
        }
    } catch {
        console.log('No docs folder found, skipping docs sync.')
        return
    }

    const content = await changelogFile.text()

    // Transform changelog to release notes format:
    // 1. Remove commit links like ([abc1234](https://...))
    // 2. Remove issue links like , closes [#123](https://...)
    // 3. Simplify version headers from ## [1.0.0](link) (date) to ## 1.0.0 (date)
    let releaseNotes = content
        // Remove commit hash links
        .replace(/\s*\(\[[a-f0-9]+\]\([^)]+\)\)/g, '')
        // Remove "closes #XX" links
        .replace(/,?\s*closes\s*\[#\d+\]\([^)]+\)/gi, '')
        // Simplify version headers: ## [1.0.0](link) (date) -> ## 1.0.0 (date)
        .replace(/^## \[([^\]]+)\]\([^)]+\)/gm, '## $1')
        // Replace "Changelog" header with "Release Notes"
        .replace(/^# Changelog/m, '# Release Notes')
        // Remove the "All notable changes..." line
        .replace(/^All notable changes to this project will be documented in this file\.\n\n/m, '')

    // Clean up any double blank lines
    releaseNotes = releaseNotes.replace(/\n{3,}/g, '\n\n')

    await Bun.write('docs/release-notes.md', releaseNotes)
}

/**
 * Validate NEXT_RELEASE.md without touching anything, for release.sh to fail
 * before dispatching rather than in the workflow. Returns what the release
 * will use.
 */
export async function checkCuratedNotes(
    path = CURATED_NOTES_FILE
): Promise<'curated' | 'empty' | 'generated'> {
    const curated = await readCuratedNotes(path)
    applyCuratedNotes('## check\n', curated)
    if (curated === null) {
        return 'generated'
    }
    return curated.trim() ? 'curated' : 'empty'
}

const CHECK_MESSAGES = {
    curated: `Release notes: curated, from ${CURATED_NOTES_FILE}.`,
    empty: `Release notes: generated from commit subjects (${CURATED_NOTES_FILE} is empty; the release removes it).`,
    generated: `Release notes: generated from commit subjects (no ${CURATED_NOTES_FILE}).`
} as const

// Only run if executed directly
if (import.meta.main && process.argv.includes('--check-curated')) {
    console.log(CHECK_MESSAGES[await checkCuratedNotes()])
} else if (import.meta.main && process.argv.includes('--release-body')) {
    // Printed for the release workflow, which appends the footer.
    const version = process.argv[process.argv.indexOf('--release-body') + 1] ?? ''
    console.log(extractReleaseBody(await Bun.file('CHANGELOG.md').text(), version))
} else if (import.meta.main) {
    console.log('Generating changelog...')
    await generateChangelog()
    console.log('Changelog updated successfully.')

    console.log('Syncing to docs/release-notes.md...')
    await syncToDocsReleaseNotes()
    console.log('Docs release notes synced successfully.')

    const latestEntry = await getLatestChangelogEntry()
    console.log('\n--- Latest changelog entry ---')
    console.log(latestEntry)
}
