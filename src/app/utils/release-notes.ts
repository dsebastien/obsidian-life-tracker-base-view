/**
 * Utilities to extract the release notes shown in the "What's new" dialog
 * from the bundled CHANGELOG.md (conventional-changelog format: version
 * sections start with `## [x.y.z](...)` for feature releases and
 * `### [x.y.z](...)` for patch releases).
 */

export interface ChangelogSection {
    version: string
    /** The full section markdown, including its version heading. */
    markdown: string
}

/**
 * Matches a conventional-changelog version heading line (h1 for major
 * releases, h2 for minor, h3 for patch).
 */
const VERSION_HEADING_REGEX = /^#{1,3} \[?(\d+\.\d+\.\d+)\]?/

/**
 * Compare two SemVer versions (numeric core only, which is all Obsidian
 * plugins may use). Returns a negative number when a < b, 0 when equal,
 * a positive number when a > b.
 */
export function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (0 !== diff) {
            return diff
        }
    }
    return 0
}

/**
 * Split a changelog into per-version sections, in file order (newest first
 * for generated changelogs).
 */
export function parseChangelogSections(changelog: string): ChangelogSection[] {
    const sections: ChangelogSection[] = []
    let current: { version: string; lines: string[] } | null = null

    for (const line of changelog.split('\n')) {
        const match = VERSION_HEADING_REGEX.exec(line)
        const version = match?.[1]
        if (version) {
            if (current) {
                sections.push({
                    version: current.version,
                    markdown: current.lines.join('\n').trim()
                })
            }
            current = { version, lines: [line] }
        } else if (current) {
            current.lines.push(line)
        }
    }
    if (current) {
        sections.push({ version: current.version, markdown: current.lines.join('\n').trim() })
    }
    return sections
}

/**
 * Extract the release notes to show after an update to `currentVersion`.
 *
 * Returns every section newer than `sinceVersion` (exclusive) up to
 * `currentVersion` (inclusive), newest first, so an update that skipped
 * versions still surfaces everything the user missed. Without a
 * `sinceVersion` (first update after this feature shipped), only the current
 * version's section is returned. Returns an empty string when nothing
 * matches (e.g. changelog missing the version).
 */
export function extractReleaseNotes(
    changelog: string,
    currentVersion: string,
    sinceVersion?: string,
    maxSections = 10
): string {
    const sections = parseChangelogSections(changelog)
    // conventional-changelog emits heading-only sections for releases without
    // notable commits; drop them so such updates use the dialog's fallback
    // text instead of rendering a bare version heading.
    const withBody = sections.filter(
        (section) => '' !== section.markdown.split('\n').slice(1).join('').trim()
    )
    const relevant = withBody.filter((section) => {
        if (compareSemver(section.version, currentVersion) > 0) {
            return false
        }
        if (undefined === sinceVersion) {
            return section.version === currentVersion
        }
        return compareSemver(section.version, sinceVersion) > 0
    })
    // Sections are separated by a horizontal rule so the dialog can render a
    // clear visual break between versions.
    return relevant
        .slice(0, maxSections)
        .map((section) => section.markdown)
        .join('\n\n---\n\n')
        .trim()
}
