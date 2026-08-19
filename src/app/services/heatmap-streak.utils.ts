import { TimeGranularity, type HeatmapCell, type StreakStats } from '../types'
import { getTimeKey, incrementDate, normalizeDate } from './date-grouping.utils'

/**
 * A cell counts toward streaks when it has a recorded value other than 0.
 * This matches heatmap rendering, where 0 on a 0-based scale renders as
 * absence (issue #87): a cell rendered empty must not extend a streak.
 */
function isActiveCell(cell: HeatmapCell): boolean {
    return cell.value !== null && cell.value !== 0
}

/**
 * Compute streak statistics over the dates of "active" periods (issue #100).
 *
 * Dates may be sparse (only periods that qualify are passed in), so
 * consecutiveness is checked on the calendar: two dates are consecutive when
 * the second falls in the period right after the first.
 *
 * The trailing run only counts as the *current* streak when it reaches the
 * present: its last date is in the current period, or in the immediately
 * preceding one (today's data may simply not be captured yet).
 *
 * @param now - injectable for tests; defaults to the current date
 */
export function computeDatedStreaks(
    dates: Date[],
    granularity: TimeGranularity,
    now: Date = new Date()
): StreakStats {
    const active = [...dates].sort((a, b) => a.getTime() - b.getTime())

    if (active.length === 0) {
        return { currentStreak: 0, longestStreak: 0, activeCount: 0 }
    }

    let longestStreak = 1
    let run = 1

    for (let i = 1; i < active.length; i++) {
        const prev = active[i - 1]!
        const date = active[i]!
        const isConsecutive =
            getTimeKey(incrementDate(prev, granularity), granularity) ===
            getTimeKey(date, granularity)
        run = isConsecutive ? run + 1 : 1
        longestStreak = Math.max(longestStreak, run)
    }

    const last = active[active.length - 1]!
    const lastKey = getTimeKey(last, granularity)
    const nowKey = getTimeKey(normalizeDate(now, granularity), granularity)
    const nextAfterLastKey = getTimeKey(incrementDate(last, granularity), granularity)
    const reachesPresent = lastKey === nowKey || nextAfterLastKey === nowKey

    return {
        currentStreak: reachesPresent ? run : 0,
        longestStreak,
        activeCount: active.length
    }
}

/**
 * Compute streak statistics over heatmap cells (issue #100)
 *
 * @param now - injectable for tests; defaults to the current date
 */
export function computeHeatmapStreaks(
    cells: HeatmapCell[],
    granularity: TimeGranularity,
    now: Date = new Date()
): StreakStats {
    return computeDatedStreaks(
        cells.filter(isActiveCell).map((cell) => cell.date),
        granularity,
        now
    )
}
