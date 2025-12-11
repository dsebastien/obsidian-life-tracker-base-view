import { file } from 'bun'

const targetVersion = Bun.env.npm_package_version

if (!targetVersion) {
  throw new Error('Target version not found in environment variables.')
}

// Read minAppVersion from manifest.json and bump version to target version
const manifestFile = file('manifest.json')
const manifest = await manifestFile.json()
const { minAppVersion } = manifest
manifest.version = targetVersion
await manifestFile.write(JSON.stringify(manifest, null, 2))

// Update versions.json with target version and minAppVersion from manifest.json
// but only if the target version is not already in versions.json
const versionFile = file('versions.json')
const versions = await versionFile.json()
if (!Object.values(versions).includes(minAppVersion)) {
  versions[targetVersion] = minAppVersion
  await versionFile.write(JSON.stringify(versions, null, 2))
}
