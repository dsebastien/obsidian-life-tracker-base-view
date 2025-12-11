/**
 * Updates the version in package.json to the specified version.
 * Usage: bun scripts/update-version.ts <version>
 * Version can optionally have a 'v' prefix which will be stripped.
 */

const VERSION_REGEX = /^v?(\d+\.\d+\.\d+)$/

export function parseVersion(input: string): string {
    const match = input.match(VERSION_REGEX)
    if (!match?.[1]) {
        throw new Error(`Invalid version format: "${input}". Expected format: x.y.z or vx.y.z`)
    }
    return match[1]
}

export async function updatePackageVersion(version: string): Promise<void> {
    const packageFile = Bun.file('package.json')
    const packageJson = await packageFile.json()
    packageJson.version = version
    await Bun.write(packageFile, JSON.stringify(packageJson, null, 4) + '\n')
    console.log(`Updated package.json version to ${version}`)
}

// Only run if executed directly
if (import.meta.main) {
    const version = process.argv[2]
    if (!version) {
        console.error('Usage: bun scripts/update-version.ts <version>')
        console.error('Example: bun scripts/update-version.ts 1.2.3')
        console.error('Example: bun scripts/update-version.ts v1.2.3')
        process.exit(1)
    }

    const parsedVersion = parseVersion(version)
    await updatePackageVersion(parsedVersion)
}
