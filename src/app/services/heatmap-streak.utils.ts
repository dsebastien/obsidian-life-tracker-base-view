import { TimeGranularity, type HeatmapCell, type HeatmapStreakStats } from '../types'
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
 * Compute streak statistics over heatmap cells (issue #100).
 *
 * Cells may be sparse (only periods with entries exist), so consecutiveness
 * is checked on the calendar: two active cells are consecutive when the
 * second one falls in the period right after the first.
 *
 * The trailing run only counts as the *current* streak when it reaches the
 * present: its last cell is in the current period, or in the immediately
 * preceding one (today's data may simply not be captured yet).
 *
 * @param now - injectable for tests; defaults to the current date
 */
export function computeHeatmapStreaks(
    cells: HeatmapCell[],
    granularity: TimeGranularity,
    now: Date = new Date()
): HeatmapStreakStats {
    const active = cells.filter(isActiveCell).sort((a, b) => a.date.getTime() - b.date.getTime())

    if (active.length === 0) {
        return { currentStreak: 0, longestStreak: 0, activeCount: 0 }
    }

    let longestStreak = 1
    let run = 1

    for (let i = 1; i < active.length; i++) {
        const prev = active[i - 1]!
        const cell = active[i]!
        const isConsecutive =
            getTimeKey(incrementDate(prev.date, granularity), granularity) ===
            getTimeKey(cell.date, granularity)
        run = isConsecutive ? run + 1 : 1
        longestStreak = Math.max(longestStreak, run)
    }

    const last = active[active.length - 1]!
    const lastKey = getTimeKey(last.date, granularity)
    const nowKey = getTimeKey(normalizeDate(now, granularity), granularity)
    const nextAfterLastKey = getTimeKey(incrementDate(last.date, granularity), granularity)
    const reachesPresent = lastKey === nowKey || nextAfterLastKey === nowKey

    return {
        currentStreak: reachesPresent ? run : 0,
        longestStreak,
        activeCount: active.length
    }
}
