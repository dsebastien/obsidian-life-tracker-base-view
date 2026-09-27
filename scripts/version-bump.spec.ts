import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ManifestJson, VersionsJson } from './version-bump'

describe('ManifestJson interface', () => {
    test('valid manifest structure', () => {
        const manifest: ManifestJson = {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            minAppVersion: '1.4.0'
        }

        expect(manifest.id).toBe('test-plugin')
        expect(manifest.name).toBe('Test Plugin')
        expect(manifest.version).toBe('1.0.0')
        expect(manifest.minAppVersion).toBe('1.4.0')
    })

    test('manifest allows additional properties', () => {
        const manifest: ManifestJson = {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            minAppVersion: '1.4.0',
            author: 'Test Author',
            description: 'A test plugin'
        }

        expect(manifest['author']).toBe('Test Author')
        expect(manifest['description']).toBe('A test plugin')
    })
})

describe('VersionsJson interface', () => {
    test('valid versions structure', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0',
            '1.1.0': '1.0.0'
        }

        expect(versions['1.0.0']).toBe('0.15.0')
        expect(versions['1.1.0']).toBe('1.0.0')
    })

    test('versions keys should be semver', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0'
        }

        const key = Object.keys(versions)[0]
        expect(key).toMatch(/^\d+\.\d+\.\d+$/)
    })

    test('versions values should be semver', () => {
        const versions: VersionsJson = {
            '1.0.0': '0.15.0'
        }

        const value = Object.values(versions)[0]
        expect(value).toMatch(/^\d+\.\d+\.\d+$/)
    })
})

describe('version format validation', () => {
    test('valid semver formats', () => {
        const validVersions = ['0.0.1', '1.0.0', '1.2.3', '10.20.30']
        const semverRegex = /^\d+\.\d+\.\d+$/

        for (const version of validVersions) {
            expect(version).toMatch(semverRegex)
        }
    })

    test('invalid semver formats', () => {
        const invalidVersions = ['1.0', '1', 'v1.0.0', '1.0.0-beta', '1.0.0.0']
        const semverRegex = /^\d+\.\d+\.\d+$/

        for (const version of invalidVersions) {
            expect(version).not.toMatch(semverRegex)
        }
    })
})

describe('compareVersions', () => {
    test('compares numerically, not lexicographically', async () => {
        const { compareVersions } = await import('./version-bump')
        expect(compareVersions('1.10.0', '1.8.7')).toBeGreaterThan(0)
        expect(compareVersions('1.8.7', '1.10.0')).toBeLessThan(0)
        expect(compareVersions('1.13.0', '1.13.0')).toBe(0)
    })

    test('refuses anything that is not x.y.z', async () => {
        const { compareVersions } = await import('./version-bump')
        expect(() => compareVersions('1.0.0-beta', '1.0.0')).toThrow()
    })
})

describe('nextVersions', () => {
    const versions = { '0.2.4': '1.10.0' }

    test('a raised floor adds one line: the last release on the old floor', async () => {
        const { nextVersions } = await import('./version-bump')
        // obsidian-bookshelf: 0.6.0 shipped on 1.10.0, 1.0.0 needs 1.13.0.
        // Obsidian 1.10 to 1.12 users must get 0.6.0, not 0.2.4.
        expect(
            nextVersions(versions, { version: '0.6.0', minAppVersion: '1.10.0' }, '1.13.0')
        ).toEqual({
            '0.2.4': '1.10.0',
            '0.6.0': '1.10.0'
        })
    })

    test('floors compare numerically: 1.10.0 is a raise over 1.8.7', async () => {
        const { nextVersions } = await import('./version-bump')
        expect(nextVersions({}, { version: '2.0.0', minAppVersion: '1.8.7' }, '1.10.0')).toEqual({
            '2.0.0': '1.8.7'
        })
    })

    test('an unchanged floor adds nothing', async () => {
        const { nextVersions } = await import('./version-bump')
        expect(
            nextVersions(versions, { version: '0.6.0', minAppVersion: '1.10.0' }, '1.10.0')
        ).toBe(null)
    })

    test('a lowered floor adds nothing', async () => {
        const { nextVersions } = await import('./version-bump')
        expect(nextVersions(versions, { version: '0.6.0', minAppVersion: '1.10.0' }, '1.8.7')).toBe(
            null
        )
    })

    test('the first release adds nothing', async () => {
        const { nextVersions } = await import('./version-bump')
        expect(nextVersions({}, null, '1.13.0')).toBe(null)
    })

    test('a line already present is not written again', async () => {
        const { nextVersions } = await import('./version-bump')
        const listed = { '0.6.0': '1.10.0' }
        expect(nextVersions(listed, { version: '0.6.0', minAppVersion: '1.10.0' }, '1.13.0')).toBe(
            null
        )
    })

    test('refuses a version that is not x.y.z', async () => {
        const { nextVersions } = await import('./version-bump')
        expect(() => nextVersions({}, null, 'latest')).toThrow()
        expect(() =>
            nextVersions({}, { version: '1.0.0-beta', minAppVersion: '1.4.0' }, '1.8.7')
        ).toThrow()
    })
})

describe('bumpVersion', () => {
    // Runs the real read-decide-write path, including the previous release's
    // floor read from its git tag, in a throwaway repository. git runs through
    // gitIn, so a GIT_DIR or GIT_INDEX_FILE set by a hook can never point it
    // at the real repository, and commits skip hooks.
    let root: string

    // Each test spawns several real git processes; on a loaded CI runner
    // that alone passed Bun's 5 s default (7.9 s seen in one repo's CI).
    const GIT_TEST_TIMEOUT_MS = 60_000

    const git = async (...args: string[]) => {
        const { gitIn } = await import('./version-bump')
        const result = await gitIn(root)([
            '-c',
            'user.name=spec',
            '-c',
            'user.email=spec@example.com',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'tag.gpgsign=false',
            ...args
        ])
        if (result.exitCode !== 0) {
            throw new Error(`git ${args.join(' ')}: ${result.stderr.toString()}`)
        }
    }

    const writeManifest = (manifest: Record<string, string>) =>
        Bun.write(join(root, 'manifest.json'), JSON.stringify({ id: 'x', name: 'X', ...manifest }))

    const releaseTagged = async (version: string, minAppVersion: string) => {
        await writeManifest({ version, minAppVersion })
        await git('add', '-A')
        await git('commit', '-q', '--no-verify', '-m', `release ${version}`)
        await git('tag', version)
    }

    const versionsText = () => Bun.file(join(root, 'versions.json')).text()

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'version-bump-spec-'))
        await git('init', '-q')
        await Bun.write(
            join(root, 'versions.json'),
            JSON.stringify({ '0.2.4': '1.10.0' }, null, 4) + '\n'
        )
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    test(
        'a raised floor records the last release before it, read from its tag',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await releaseTagged('0.6.0', '1.10.0')
            await writeManifest({ version: '0.6.0', minAppVersion: '1.13.0' }) // raised during development
            await bumpVersion('1.0.0', root)
            const manifest = (await Bun.file(join(root, 'manifest.json')).json()) as {
                version: string
            }
            expect(manifest.version).toBe('1.0.0')
            expect(JSON.parse(await versionsText())).toEqual({
                '0.2.4': '1.10.0',
                '0.6.0': '1.10.0'
            })
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'the previous release comes from the tags, not from a hand-bumped manifest',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await releaseTagged('0.5.0', '1.8.7')
            await releaseTagged('0.6.0', '1.10.0')
            await writeManifest({ version: '0.7.0', minAppVersion: '1.13.0' }) // no 0.7.0 release exists
            await bumpVersion('1.0.0', root)
            expect(JSON.parse(await versionsText())).toEqual({
                '0.2.4': '1.10.0',
                '0.6.0': '1.10.0'
            })
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'a stale value for the previous release is corrected',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await Bun.write(join(root, 'versions.json'), JSON.stringify({ '0.6.0': '1.4.0' }))
            await releaseTagged('0.6.0', '1.10.0')
            await writeManifest({ version: '0.6.0', minAppVersion: '1.13.0' })
            await bumpVersion('1.0.0', root)
            expect(JSON.parse(await versionsText())).toEqual({ '0.6.0': '1.10.0' })
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'an unchanged floor leaves versions.json byte-identical',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await releaseTagged('0.6.0', '1.10.0')
            const before = await versionsText()
            await bumpVersion('0.6.1', root)
            expect(await versionsText()).toBe(before)
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'a lowered floor leaves versions.json byte-identical',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await releaseTagged('0.6.0', '1.13.0')
            await writeManifest({ version: '0.6.0', minAppVersion: '1.10.0' })
            const before = await versionsText()
            await bumpVersion('0.7.0', root)
            expect(await versionsText()).toBe(before)
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'the first release (no tag at all) leaves versions.json byte-identical',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await writeManifest({ version: '0.0.0', minAppVersion: '1.13.0' })
            const before = await versionsText()
            await bumpVersion('0.1.0', root)
            expect(await versionsText()).toBe(before)
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'a v-prefixed tag is not a release (Obsidian installs by the exact tag)',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await writeManifest({ version: '0.6.0', minAppVersion: '1.10.0' })
            await git('add', '-A')
            await git('commit', '-q', '--no-verify', '-m', 'v-tagged')
            await git('tag', 'v0.6.0')
            await writeManifest({ version: '0.6.0', minAppVersion: '1.13.0' })
            const before = await versionsText()
            await bumpVersion('1.0.0', root)
            expect(await versionsText()).toBe(before)
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'a tagged manifest without minAppVersion fails loudly, naming the tag',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await Bun.write(
                join(root, 'manifest.json'),
                JSON.stringify({ id: 'x', version: '0.6.0' })
            )
            await git('add', '-A')
            await git('commit', '-q', '--no-verify', '-m', 'broken')
            await git('tag', '0.6.0')
            await expect(bumpVersion('1.0.0', root)).rejects.toThrow(
                'tag 0.6.0 has no minAppVersion'
            )
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'tags that are all above the release fail loudly',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            await releaseTagged('2.0.0', '1.13.0')
            await expect(bumpVersion('1.0.0', root)).rejects.toThrow('No release tag below 1.0.0')
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'outside a git repository it fails loudly instead of skipping the line',
        async () => {
            const { bumpVersion } = await import('./version-bump')
            const bare = await mkdtemp(join(tmpdir(), 'version-bump-nogit-'))
            try {
                await Bun.write(
                    join(bare, 'manifest.json'),
                    JSON.stringify({ version: '0.6.0', minAppVersion: '1.13.0' })
                )
                await Bun.write(join(bare, 'versions.json'), '{}')
                await expect(bumpVersion('1.0.0', bare)).rejects.toThrow('git tag --list failed')
            } finally {
                await rm(bare, { recursive: true, force: true })
            }
        },
        GIT_TEST_TIMEOUT_MS
    )

    test(
        'a GIT_DIR in the environment cannot redirect it to another repository',
        async () => {
            const { readPreviousRelease } = await import('./version-bump')
            await releaseTagged('0.6.0', '1.10.0')
            const saved = process.env['GIT_DIR']
            process.env['GIT_DIR'] = join(tmpdir(), 'no-such-repository')
            try {
                expect(await readPreviousRelease('1.0.0', root)).toEqual({
                    version: '0.6.0',
                    minAppVersion: '1.10.0'
                })
            } finally {
                if (saved === undefined) delete process.env['GIT_DIR']
                else process.env['GIT_DIR'] = saved
            }
        },
        GIT_TEST_TIMEOUT_MS
    )
})
