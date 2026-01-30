#!/usr/bin/env npx tsx
/**
 * Calculates the next semantic version based on conventional commits since the last tag.
 *
 * Rules:
 * - BREAKING CHANGE: or ! suffix -> major bump
 * - feat: -> minor bump
 * - fix:, docs:, chore:, style:, refactor:, perf:, test:, build:, ci: -> patch bump
 *
 * Usage: npx tsx scripts/calculate-next-version.ts
 * Output: Prints the suggested next version to stdout
 */

import { execSync } from 'child_process'

type BumpType = 'major' | 'minor' | 'patch' | 'none'

interface VersionInfo {
    currentVersion: string
    nextVersion: string
    bumpType: BumpType
    commits: string[]
}

function getLatestTag(): string | null {
    try {
        const tag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
            encoding: 'utf-8'
        }).trim()
        return tag || null
    } catch {
        return null
    }
}

function getCommitsSinceTag(tag: string | null): string[] {
    try {
        const range = tag ? `${tag}..HEAD` : 'HEAD'
        const output = execSync(`git log ${range} --pretty=format:"%s" 2>/dev/null`, {
            encoding: 'utf-8'
        })
        return output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
    } catch {
        return []
    }
}

function analyzeBumpType(commits: string[]): BumpType {
    let bumpType: BumpType = 'none'

    for (const commit of commits) {
        // Skip release commits
        if (commit.startsWith('chore(release)')) {
            continue
        }

        // Check for breaking changes (major bump)
        if (
            commit.includes('BREAKING CHANGE') ||
            commit.includes('BREAKING-CHANGE') ||
            /^[a-z]+(\([^)]+\))?!:/.test(commit)
        ) {
            return 'major'
        }

        // Check for features (minor bump)
        if (/^feat(\([^)]+\))?:/.test(commit)) {
            if (bumpType !== 'major') {
                bumpType = 'minor'
            }
        }

        // Check for fixes and other patch-level changes
        if (
            /^(fix|docs|style|refactor|perf|test|build|ci|chore)(\([^)]+\))?:/.test(commit) &&
            !commit.startsWith('chore(release)')
        ) {
            if (bumpType === 'none') {
                bumpType = 'patch'
            }
        }
    }

    return bumpType
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
    // Remove 'v' prefix if present
    const cleanVersion = version.replace(/^v/, '')
    const parts = cleanVersion.split('.')

    return {
        major: parseInt(parts[0] ?? '0', 10),
        minor: parseInt(parts[1] ?? '0', 10),
        patch: parseInt(parts[2] ?? '0', 10)
    }
}

function incrementVersion(version: string, bumpType: BumpType): string {
    const { major, minor, patch } = parseVersion(version)

    switch (bumpType) {
        case 'major':
            return `${major + 1}.0.0`
        case 'minor':
            return `${major}.${minor + 1}.0`
        case 'patch':
            return `${major}.${minor}.${patch + 1}`
        case 'none':
            return `${major}.${minor}.${patch}`
    }
}

export function calculateNextVersion(): VersionInfo {
    const latestTag = getLatestTag()
    const currentVersion = latestTag ?? '0.0.0'
    const commits = getCommitsSinceTag(latestTag)
    let bumpType = analyzeBumpType(commits)

    // If this is the first release (no previous tags) and no conventional commits were found,
    // default to patch bump so we get at least 0.0.1 instead of 0.0.0
    if (!latestTag && bumpType === 'none' && commits.length > 0) {
        bumpType = 'patch'
    }

    const nextVersion = incrementVersion(currentVersion, bumpType)

    return {
        currentVersion,
        nextVersion,
        bumpType,
        commits
    }
}

// Only run if executed directly
const isMain = process.argv[1]?.endsWith('calculate-next-version.ts')
if (isMain) {
    const info = calculateNextVersion()

    // Check for --json flag
    if (process.argv.includes('--json')) {
        console.log(JSON.stringify(info, null, 2))
    } else if (process.argv.includes('--verbose')) {
        console.log(`Current version: ${info.currentVersion}`)
        console.log(`Bump type: ${info.bumpType}`)
        console.log(`Commits since last tag: ${info.commits.length}`)
        if (info.commits.length > 0) {
            console.log('\nCommits:')
            info.commits.slice(0, 10).forEach((commit) => console.log(`  - ${commit}`))
            if (info.commits.length > 10) {
                console.log(`  ... and ${info.commits.length - 10} more`)
            }
        }
        console.log(`\nSuggested next version: ${info.nextVersion}`)
    } else {
        // Default: just print the next version
        console.log(info.nextVersion)
    }
}
