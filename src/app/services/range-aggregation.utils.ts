import { compareAsc } from 'date-fns'
import type { RangeChartData, TimeGranularity, VisualizationDataPoint } from '../types'
import { formatDateByGranularity } from '../../utils'
import { getTimeKey, normalizeDate } from './date-grouping.utils'
import type { OverlayPropertyData } from './chart-aggregation.utils'

/**
 * A value parsed for the range chart's y-axis (issue #81): a position in
 * hours, and whether it came from a time-of-day (which switches the whole
 * chart into time formatting).
 */
export interface ParsedRangeValue {
    hours: number
    isTime: boolean
}

/** Matches bare times of day: "23:30", "7:15", "07:15:30" */
const TIME_OF_DAY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

/** Extracts the time from an ISO-like datetime: "2026-01-01T23:30[:00]" */
const DATETIME_TIME_PATTERN = /T(\d{2}):(\d{2})/

/**
 * Parse a data point's value for the range chart (issue #81).
 *
 * Tried in order: a bare time of day ("23:30"), the time part of an ISO
 * datetime, then the plain numeric value (hours or any other unit). The raw
 * string is read before the numeric value because a text property with a
 * value mapping coerces unmapped strings to 0, which would silently flatten
 * every time to midnight.
 */
export function parseRangeValue(point: VisualizationDataPoint): ParsedRangeValue | null {
    const raw = point.listValues[0] ?? point.displayLabel

    if (raw) {
        const timeMatch = TIME_OF_DAY_PATTERN.exec(raw.trim())
        if (timeMatch) {
            const hours = Number(timeMatch[1])
            const minutes = Number(timeMatch[2])
            const seconds = Number(timeMatch[3] ?? 0)
            if (hours < 24 && minutes < 60 && seconds < 60) {
                return { hours: hours + minutes / 60 + seconds / 3600, isTime: true }
            }
        }

        const datetimeMatch = DATETIME_TIME_PATTERN.exec(raw)
        if (datetimeMatch) {
            return {
                hours: Number(datetimeMatch[1]) + Number(datetimeMatch[2]) / 60,
                isTime: true
            }
        }
    }

    if (point.numericValue !== null) {
        return { hours: point.numericValue, isTime: false }
    }

    return null
}

/**
 * Format a position in hours as a clock time, wrapping past midnight:
 * 23.5 → "23:30", 31.25 → "07:15".
 */
export function formatHoursAsTime(hours: number): string {
    const normalized = ((hours % 24) + 24) % 24
    let wholeHours = Math.floor(normalized)
    let minutes = Math.round((normalized - wholeHours) * 60)
    if (minutes === 60) {
        minutes = 0
        wholeHours = (wholeHours + 1) % 24
    }
    return `${String(wholeHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

interface PeriodValue {
    date: Date
    value: ParsedRangeValue | null
    filePaths: string[]
}

/**
 * Group one property's data points by period, keeping the first parseable
 * value per period (a period rarely carries two bed times; when it does, the
 * first entry wins) and every file path for navigation.
 */
function groupByPeriod(
    dataPoints: VisualizationDataPoint[],
    granularity: TimeGranularity
): Map<string, PeriodValue> {
    const grouped = new Map<string, PeriodValue>()

    for (const point of dataPoints) {
        if (!point.dateAnchor) continue

        const key = getTimeKey(point.dateAnchor.date, granularity)
        let group = grouped.get(key)
        if (!group) {
            group = {
                date: normalizeDate(point.dateAnchor.date, granularity),
                value: null,
                filePaths: []
            }
            grouped.set(key, group)
        }

        group.value ??= parseRangeValue(point)
        group.filePaths.push(point.filePath)
    }

    return grouped
}

/**
 * Aggregate two properties into range chart data (issue #81): per period, one
 * floating bar from the start property's value to the end property's value —
 * e.g. "To Bed" to "Wake Up".
 *
 * Time handling:
 * - If any value is a time of day, the whole chart runs in time mode
 *   (HH:mm axis).
 * - In time mode, an end earlier than its start means the span crosses
 *   midnight, so the end is pushed into the next day (+24h).
 * - Starts themselves can straddle midnight (bed at 23:30 one day, 00:30
 *   another). When the starts spread over more than half a day, the
 *   small-hours ones are pushed into the next day too, so all bars cluster
 *   on one continuous band instead of jumping between the axis ends.
 *
 * Periods missing either side yield null (no bar), never a made-up value.
 */
export function aggregateForRangeChart(
    startData: OverlayPropertyData,
    endData: OverlayPropertyData,
    displayName: string,
    granularity: TimeGranularity
): RangeChartData {
    const startGroups = groupByPeriod(startData.dataPoints, granularity)
    const endGroups = groupByPeriod(endData.dataPoints, granularity)

    // Union of periods across both properties, ordered by date
    const allPeriods = new Map<string, Date>()
    for (const [key, group] of startGroups) allPeriods.set(key, group.date)
    for (const [key, group] of endGroups) {
        if (!allPeriods.has(key)) allPeriods.set(key, group.date)
    }
    const sortedPeriods = [...allPeriods.entries()].sort((a, b) => compareAsc(a[1], b[1]))

    interface RawBar {
        start: number
        end: number
    }

    const timeMode = [...startGroups.values(), ...endGroups.values()].some(
        (group) => group.value?.isTime === true
    )

    const labels: string[] = []
    const rawBars: (RawBar | null)[] = []
    const filePaths: string[][] = []

    for (const [key, date] of sortedPeriods) {
        labels.push(formatDateByGranularity(date, granularity))

        const startValue = startGroups.get(key)?.value ?? null
        const endValue = endGroups.get(key)?.value ?? null

        if (startValue === null || endValue === null) {
            rawBars.push(null)
        } else {
            let end = endValue.hours
            // A span that "ends" before it starts crosses midnight
            if (timeMode && end < startValue.hours) {
                end += 24
            }
            rawBars.push({ start: startValue.hours, end })
        }

        const files = [
            ...(startGroups.get(key)?.filePaths ?? []),
            ...(endGroups.get(key)?.filePaths ?? [])
        ]
        filePaths.push([...new Set(files)])
    }

    // Align starts that straddle midnight: when they spread over more than
    // half a day, the small-hours ones belong to the "next day" band
    if (timeMode) {
        const startsPresent = rawBars.filter((bar): bar is RawBar => bar !== null)
        if (startsPresent.length > 0) {
            const startHours = startsPresent.map((bar) => bar.start)
            const spread = Math.max(...startHours) - Math.min(...startHours)
            if (spread > 12) {
                for (const bar of startsPresent) {
                    if (bar.start < 12) {
                        bar.start += 24
                        bar.end += 24
                    }
                }
            }
        }
    }

    return {
        displayName,
        startLabel: startData.displayName,
        endLabel: endData.displayName,
        labels,
        bars: rawBars.map((bar) => (bar === null ? null : [bar.start, bar.end])),
        filePaths,
        timeMode
    }
}
