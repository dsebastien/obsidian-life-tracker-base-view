/**
 * Generates or updates CHANGELOG.md using conventional-changelog.
 * Usage: bun scripts/generate-changelog.ts
 */

import { $ } from 'bun'

export async function generateChangelog(): Promise<string> {
    // Generate changelog and capture output
    const result =
        await $`bunx conventional-changelog -p conventionalcommits -i CHANGELOG.md -s -r 0`.text()
    return result
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

// Only run if executed directly
if (import.meta.main) {
    console.log('Generating changelog...')
    await generateChangelog()
    console.log('Changelog updated successfully.')

    const latestEntry = await getLatestChangelogEntry()
    console.log('\n--- Latest changelog entry ---')
    console.log(latestEntry)
}
