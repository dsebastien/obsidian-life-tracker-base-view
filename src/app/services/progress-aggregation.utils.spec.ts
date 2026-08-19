import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    aggregateForProgress,
    isTargetMet,
    periodLabel,
    progressRatio,
    progressStatus
} from './progress-aggregation.utils'
import { TimeGranularity, type TargetConfig, type VisualizationDataPoint } from '../types'

const PROP_ID = 'note.pushups' as BasesPropertyId

function point(dateStr: string | null, numericValue: number | null): VisualizationDataPoint {
    return {
        filePath: `${dateStr ?? 'undated'}.md`,
        dateAnchor: dateStr
            ? {
                  date: new Date(dateStr),
                  source: { type: 'filename', pattern: 'auto' },
                  confidence: 'high'
              }
            : null,
        numericValue,
        booleanValue: null,
        displayLabel: null,
        listValues: []
    }
}

function target(overrides: Partial<TargetConfig> = {}): TargetConfig {
    return {
        enabled: true,
        value: 3,
        metric: 'count',
        period: TimeGranularity.Weekly,
        direction: 'at-least',
        ...overrides
    }
}

describe('isTargetMet', () => {
    test('at-least is met at or above the value', () => {
        const config = target({ value: 3, direction: 'at-least' })
        expect(isTargetMet(2, config)).toBe(false)
        expect(isTargetMet(3, config)).toBe(true)
        expect(isTargetMet(4, config)).toBe(true)
    })

    test('at-most is met at or below the value', () => {
        const config = target({ value: 80, direction: 'at-most' })
        expect(isTargetMet(79, config)).toBe(true)
        expect(isTargetMet(80, config)).toBe(true)
        expect(isTargetMet(81, config)).toBe(false)
    })
})

describe('progressRatio', () => {
    test('is the fraction of the target, clamped to 0-1', () => {
        const config = target({ value: 4 })
        expect(progressRatio(0, config)).toBe(0)
        expect(progressRatio(2, config)).toBe(0.5)
        expect(progressRatio(9, config)).toBe(1)
    })

    test('a zero target is all-or-nothing rather than a division by zero', () => {
        const config = target({ value: 0, direction: 'at-most' })
        expect(progressRatio(0, config)).toBe(1)
        expect(progressRatio(5, config)).toBe(0)
    })
})

describe('progressStatus', () => {
    test('classifies met, close and behind against the warn threshold', () => {
        const config = target({ value: 4, warnThreshold: 0.5 })
        expect(progressStatus(4, config)).toBe('met')
        expect(progressStatus(2, config)).toBe('close')
        expect(progressStatus(1, config)).toBe('behind')
    })

    test('an at-most budget runs green to red: comfortable, near the ceiling, over it', () => {
        const config = target({
            value: 10,
            metric: 'sum',
            direction: 'at-most',
            warnThreshold: 0.5
        })
        expect(progressStatus(2, config)).toBe('met')
        expect(progressStatus(8, config)).toBe('close')
        expect(progressStatus(12, config)).toBe('behind')
    })

    test('an at-least goal runs red to green: behind, nearly there, met', () => {
        const config = target({ value: 10, metric: 'sum', warnThreshold: 0.5 })
        expect(progressStatus(2, config)).toBe('behind')
        expect(progressStatus(8, config)).toBe('close')
        expect(progressStatus(12, config)).toBe('met')
    })

    test('metrics without a meaningful zero skip the warning band', () => {
        // 79 of an 80 kg ceiling is not "99% of a budget": the scale does not
        // start at 0, so latest and average are met or missed, nothing between
        const config = target({ value: 80, metric: 'latest', direction: 'at-most' })
        expect(progressStatus(79, config)).toBe('met')
        expect(progressStatus(81, config)).toBe('behind')

        const average = target({ value: 7, metric: 'average' })
        expect(progressStatus(4, average)).toBe('behind')
        expect(progressStatus(7, average)).toBe('met')
    })
})

describe('aggregateForProgress', () => {
    test('count ignores zeros: a logged 0 means the thing was not done', () => {
        // Monday-to-Sunday week of 2024-03-04
        const points = [
            point('2024-03-04', 10),
            point('2024-03-05', 0),
            point('2024-03-06', 12),
            point('2024-03-07', 0)
        ]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 3 }))

        expect(result.periods).toHaveLength(1)
        expect(result.periods[0]!.actual).toBe(2)
        expect(result.periods[0]!.met).toBe(false)
    })

    test('sum totals the values in each period', () => {
        const points = [point('2024-03-04', 50), point('2024-03-06', 60)]

        const result = aggregateForProgress(
            points,
            PROP_ID,
            'Squats',
            target({ metric: 'sum', value: 150 })
        )

        expect(result.periods[0]!.actual).toBe(110)
        expect(result.periods[0]!.met).toBe(false)
    })

    test('average means the mean of the values', () => {
        const points = [point('2024-03-04', 4), point('2024-03-06', 8)]

        const result = aggregateForProgress(
            points,
            PROP_ID,
            'Mood',
            target({ metric: 'average', value: 6 })
        )

        expect(result.periods[0]!.actual).toBe(6)
        expect(result.periods[0]!.met).toBe(true)
    })

    test('latest takes the most recent value, whatever order the points arrive in', () => {
        const points = [point('2024-03-06', 79), point('2024-03-04', 82)]

        const result = aggregateForProgress(
            points,
            PROP_ID,
            'Weight',
            target({ metric: 'latest', value: 80, direction: 'at-most' })
        )

        expect(result.periods[0]!.actual).toBe(79)
        expect(result.periods[0]!.met).toBe(true)
    })

    test('periods are split by the target period, not the view granularity', () => {
        const points = [point('2024-03-04', 1), point('2024-03-12', 1), point('2024-03-19', 1)]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 1 }))

        expect(result.periodCount).toBe(3)
        expect(result.metCount).toBe(3)
    })

    test('undated points are ignored', () => {
        const result = aggregateForProgress([point(null, 5)], PROP_ID, 'Push ups', target())

        expect(result.periods).toHaveLength(0)
        expect(result.current).toBeNull()
    })

    test('the current period is the one the view ends in', () => {
        const points = [point('2024-03-04', 1), point('2024-03-12', 1)]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 1 }), {
            minDate: new Date('2024-03-01'),
            maxDate: new Date('2024-03-13')
        })

        expect(result.current?.date.getTime()).toBe(result.periods[1]!.date.getTime())
    })

    test('a view ending on an empty period reports it as zero, not as the last period with data', () => {
        const points = [point('2024-03-04', 5)]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 3 }), {
            minDate: new Date('2024-03-01'),
            maxDate: new Date('2024-03-20')
        })

        expect(result.current?.actual).toBe(0)
        expect(result.current?.met).toBe(false)
        // The empty period is not invented as a real period in the hit rate
        expect(result.periodCount).toBe(1)
    })

    test('without a view range the current period is the last one with data', () => {
        const points = [point('2024-03-04', 5), point('2024-03-12', 7)]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 1 }))

        expect(result.current?.actual).toBe(1)
        expect(result.current?.date.getTime()).toBe(result.periods[1]!.date.getTime())
    })

    test('the hit rate counts periods that met the target', () => {
        const points = [
            point('2024-03-04', 1),
            point('2024-03-05', 1),
            point('2024-03-06', 1),
            point('2024-03-11', 1)
        ]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 3 }))

        expect(result.periodCount).toBe(2)
        expect(result.metCount).toBe(1)
    })
})

describe('metrics that cannot be measured from nothing (issue #6)', () => {
    test('a weight target reads as no-data, not as met, when nothing was logged', () => {
        const points = [point('2024-03-04', 82)]

        const result = aggregateForProgress(
            points,
            PROP_ID,
            'Weight',
            target({ metric: 'latest', value: 80, direction: 'at-most' }),
            { minDate: new Date('2024-03-01'), maxDate: new Date('2024-03-20') }
        )

        expect(result.current?.status).toBe('no-data')
        expect(result.current?.met).toBe(false)
        expect(result.current?.hasData).toBe(false)
        expect(result.current?.ratio).toBe(0)
    })

    test('an average target behaves the same way', () => {
        const result = aggregateForProgress(
            [point('2024-03-04', 8)],
            PROP_ID,
            'Mood',
            target({ metric: 'average', value: 7 }),
            { minDate: new Date('2024-03-01'), maxDate: new Date('2024-03-20') }
        )

        expect(result.current?.status).toBe('no-data')
    })

    test('a count target still reads an empty period as a real zero', () => {
        const result = aggregateForProgress(
            [point('2024-03-04', 1)],
            PROP_ID,
            'Push ups',
            target({ metric: 'count', value: 3 }),
            { minDate: new Date('2024-03-01'), maxDate: new Date('2024-03-20') }
        )

        expect(result.current?.status).toBe('behind')
        expect(result.current?.actual).toBe(0)
    })

    test('a sum target likewise: doing nothing really is zero reps', () => {
        const result = aggregateForProgress(
            [point('2024-03-04', 50)],
            PROP_ID,
            'Squats',
            target({ metric: 'sum', value: 150 }),
            { minDate: new Date('2024-03-01'), maxDate: new Date('2024-03-20') }
        )

        expect(result.current?.status).toBe('behind')
        expect(result.current?.actual).toBe(0)
    })

    test('periods that do record a value are measured normally', () => {
        const result = aggregateForProgress(
            [point('2024-03-04', 79)],
            PROP_ID,
            'Weight',
            target({ metric: 'latest', value: 80, direction: 'at-most' })
        )

        expect(result.current?.status).toBe('met')
        expect(result.current?.hasData).toBe(true)
    })
})

describe('streaks (issue #100)', () => {
    test('counts consecutive periods that met the target, not periods with data', () => {
        const points = [
            // Week 1: met (3 days)
            point('2024-03-04', 1),
            point('2024-03-05', 1),
            point('2024-03-06', 1),
            // Week 2: missed (1 day)
            point('2024-03-11', 1),
            // Week 3: met
            point('2024-03-18', 1),
            point('2024-03-19', 1),
            point('2024-03-20', 1)
        ]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 3 }))

        expect(result.streaks.activeCount).toBe(2)
        expect(result.streaks.longestStreak).toBe(1)
    })

    test('consecutive met periods build a run', () => {
        const points = [
            point('2024-03-04', 1),
            point('2024-03-05', 1),
            point('2024-03-11', 1),
            point('2024-03-12', 1),
            point('2024-03-18', 1),
            point('2024-03-19', 1)
        ]

        const result = aggregateForProgress(points, PROP_ID, 'Push ups', target({ value: 2 }))

        expect(result.streaks.longestStreak).toBe(3)
        expect(result.streaks.activeCount).toBe(3)
    })

    test('no met period means no streak', () => {
        const result = aggregateForProgress(
            [point('2024-03-04', 1)],
            PROP_ID,
            'Push ups',
            target({ value: 5 })
        )

        expect(result.streaks).toEqual({ currentStreak: 0, longestStreak: 0, activeCount: 0 })
    })
})

describe('periodLabel', () => {
    test('is singular for one and plural otherwise', () => {
        expect(periodLabel(TimeGranularity.Weekly, 1)).toBe('week')
        expect(periodLabel(TimeGranularity.Weekly, 4)).toBe('weeks')
        expect(periodLabel(TimeGranularity.Daily, 2)).toBe('days')
    })
})
