import type { ValuePolarity } from '../types'
import type { VisualizationDataPoint } from '../types'
import { isBooleanSeries } from './completion.utils'

/**
 * A personal record: the best raw entry value ever recorded for a property
 * (issue #56). "Best" follows the property's polarity — highest value when
 * higher is better, lowest when lower is better.
 */
export interface PersonalRecord {
    value: number
    /** Date anchor of the record entry, when it has one */
    date: Date | null
    filePath: string
}

/**
 * Compute the personal record over raw entry values (issue #56).
 *
 * Polarity is the opt-in: a `neutral` (or absent) polarity yields no record,
 * per the no-judgement rule — the plugin cannot call a value a "best" without
 * knowing which direction is good. Records read the raw entries, not the
 * period aggregates: "longest meditation: 30 min" is a single session, not a
 * daily average.
 *
 * Ties keep the earliest entry: a record is set by whoever reached it first.
 *
 * Boolean series never get a record (issue #161): the best possible value is
 * always `true`, so every ticked entry ties for "best" and the chip would say
 * nothing. Callers render a completion chip in its place.
 *
 * That is decided from the values rather than from the property definition,
 * which is optional and can be stale.
 */
export function computeRecord(
    dataPoints: VisualizationDataPoint[],
    polarity: ValuePolarity | undefined
): PersonalRecord | null {
    if (polarity !== 'higher-is-better' && polarity !== 'lower-is-better') return null
    if (isBooleanSeries(dataPoints)) return null

    let best: PersonalRecord | null = null

    for (const point of dataPoints) {
        if (point.numericValue === null) continue

        const beats =
            best === null ||
            (polarity === 'higher-is-better'
                ? point.numericValue > best.value
                : point.numericValue < best.value)

        if (beats) {
            best = {
                value: point.numericValue,
                date: point.dateAnchor?.date ?? null,
                filePath: point.filePath
            }
        }
    }

    return best
}

/**
 * Whether a freshly computed record strictly beats the previously known one.
 * Used to decide when a "New record!" notice is warranted (issue #56): only a
 * strict improvement during the session counts — re-rendering the same data
 * must stay silent.
 */
export function isRecordImprovement(
    previousValue: number | null,
    record: PersonalRecord | null,
    polarity: ValuePolarity | undefined
): boolean {
    if (record === null || previousValue === null) return false
    if (polarity === 'higher-is-better') return record.value > previousValue
    if (polarity === 'lower-is-better') return record.value < previousValue
    return false
}

/**
 * Format a record value for display: integers stay bare, fractions keep up to
 * two decimals.
 */
export function formatRecordValue(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

/**
 * One announcement per property + value across every visualization showing it
 * (issue #56): a property rendered as both a heatmap and a line chart must not
 * toast twice for the same new record.
 */
const announcedRecords = new Map<string, number>()

/** How long a property+value announcement suppresses duplicates */
const ANNOUNCE_WINDOW_MS = 10_000

/**
 * Whether this record announcement should be shown, registering it as shown
 * when yes. Callers pass the property ID and record value; duplicates within
 * the window are suppressed.
 */
export function shouldAnnounceRecord(propertyId: string, value: number): boolean {
    const key = `${propertyId}:${value}`
    const now = Date.now()

    // Drop stale entries so the map cannot grow unbounded
    for (const [existingKey, timestamp] of announcedRecords) {
        if (now - timestamp > ANNOUNCE_WINDOW_MS) {
            announcedRecords.delete(existingKey)
        }
    }

    if (announcedRecords.has(key)) return false
    announcedRecords.set(key, now)
    return true
}
