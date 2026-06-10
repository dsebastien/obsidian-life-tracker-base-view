import { test, expect, describe } from 'bun:test'
import type { HeatmapCell } from '../types'
import { TimeGranularity } from '../types'
import { computeHeatmapStreaks } from './heatmap-streak.utils'

function cell(dateStr: string, value: number | null): HeatmapCell {
    return {
        date: new Date(dateStr),
        value,
        count: value === null ? 0 : 1,
        filePaths: value === null ? [] : ['file.md']
    }
}

describe('computeHeatmapStreaks (issue #100)', () => {
    const NOW = new Date('2025-01-10T12:00:00')

    test('empty cells yield all zeros', () => {
        const result = computeHeatmapStreaks([], TimeGranularity.Daily, NOW)
        expect(result).toEqual({ currentStreak: 0, longestStreak: 0, activeCount: 0 })
    })

    test('consecutive days ending today count as the current streak', () => {
        const cells = [cell('2025-01-08', 5), cell('2025-01-09', 3), cell('2025-01-10', 4)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.currentStreak).toBe(3)
        expect(result.longestStreak).toBe(3)
        expect(result.activeCount).toBe(3)
    })

    test('streak ending yesterday still counts (today not captured yet)', () => {
        const cells = [cell('2025-01-08', 5), cell('2025-01-09', 3)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.currentStreak).toBe(2)
    })

    test('streak broken before yesterday yields current streak 0', () => {
        const cells = [cell('2025-01-05', 5), cell('2025-01-06', 3)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.currentStreak).toBe(0)
        expect(result.longestStreak).toBe(2)
    })

    test('longest streak found in the middle of the history', () => {
        const cells = [
            cell('2025-01-01', 1),
            cell('2025-01-02', 1),
            cell('2025-01-03', 1),
            cell('2025-01-04', 1),
            // gap
            cell('2025-01-09', 1),
            cell('2025-01-10', 1)
        ]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.longestStreak).toBe(4)
        expect(result.currentStreak).toBe(2)
        expect(result.activeCount).toBe(6)
    })

    test('null and zero values do not extend streaks (consistent with issue #87 rendering)', () => {
        const cells = [
            cell('2025-01-08', 5),
            cell('2025-01-09', 0), // rendered as absence on 0-based scales
            cell('2025-01-10', 4)
        ]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.currentStreak).toBe(1)
        expect(result.longestStreak).toBe(1)
        expect(result.activeCount).toBe(2)
    })

    test('sparse cells: calendar gaps break runs even without explicit empty cells', () => {
        // Cells only exist for periods with entries — 01-07 simply has no cell
        const cells = [cell('2025-01-06', 1), cell('2025-01-08', 1), cell('2025-01-09', 1)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.longestStreak).toBe(2)
        expect(result.currentStreak).toBe(2)
    })

    test('weekly granularity counts consecutive weeks', () => {
        // Mondays of three consecutive ISO weeks; NOW falls in the week of 01-06
        const cells = [cell('2024-12-23', 1), cell('2024-12-30', 1), cell('2025-01-06', 1)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Weekly, NOW)
        expect(result.currentStreak).toBe(3)
        expect(result.longestStreak).toBe(3)
    })

    test('monthly granularity handles year boundaries', () => {
        const cells = [cell('2024-11-15', 1), cell('2024-12-03', 1), cell('2025-01-02', 1)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Monthly, NOW)
        expect(result.currentStreak).toBe(3)
        expect(result.longestStreak).toBe(3)
    })

    test('single active cell today', () => {
        const result = computeHeatmapStreaks([cell('2025-01-10', 2)], TimeGranularity.Daily, NOW)
        expect(result).toEqual({ currentStreak: 1, longestStreak: 1, activeCount: 1 })
    })

    test('unsorted input is handled', () => {
        const cells = [cell('2025-01-10', 1), cell('2025-01-08', 1), cell('2025-01-09', 1)]
        const result = computeHeatmapStreaks(cells, TimeGranularity.Daily, NOW)
        expect(result.currentStreak).toBe(3)
    })
})
