/**
 * Quick add (issue #122): log a value without walking the capture carousel,
 * either from the quick-add panel or from an `obsidian://life-tracker-quick-add`
 * link. Everything here is pure so it can be specced without Obsidian.
 */
import { TimeGranularity, type PropertyDefinition } from '../types'
import {
    clampToRange,
    extractBoolean,
    extractNumber,
    parseDateFromPath,
    parseListValue,
    startOfDay
} from '../../utils'
import { computeSteppedValue } from '../components/editing/number-step.utils'

/** `obsidian://<action>` the plugin registers for quick-add links */
export const QUICK_ADD_PROTOCOL_ACTION = 'life-tracker-quick-add'

/**
 * Whether a property is listed in the quick-add panel. Opt-in: a type-based
 * default ("all numbers and checkboxes") put 71 rows in a real vault full of
 * synced health metrics, which is the long form quick add exists to avoid.
 */
export function isShownInQuickAdd(definition: PropertyDefinition): boolean {
    return definition.showInQuickAdd === true
}

/**
 * Day the quick-add panel opens on: the open daily note's date when one is
 * open, so an old daily note can be back-filled in place; today otherwise.
 */
export function resolveQuickAddDate(activeFilePath: string | null, now: Date): Date {
    if (activeFilePath) {
        const parsed = parseDateFromPath(activeFilePath)
        if (parsed && parsed.granularity === TimeGranularity.Daily) {
            return startOfDay(parsed.date)
        }
    }
    return startOfDay(now)
}

/** What a quick-add link asks for */
export type QuickAddAction =
    | { kind: 'increment'; amount: number | null }
    | { kind: 'decrement'; amount: number | null }
    | { kind: 'toggle' }
    | { kind: 'set'; value: string }
    /** Add one entry to a list property, e.g. `12@20` (reps@weight) */
    | { kind: 'append'; value: string }

export type QuickAddRequest =
    /** No property: open the panel on `date` (today when null) */
    | { kind: 'open'; date: Date | null }
    | { kind: 'apply'; property: string; action: QuickAddAction; date: Date | null }

export type QuickAddParseResult =
    | { ok: true; request: QuickAddRequest }
    | { ok: false; error: string }

const ACTION_PARAMS = ['increment', 'decrement', 'toggle', 'set', 'append'] as const

/**
 * Parse an ISO day (YYYY-MM-DD) as local midnight. `new Date('2026-10-04')`
 * would be UTC midnight, a day early west of Greenwich.
 */
function parseIsoDay(text: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
    if (!match) return null
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const date = new Date(year, month - 1, day)
    // Reject rollovers such as 2026-02-31
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return null
    }
    return date
}

/**
 * An increment/decrement amount. Obsidian passes a bare flag
 * (`&increment`) as the string "true", which means "one step".
 */
function parseAmount(raw: string): number | null | undefined {
    if (raw === 'true' || raw.trim() === '') return null
    const amount = Number(raw)
    return Number.isFinite(amount) && amount > 0 ? amount : undefined
}

/**
 * Read the parameters of an `obsidian://life-tracker-quick-add` link.
 *
 * - `property`: property name or display name (case-insensitive)
 * - one of `increment[=n]`, `decrement[=n]`, `toggle`, `set=<value>`,
 *   `append=<value>`
 * - `date=YYYY-MM-DD`: optional, today when absent
 *
 * No `property` and no action opens the panel instead.
 */
export function parseQuickAddParams(params: Record<string, string>): QuickAddParseResult {
    let date: Date | null = null
    if (params['date'] !== undefined) {
        date = parseIsoDay(params['date'])
        if (!date) {
            return { ok: false, error: `Invalid date "${params['date']}", expected YYYY-MM-DD` }
        }
    }

    const actions = ACTION_PARAMS.filter((name) => params[name] !== undefined)
    const property = params['property']?.trim() ?? ''

    if (!property && actions.length === 0) {
        return { ok: true, request: { kind: 'open', date } }
    }
    if (!property) {
        return { ok: false, error: 'Missing "property" parameter' }
    }
    if (actions.length === 0) {
        return {
            ok: false,
            error: 'Missing action: add one of increment, decrement, toggle, set=<value> or append=<value>'
        }
    }
    if (actions.length > 1) {
        return { ok: false, error: `Use a single action, got ${actions.join(', ')}` }
    }

    const name = actions[0]!
    const raw = params[name]!
    let action: QuickAddAction
    switch (name) {
        case 'increment':
        case 'decrement': {
            const amount = parseAmount(raw)
            if (amount === undefined) {
                return { ok: false, error: `Invalid ${name} amount "${raw}"` }
            }
            action = { kind: name, amount }
            break
        }
        case 'toggle':
            action = { kind: 'toggle' }
            break
        case 'set':
            action = { kind: 'set', value: raw }
            break
        case 'append': {
            // A bare `&append` arrives as "true": there is nothing to add
            const value = raw === 'true' ? '' : raw.trim()
            if (!value) {
                return { ok: false, error: 'Missing value: use append=<value>' }
            }
            action = { kind: 'append', value }
            break
        }
    }

    return { ok: true, request: { kind: 'apply', property, action, date } }
}

/**
 * Find the definition a link refers to: exact name first, then a
 * case-insensitive match on name or display name.
 */
export function findQuickAddDefinition(
    definitions: PropertyDefinition[],
    reference: string
): PropertyDefinition | null {
    const exact = definitions.find((definition) => definition.name === reference)
    if (exact) return exact

    const lower = reference.toLowerCase()
    return (
        definitions.find(
            (definition) =>
                definition.name.toLowerCase() === lower ||
                definition.displayName.toLowerCase() === lower
        ) ?? null
    )
}

/** Round away binary-float noise from fractional amounts (0.1 + 0.2) */
function roundAmount(value: number): number {
    return Math.round(value * 1e6) / 1e6
}

export type QuickAddValueResult = { ok: true; value: unknown } | { ok: false; error: string }

/**
 * The value an action produces from the property's current value.
 *
 * A bare increment/decrement moves one step, exactly like the −/+ buttons
 * (same start-from-empty and clamping rules). An explicit amount adds to the
 * current value, empty counting as 0, and is clamped to the range too.
 * Range and allowed-value checks beyond clamping are left to validation.
 */
export function applyQuickAddAction(
    definition: PropertyDefinition,
    current: unknown,
    action: QuickAddAction
): QuickAddValueResult {
    const label = definition.displayName || definition.name

    switch (action.kind) {
        case 'increment':
        case 'decrement': {
            if (definition.type !== 'number') {
                return { ok: false, error: `${label} is not a number property` }
            }
            const direction = action.kind === 'increment' ? 1 : -1
            const currentNumber = extractNumber(current)
            if (action.amount === null) {
                return {
                    ok: true,
                    value: computeSteppedValue(currentNumber, direction, definition.numberRange)
                }
            }
            const next = roundAmount((currentNumber ?? 0) + direction * action.amount)
            return { ok: true, value: clampToRange(next, definition.numberRange) ?? next }
        }
        case 'toggle': {
            if (definition.type !== 'checkbox') {
                return { ok: false, error: `${label} is not a checkbox property` }
            }
            return { ok: true, value: !(extractBoolean(current) ?? false) }
        }
        case 'set':
            return parseSetValue(definition, action.value)
        case 'append': {
            if (definition.type !== 'list' && definition.type !== 'tags') {
                return { ok: false, error: `${label} is not a list property; append needs a list` }
            }
            return { ok: true, value: [...parseListValue(current), action.value] }
        }
    }
}

function parseSetValue(definition: PropertyDefinition, raw: string): QuickAddValueResult {
    const label = definition.displayName || definition.name
    const text = raw === 'true' && definition.type !== 'checkbox' ? '' : raw.trim()

    switch (definition.type) {
        case 'number': {
            const value = Number(text)
            if (text === '' || !Number.isFinite(value)) {
                return { ok: false, error: `"${raw}" is not a number` }
            }
            return { ok: true, value }
        }
        case 'checkbox': {
            const value = extractBoolean(text)
            if (value === null) {
                return { ok: false, error: `"${raw}" is not true or false` }
            }
            return { ok: true, value }
        }
        case 'list':
        case 'tags':
            return { ok: false, error: `${label} is a list; quick add cannot set lists` }
        default:
            if (text === '') {
                return { ok: false, error: `Missing value for ${label}` }
            }
            return { ok: true, value: text }
    }
}
