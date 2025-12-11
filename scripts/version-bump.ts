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

export async function bumpVersion(targetVersion: string): Promise<void> {
    // Read and update manifest.json
    const manifest = await readManifest()
    const { minAppVersion } = manifest
    manifest.version = targetVersion
    await writeManifest(manifest)
    console.log(`Updated manifest.json version to ${targetVersion}`)

    // Update versions.json if this minAppVersion is not already tracked
    const versions = await readVersions()
    if (!Object.values(versions).includes(minAppVersion)) {
        versions[targetVersion] = minAppVersion
        await writeVersions(versions)
        console.log(`Added ${targetVersion} -> ${minAppVersion} to versions.json`)
    } else {
        console.log(`versions.json already contains minAppVersion ${minAppVersion}`)
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
