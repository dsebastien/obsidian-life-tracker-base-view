/**
 * Updates manifest.json and versions.json with the target version.
 * The target version is read from npm_package_version environment variable.
 * Usage: npm_package_version=1.2.3 bun scripts/version-bump.ts
 */

import { join } from 'node:path'
import { $, file } from 'bun'

export interface ManifestJson {
    id: string
    name: string
    version: string
    minAppVersion: string
    [key: string]: unknown
}

export interface VersionsJson {
    [version: string]: string
}

export async function readManifest(root = '.'): Promise<ManifestJson> {
    const manifestFile = file(join(root, 'manifest.json'))
    return (await manifestFile.json()) as ManifestJson
}

export async function writeManifest(manifest: ManifestJson, root = '.'): Promise<void> {
    const manifestFile = file(join(root, 'manifest.json'))
    await Bun.write(manifestFile, JSON.stringify(manifest, null, 4) + '\n')
}

export async function readVersions(root = '.'): Promise<VersionsJson> {
    const versionsFile = file(join(root, 'versions.json'))
    return (await versionsFile.json()) as VersionsJson
}

export async function writeVersions(versions: VersionsJson, root = '.'): Promise<void> {
    const versionsFile = file(join(root, 'versions.json'))
    await Bun.write(versionsFile, JSON.stringify(versions, null, 4) + '\n')
}

const RELEASE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/

/** x.y.z as numbers, or null for anything else (pre-releases included). */
function parseVersion(version: string): [number, number, number] | null {
    const match = RELEASE_VERSION.exec(version)
    if (!match) {
        return null
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** Numeric x.y.z comparison; throws on anything that is not x.y.z. */
export function compareVersions(a: string, b: string): number {
    const pa = parseVersion(a)
    const pb = parseVersion(b)
    if (pa === null || pb === null) {
        throw new Error(`Expected x.y.z versions, got "${a}" and "${b}"`)
    }
    for (let i = 0; i < 3; i += 1) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) {
            return diff
        }
    }
    return 0
}

/** Throws unless `version` is x.y.z, the only form Obsidian installs by tag. */
export function assertReleaseVersion(version: string): void {
    if (parseVersion(version) === null) {
        throw new Error(`Expected an x.y.z version, got "${version}"`)
    }
}

/** The release this one follows: its version and the floor it shipped with. */
export interface PreviousRelease {
    version: string
    minAppVersion: string
}

/**
 * versions.json after a release whose minAppVersion is `minAppVersion`, or
 * null when the file must not change.
 *
 * Obsidian reads versions.json only when the latest manifest's minAppVersion
 * is above the user's app version, and installs the highest listed release
 * whose floor the app meets. So the file needs a line only when a release
 * RAISES the floor, and that line names the LAST release on the old floor:
 * users left behind by the raise then get the newest release that still runs
 * for them. An unchanged or lowered floor adds nothing, and so does the first
 * release (the manifest already covers everyone it supports).
 */
export function nextVersions(
    versions: VersionsJson,
    previous: PreviousRelease | null,
    minAppVersion: string
): VersionsJson | null {
    assertReleaseVersion(minAppVersion)
    if (previous === null) {
        return null
    }
    assertReleaseVersion(previous.version)
    assertReleaseVersion(previous.minAppVersion)
    if (compareVersions(minAppVersion, previous.minAppVersion) <= 0) {
        return null
    }
    if (versions[previous.version] === previous.minAppVersion) {
        return null
    }
    return { ...versions, [previous.version]: previous.minAppVersion }
}

/**
 * git in `root`, never in a repository named by the environment: git sets
 * GIT_DIR / GIT_INDEX_FILE / GIT_WORK_TREE for hooks and some worktree
 * setups, and they would override `root`.
 */
export function gitIn(root: string) {
    const env: Record<string, string | undefined> = { ...process.env }
    for (const key of [
        'GIT_DIR',
        'GIT_INDEX_FILE',
        'GIT_WORK_TREE',
        'GIT_PREFIX',
        'GIT_COMMON_DIR'
    ]) {
        delete env[key]
    }
    return (args: string[]) => $`git ${args}`.cwd(root).env(env).quiet().nothrow()
}

/**
 * The release this one follows: the highest x.y.z tag below `targetVersion`,
 * with the floor its manifest shipped. Null only when the repository has no
 * release tag at all (the first release). Anything else that prevents
 * reading it throws: a floor raise must never be skipped silently.
 *
 * Tags are the source, not manifest.json's version: a version bumped by hand,
 * or a release commit pushed by a run that failed before tagging, would name
 * a version with no release.
 */
export async function readPreviousRelease(
    targetVersion: string,
    root = '.'
): Promise<PreviousRelease | null> {
    assertReleaseVersion(targetVersion)
    const git = gitIn(root)
    const listed = await git(['tag', '--list'])
    if (listed.exitCode !== 0) {
        throw new Error(`git tag --list failed in ${root}: ${listed.stderr.toString().trim()}`)
    }
    // Obsidian installs a release by its exact tag, and release.yml only
    // makes bare x.y.z tags, so only those count.
    const tags = listed.stdout
        .toString()
        .split('\n')
        .map((tag) => tag.trim())
        .filter((tag) => parseVersion(tag) !== null)
    if (tags.length === 0) {
        return null
    }
    const earlier = tags.filter((tag) => compareVersions(tag, targetVersion) < 0)
    if (earlier.length === 0) {
        throw new Error(
            `No release tag below ${targetVersion} although tags exist: ${tags.join(', ')}`
        )
    }
    const version = earlier.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b))
    const shown = await git(['show', `${version}:manifest.json`])
    if (shown.exitCode !== 0) {
        throw new Error(
            `Cannot read manifest.json at tag ${version}: ${shown.stderr.toString().trim()}`
        )
    }
    let tagged: Partial<ManifestJson>
    try {
        tagged = JSON.parse(shown.stdout.toString()) as Partial<ManifestJson>
    } catch (error) {
        throw new Error(`manifest.json at tag ${version} is not valid JSON: ${String(error)}`)
    }
    if (typeof tagged.minAppVersion !== 'string') {
        throw new Error(`manifest.json at tag ${version} has no minAppVersion`)
    }
    return { version, minAppVersion: tagged.minAppVersion }
}

export async function bumpVersion(targetVersion: string, root = '.'): Promise<void> {
    const previous = await readPreviousRelease(targetVersion, root)

    // Read and update manifest.json
    const manifest = await readManifest(root)
    const { minAppVersion } = manifest
    manifest.version = targetVersion
    await writeManifest(manifest, root)
    console.log(`Updated manifest.json version to ${targetVersion}`)

    const versions = nextVersions(await readVersions(root), previous, minAppVersion)
    if (versions !== null && previous !== null) {
        await writeVersions(versions, root)
        console.log(
            `Added ${previous.version} -> ${previous.minAppVersion} to versions.json: the last release before the floor rises to ${minAppVersion}`
        )
    } else {
        console.log(`versions.json unchanged: ${minAppVersion} raises no floor`)
    }
}

// Only run if executed directly
if (import.meta.main) {
    const targetVersion = Bun.env['npm_package_version']

    if (!targetVersion) {
        console.error('Error: npm_package_version environment variable is not set.')
        console.error('Usage: npm_package_version=1.2.3 bun scripts/version-bump.ts')
        process.exit(1)
    }

    await bumpVersion(targetVersion)
}
