/**
 * Creates a zip file from the dist directory for release.
 * Usage: bun scripts/create-release-zip.ts [output-name]
 * If output-name is not provided, uses the name from package.json.
 */

import { readdirSync } from 'node:fs'
import { $ } from 'bun'

const DIST = 'dist'

export async function getPackageName(): Promise<string> {
    const packageFile = Bun.file('package.json')
    const packageJson = await packageFile.json()
    return packageJson.name as string
}

export async function createReleaseZip(outputName?: string): Promise<string> {
    const name = outputName ?? (await getPackageName())
    const zipPath = `${DIST}/${name}.zip`

    // Get all files in dist (excluding any existing zip files)
    const files = readdirSync(DIST).filter((f) => !f.endsWith('.zip'))
    if (files.length === 0) {
        throw new Error('dist directory is empty. Run build first.')
    }

    // Remove existing zip if present
    try {
        await $`rm -f ${zipPath}`.quiet()
    } catch {
        // Ignore if file doesn't exist
    }

    // Create zip using system zip command (only include non-zip files)
    await $`cd ${DIST} && zip -r ${name}.zip ${files}`.quiet()

    console.log(`Created ${zipPath} with ${files.length} files:`)
    for (const file of files) {
        console.log(`  - ${file}`)
    }

    return zipPath
}

// Only run if executed directly
if (import.meta.main) {
    const outputName = process.argv[2]
    await createReleaseZip(outputName)
}
