import { format, getISOWeek, getQuarter, isValid, parse, setISOWeek, startOfWeek } from 'date-fns'
import { TimeGranularity, type DatePattern } from '../app/types'
import { log } from './log.utils'

/**
 * Filename date parsing.
 *
 * Two layers, tried in order by `parseDateFromFilename`:
 *
 * 1. User-configured patterns written with `{{token}}` placeholders
 *    (issue #139), compiled to anchored regexes once and stored in this
 *    module (see `setCustomFilenameDatePatterns`).
 * 2. The built-in ISO-ish patterns, always available as a fallback so vaults
 *    that never configure anything keep working.
 *
 * The token vocabulary matches the one used across the other plugins in this
 * family (`{{year}}`, `{{quarter}}`, `{{month}}`, `{{week}}`, `{{date}}`), so
 * users only learn it once.
 */

/**
 * Tokens usable in a filename date pattern
 */
export type FilenameDateTokenName = 'date' | 'year' | 'month' | 'day' | 'week' | 'quarter'

/**
 * Definition of a filename date token: what it matches, what it means, and how
 * it renders for a given date (used for the settings preview)
 */
export interface FilenameDateTokenDefinition {
    /** Token name, used as `{{name}}` in patterns */
    name: FilenameDateTokenName
    /** Regex source matching the token's value (must not contain groups) */
    matcher: string
    /** Human-readable description shown in the settings UI */
    description: string
    /** Render the token for a given date (settings preview) */
    render: (date: Date) => string
}

/**
 * Supported tokens, in the order they are presented to users
 */
export const FILENAME_DATE_TOKENS: readonly FilenameDateTokenDefinition[] = [
    {
        name: 'date',
        matcher: '\\d{4}-\\d{2}-\\d{2}',
        description: 'Full ISO date, same as {{year}}-{{month}}-{{day}}',
        render: (date: Date): string => format(date, 'yyyy-MM-dd')
    },
    {
        name: 'year',
        matcher: '\\d{4}',
        description: 'Four-digit year',
        render: (date: Date): string => format(date, 'yyyy')
    },
    {
        name: 'month',
        matcher: '\\d{2}',
        description: 'Two-digit month (01-12)',
        render: (date: Date): string => format(date, 'MM')
    },
    {
        name: 'day',
        matcher: '\\d{2}',
        description: 'Two-digit day of the month (01-31)',
        render: (date: Date): string => format(date, 'dd')
    },
    {
        name: 'week',
        matcher: '\\d{1,2}',
        description: 'ISO week number, with or without leading zero',
        render: (date: Date): string => String(getISOWeek(date)).padStart(2, '0')
    },
    {
        name: 'quarter',
        matcher: 'Q[1-4]',
        description: 'Quarter, including the Q prefix',
        render: (date: Date): string => `Q${getQuarter(date)}`
    }
]

const TOKEN_DEFINITIONS_BY_NAME = new Map<string, FilenameDateTokenDefinition>(
    FILENAME_DATE_TOKENS.map((token) => [token.name, token])
)

/** Matches `{{token}}` placeholders (whitespace tolerant, case-insensitive) */
const TOKEN_REGEX = /\{\{\s*([a-zA-Z]+)\s*\}\}/g

/**
 * A pattern compiled into something `parseDateFromFilename` can run
 */
export interface CompiledFilenameDatePattern {
    /** The original pattern, kept for logging and debugging */
    source: string
    /** Anchored, case-insensitive regex matching a full basename */
    regex: RegExp
    /** Granularity inferred from the tokens used */
    granularity: TimeGranularity
    /** Token for each capture group of `regex`, in order */
    groups: FilenameDateTokenName[]
}

/**
 * Result of compiling a pattern: either a usable pattern or a user-facing error
 */
export type FilenameDatePatternCompilation =
    | { ok: true; compiled: CompiledFilenameDatePattern }
    | { ok: false; error: string }

/** Wildcard character usable in patterns to match arbitrary text */
const WILDCARD = '*'

/** Escape regex metacharacters in literal parts of a pattern */
function escapeRegExp(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Turn a literal chunk of a pattern into regex source, keeping `*` as a
 * wildcard (`*` cannot appear in a filename, so it is unambiguous)
 */
function literalToRegexSource(literal: string): string {
    return literal
        .split(WILDCARD)
        .map((part) => escapeRegExp(part))
        .join('.*')
}

/**
 * Infer the granularity a token set describes
 */
function inferGranularity(tokens: Set<FilenameDateTokenName>): TimeGranularity {
    if (tokens.has('date') || tokens.has('day')) {
        return TimeGranularity.Daily
    }
    if (tokens.has('week')) {
        return TimeGranularity.Weekly
    }
    if (tokens.has('quarter')) {
        return TimeGranularity.Quarterly
    }
    if (tokens.has('month')) {
        return TimeGranularity.Monthly
    }
    return TimeGranularity.Yearly
}

/**
 * Validate the combination of tokens used in a pattern.
 * Returns an error message, or null when the combination is usable.
 */
function validateTokenCombination(tokens: Set<FilenameDateTokenName>): string | null {
    if (!tokens.has('date') && !tokens.has('year')) {
        return 'Pattern must contain {{date}} or {{year}}'
    }

    if (tokens.has('date')) {
        const conflicting = (['year', 'month', 'day', 'week', 'quarter'] as const).filter((name) =>
            tokens.has(name)
        )
        if (conflicting.length > 0) {
            return `{{date}} cannot be combined with {{${conflicting[0]}}}`
        }
        return null
    }

    if (tokens.has('day') && !tokens.has('month')) {
        return '{{day}} requires {{month}}'
    }

    if (tokens.has('week') && (tokens.has('month') || tokens.has('day'))) {
        return '{{week}} cannot be combined with {{month}} or {{day}}'
    }

    if (tokens.has('quarter') && (tokens.has('month') || tokens.has('day'))) {
        return '{{quarter}} cannot be combined with {{month}} or {{day}}'
    }

    if (tokens.has('week') && tokens.has('quarter')) {
        return '{{week}} cannot be combined with {{quarter}}'
    }

    return null
}

/**
 * Compile a filename date pattern.
 * Never throws: unusable patterns come back as `{ ok: false, error }` so both
 * the settings UI and the parser can react without try/catch.
 */
export function compileFilenameDatePattern(pattern: string): FilenameDatePatternCompilation {
    const trimmed = pattern.trim()

    if (!trimmed) {
        return { ok: false, error: 'Pattern cannot be empty' }
    }

    const groups: FilenameDateTokenName[] = []
    const seen = new Set<FilenameDateTokenName>()
    let regexSource = ''
    let lastIndex = 0

    // Reset the shared regex: it is global, so lastIndex would leak between calls
    TOKEN_REGEX.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = TOKEN_REGEX.exec(trimmed)) !== null) {
        const rawName = match[1]
        if (!rawName) continue

        const name = rawName.toLowerCase()
        const definition = TOKEN_DEFINITIONS_BY_NAME.get(name)

        if (!definition) {
            const available = FILENAME_DATE_TOKENS.map((token) => `{{${token.name}}}`).join(', ')
            return { ok: false, error: `Unknown token {{${rawName}}}. Available: ${available}` }
        }

        if (seen.has(definition.name)) {
            return { ok: false, error: `{{${definition.name}}} appears more than once` }
        }

        regexSource += literalToRegexSource(trimmed.slice(lastIndex, match.index))
        regexSource += `(${definition.matcher})`
        groups.push(definition.name)
        seen.add(definition.name)
        lastIndex = match.index + match[0].length
    }

    if (groups.length === 0) {
        return { ok: false, error: 'Pattern must contain at least one {{token}}' }
    }

    // Reject leftover braces: a typo like `{{year}` would silently become a literal
    const remainder = trimmed.slice(lastIndex)
    if (remainder.includes('{') || remainder.includes('}')) {
        return { ok: false, error: 'Unbalanced {{ }} in pattern' }
    }

    regexSource += literalToRegexSource(remainder)

    const combinationError = validateTokenCombination(seen)
    if (combinationError) {
        return { ok: false, error: combinationError }
    }

    return {
        ok: true,
        compiled: {
            source: trimmed,
            regex: new RegExp(`^${regexSource}$`, 'i'),
            granularity: inferGranularity(seen),
            groups
        }
    }
}

/**
 * Validate a pattern for the settings UI
 */
export function validateFilenameDatePattern(pattern: string): {
    isValid: boolean
    error?: string
} {
    const result = compileFilenameDatePattern(pattern)
    return result.ok ? { isValid: true } : { isValid: false, error: result.error }
}

/**
 * Render what a filename matching the pattern looks like for a given date.
 * Used by the settings UI to show a live example. Wildcards render as `…`.
 */
export function renderFilenameDatePatternExample(pattern: string, date: Date): string {
    TOKEN_REGEX.lastIndex = 0
    return pattern
        .trim()
        .replace(TOKEN_REGEX, (whole: string, rawName: string): string => {
            const definition = TOKEN_DEFINITIONS_BY_NAME.get(rawName.toLowerCase())
            return definition ? definition.render(date) : whole
        })
        .split(WILDCARD)
        .join('…')
}

/**
 * Fields a matched pattern can provide
 */
interface MatchedDateFields {
    year?: number
    month?: number
    day?: number
    week?: number
    quarter?: number
}

/**
 * Extract the date fields captured by a compiled pattern
 */
function extractFields(
    match: RegExpMatchArray,
    groups: FilenameDateTokenName[]
): MatchedDateFields | null {
    const fields: MatchedDateFields = {}

    for (let index = 0; index < groups.length; index++) {
        const name = groups[index]
        const value = match[index + 1]
        if (!name || value === undefined) {
            return null
        }

        switch (name) {
            case 'date': {
                const parsed = parse(value, 'yyyy-MM-dd', new Date())
                if (!isValid(parsed)) {
                    return null
                }
                fields.year = parsed.getFullYear()
                fields.month = parsed.getMonth() + 1
                fields.day = parsed.getDate()
                break
            }
            case 'year':
                fields.year = parseInt(value, 10)
                break
            case 'month':
                fields.month = parseInt(value, 10)
                break
            case 'day':
                fields.day = parseInt(value, 10)
                break
            case 'week':
                fields.week = parseInt(value, 10)
                break
            case 'quarter':
                fields.quarter = parseInt(value.slice(1), 10)
                break
        }
    }

    return fields
}

/**
 * Build a date from matched fields, according to the pattern's granularity.
 * Returns null for impossible calendar dates (e.g. 2026-02-31).
 */
function buildDate(fields: MatchedDateFields, granularity: TimeGranularity): Date | null {
    const year = fields.year
    if (year === undefined) {
        return null
    }

    switch (granularity) {
        case TimeGranularity.Daily: {
            const month = fields.month
            const day = fields.day
            if (month === undefined || day === undefined) {
                return null
            }
            if (month < 1 || month > 12 || day < 1 || day > 31) {
                return null
            }
            const date = new Date(year, month - 1, day)
            // Reject overflow (February 31st rolls over to March)
            if (date.getMonth() !== month - 1 || date.getDate() !== day) {
                return null
            }
            return isValid(date) ? date : null
        }

        case TimeGranularity.Weekly: {
            const week = fields.week
            if (week === undefined) {
                return null
            }
            return getDateFromISOWeek(year, week)
        }

        case TimeGranularity.Quarterly: {
            const quarter = fields.quarter
            if (quarter === undefined || quarter < 1 || quarter > 4) {
                return null
            }
            const date = new Date(year, (quarter - 1) * 3, 1)
            return isValid(date) ? date : null
        }

        case TimeGranularity.Monthly: {
            const month = fields.month
            if (month === undefined || month < 1 || month > 12) {
                return null
            }
            const date = new Date(year, month - 1, 1)
            return isValid(date) ? date : null
        }

        case TimeGranularity.Yearly: {
            const date = new Date(year, 0, 1)
            return isValid(date) ? date : null
        }

        default:
            return null
    }
}

/**
 * Match a basename against a compiled pattern
 */
export function matchFilenameDatePattern(
    basename: string,
    compiled: CompiledFilenameDatePattern
): { date: Date; granularity: TimeGranularity } | null {
    const match = basename.match(compiled.regex)
    if (!match) {
        return null
    }

    const fields = extractFields(match, compiled.groups)
    if (!fields) {
        return null
    }

    const date = buildDate(fields, compiled.granularity)
    return date ? { date, granularity: compiled.granularity } : null
}

/**
 * Built-in filename patterns, always tried after the configured ones
 */
const BUILT_IN_DATE_PATTERNS: DatePattern[] = [
    {
        // Daily: YYYY-MM-DD
        regex: /^(\d{4})-(\d{2})-(\d{2})$/,
        granularity: TimeGranularity.Daily,
        parser: (match: RegExpMatchArray): Date | null => {
            const dateStr = match[0]
            if (!dateStr) return null
            const date = parse(dateStr, 'yyyy-MM-dd', new Date())
            return isValid(date) ? date : null
        }
    },
    {
        // Weekly: YYYY-Www (ISO week)
        regex: /^(\d{4})-W(\d{2})$/,
        granularity: TimeGranularity.Weekly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            const weekStr = match[2]
            if (!yearStr || !weekStr) return null
            const year = parseInt(yearStr, 10)
            const week = parseInt(weekStr, 10)
            return getDateFromISOWeek(year, week)
        }
    },
    {
        // Monthly: YYYY-MM
        regex: /^(\d{4})-(\d{2})$/,
        granularity: TimeGranularity.Monthly,
        parser: (match: RegExpMatchArray): Date | null => {
            const dateStr = match[0]
            if (!dateStr) return null
            const date = parse(dateStr, 'yyyy-MM', new Date())
            return isValid(date) ? date : null
        }
    },
    {
        // Quarterly: YYYY-Qq
        regex: /^(\d{4})-Q([1-4])$/,
        granularity: TimeGranularity.Quarterly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            const quarterStr = match[2]
            if (!yearStr || !quarterStr) return null
            const year = parseInt(yearStr, 10)
            const quarter = parseInt(quarterStr, 10)
            const month = (quarter - 1) * 3
            const date = new Date(year, month, 1)
            return isValid(date) ? date : null
        }
    },
    {
        // Yearly: YYYY
        regex: /^(\d{4})$/,
        granularity: TimeGranularity.Yearly,
        parser: (match: RegExpMatchArray): Date | null => {
            const yearStr = match[1]
            if (!yearStr) return null
            const year = parseInt(yearStr, 10)
            const date = new Date(year, 0, 1)
            return isValid(date) ? date : null
        }
    }
]

/**
 * Configured patterns, compiled once when settings load or change
 */
let customPatterns: CompiledFilenameDatePattern[] = []

/**
 * Replace the configured filename date patterns (called from plugin settings).
 * Invalid patterns are skipped, never thrown: settings on disk can be edited
 * by hand, and one bad entry must not break date resolution for the rest.
 */
export function setCustomFilenameDatePatterns(patterns: string[]): void {
    const compiled: CompiledFilenameDatePattern[] = []

    for (const pattern of patterns) {
        const result = compileFilenameDatePattern(pattern)
        if (result.ok) {
            compiled.push(result.compiled)
        } else {
            log(`Ignoring invalid filename date pattern "${pattern}": ${result.error}`, 'warn')
        }
    }

    customPatterns = compiled
}

/**
 * The currently configured (and valid) filename date patterns
 */
export function getCustomFilenameDatePatterns(): readonly CompiledFilenameDatePattern[] {
    return customPatterns
}

/**
 * Parse a date from a filename (without extension).
 * Configured patterns win over the built-in ones (issue #139).
 */
export function parseDateFromFilename(
    filename: string
): { date: Date; granularity: TimeGranularity } | null {
    for (const pattern of customPatterns) {
        const result = matchFilenameDatePattern(filename, pattern)
        if (result) {
            return result
        }
    }

    for (const pattern of BUILT_IN_DATE_PATTERNS) {
        const match = filename.match(pattern.regex)
        if (match) {
            const date = pattern.parser(match)
            if (date) {
                return { date, granularity: pattern.granularity }
            }
        }
    }

    return null
}

/**
 * Get date from ISO week number
 * Returns the Monday of the given ISO week
 */
export function getDateFromISOWeek(year: number, week: number): Date | null {
    if (week < 1 || week > 53) return null

    // Start with January 4th of the year (always in week 1)
    const jan4 = new Date(year, 0, 4)
    // Set to the target ISO week, which gives us a date in that week
    const targetDate = setISOWeek(jan4, week)
    // Get the Monday of that week (ISO weeks start on Monday)
    const monday = startOfWeek(targetDate, { weekStartsOn: 1 })

    return isValid(monday) ? monday : null
}
