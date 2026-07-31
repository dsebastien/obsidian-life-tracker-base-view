/**
 * Updates manifest.json and versions.json with the target version.
 * The target version is read from npm_package_version environment variable.
 * Usage: npm_package_version=1.2.3 bun scripts/version-bump.ts
 */

import { file } from 'bun'

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

export async function readManifest(): Promise<ManifestJson> {
    const manifestFile = file('manifest.json')
    return (await manifestFile.json()) as ManifestJson
}

export async function writeManifest(manifest: ManifestJson): Promise<void> {
    const manifestFile = file('manifest.json')
    await Bun.write(manifestFile, JSON.stringify(manifest, null, 4) + '\n')
}

export async function readVersions(): Promise<VersionsJson> {
    const versionsFile = file('versions.json')
    return (await versionsFile.json()) as VersionsJson
}

export async function writeVersions(versions: VersionsJson): Promise<void> {
    const versionsFile = file('versions.json')
    await Bun.write(versionsFile, JSON.stringify(versions, null, 4) + '\n')
}

/**
 * Compare two SemVer strings. Returns a negative number when `a` sorts before
 * `b`, positive when after, 0 when equal.
 */
function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
        if (diff !== 0) return diff
    }
    return 0
}

/**
 * The `version -> minAppVersion` map after recording a release.
 *
 * `versions.json` exists so Obsidian can serve an **older** plugin version to a
 * user whose app is too old for the current one. It is only consulted on that
 * fallback path — a user whose app satisfies `manifest.json`'s `minAppVersion`
 * gets the latest release without it being read at all.
 *
 * So an entry only carries information where the minimum actually **changed**.
 * Recording every release would just restate the previous answer under a new
 * key. The comparison is against the highest version already recorded, not
 * against "any value present", so a minimum that goes back down is still
 * recorded — that release genuinely widens compatibility again.
 */
export function recordVersion(
    versions: VersionsJson,
    targetVersion: string,
    minAppVersion: string
): VersionsJson {
    const latest = Object.keys(versions).sort(compareSemver).at(-1)
    const currentMin = latest === undefined ? undefined : versions[latest]

    if (currentMin === minAppVersion) {
        return versions
    }

    return { ...versions, [targetVersion]: minAppVersion }
}

export async function bumpVersion(targetVersion: string): Promise<void> {
    // Read and update manifest.json
    const manifest = await readManifest()
    const { minAppVersion } = manifest
    manifest.version = targetVersion
    await writeManifest(manifest)
    console.log(`Updated manifest.json version to ${targetVersion}`)

    // Record this release in versions.json, but only when it changes the
    // minimum app version — see `recordVersion`
    const versions = await readVersions()
    const updated = recordVersion(versions, targetVersion, minAppVersion)
    if (updated === versions) {
        console.log(`versions.json unchanged: ${targetVersion} still needs ${minAppVersion}`)
        return
    }
    await writeVersions(updated)
    console.log(`Recorded ${targetVersion} -> ${minAppVersion} in versions.json`)
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
