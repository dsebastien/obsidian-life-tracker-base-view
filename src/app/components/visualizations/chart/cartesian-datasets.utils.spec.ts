import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    buildCartesianModel,
    datasetsToggledWith,
    densePointStyle,
    syncDatasetFromModel,
    isOutlierMarkerDataset,
    MOVING_AVERAGE_LINE_WIDTH,
    OUTLIER_MARKER_RADIUS,
    POINT_MARKER_THRESHOLD
} from './cartesian-datasets.utils'
import {
    TimeGranularity,
    type ChartConfig,
    type ChartData,
    type ChartDataset
} from '../../../types'

const lineConfig = {
    granularity: TimeGranularity.Daily,
    showEmptyValues: false,
    embeddedHeight: 300,
    chartType: 'line',
    showLegend: false,
    showGrid: true,
    tension: 0.3,
    fill: false
} as ChartConfig

const paces = [372, 380, 385, 390, 377, 49997, 395, 388, 383, 379, 391]

function chartData(...datasets: ChartDataset[]): ChartData {
    const length = datasets[0]?.data.length ?? 0
    return {
        propertyId: 'note.pace' as BasesPropertyId,
        displayName: 'Pace',
        labels: Array.from({ length }, (_, i) => `Day ${i + 1}`),
        datasets
    }
}

function series(data: (number | null)[], label = 'Pace'): ChartDataset {
    return { label, data, filePaths: data.map(() => ['a.md']) }
}

describe('buildCartesianModel - outliers (3.4.0)', () => {
    test('an outlier is clamped and gets an upward triangle marker', () => {
        const model = buildCartesianModel(chartData(series(paces)), lineConfig, undefined)

        expect(model.datasets).toHaveLength(2)
        const [main, marker] = model.datasets
        expect((main!.data as (number | null)[])[5]).toBe(model.yPlan.max)
        expect(isOutlierMarkerDataset(main)).toBe(false)
        expect(isOutlierMarkerDataset(marker)).toBe(true)
        expect(marker!.ltOutlierMarkerFor).toBe(0)
        expect(marker!.type).toBe('line')
        expect(marker!.showLine).toBe(false)
        expect(marker!.pointStyle).toBe('triangle')
        expect(marker!.pointRadius).toBe(OUTLIER_MARKER_RADIUS)
        expect(marker!.label).toBe('Pace (outside the scale)')
        const markerData = marker!.data as (number | null)[]
        expect(markerData.filter((v) => v !== null)).toEqual([model.yPlan.max!])
        expect((marker!.pointRotation as number[])[5]).toBe(0)
    })

    test('a low outlier points down (duration lines do not start at 0)', () => {
        const low = [372, 380, 385, 390, 377, 3, 395, 388, 383, 379, 391]
        const model = buildCartesianModel(
            chartData(series(low)),
            { ...lineConfig, valueFormat: 'duration-mm-ss' },
            undefined
        )
        const marker = model.datasets[1]!
        expect((marker.pointRotation as number[])[5]).toBe(180)
    })

    test('with a zero baseline, a low value is inside the axis and stays as is', () => {
        const low = [372, 380, 385, 390, 377, 3, 395, 388, 383, 379, 391]
        const model = buildCartesianModel(chartData(series(low)), lineConfig, undefined)
        expect(model.yPlan.min).toBe(0)
        expect(model.datasets).toHaveLength(1)
        expect(model.datasets[0]!.data).toEqual(low)
    })

    test('no outlier, no marker, no explicit bounds', () => {
        const clean = paces.map((v) => (v > 1000 ? 381 : v))
        const model = buildCartesianModel(chartData(series(clean)), lineConfig, undefined)
        expect(model.datasets).toHaveLength(1)
        expect(model.yPlan.min).toBeUndefined()
        expect(model.yPlan.max).toBeUndefined()
    })

    test('show-all keeps every value', () => {
        const model = buildCartesianModel(
            chartData(series(paces)),
            { ...lineConfig, outliers: 'show-all' },
            undefined
        )
        expect(model.datasets).toHaveLength(1)
        expect(model.datasets[0]!.data).toEqual(paces)
    })

    test('running totals and list data are never fitted', () => {
        const runningTotal = buildCartesianModel(
            chartData(series(paces)),
            { ...lineConfig, runningTotal: true },
            undefined
        )
        expect(runningTotal.datasets).toHaveLength(1)

        const list = buildCartesianModel(chartData(series(paces)), lineConfig, undefined, {
            listData: true
        })
        expect(list.datasets).toHaveLength(1)
    })

    test('bars get the marker too', () => {
        const model = buildCartesianModel(
            chartData(series(paces)),
            { ...lineConfig, chartType: 'bar' },
            undefined
        )
        expect(model.beginAtZero).toBe(true)
        expect(model.yPlan.min).toBe(0)
        expect(model.datasets).toHaveLength(2)
        expect(model.datasets[1]!.type).toBe('line')
    })

    test('the moving average keeps its real values', () => {
        const average: ChartDataset = {
            label: '7-period average',
            data: paces.map(() => 5000),
            filePaths: paces.map(() => []),
            isMovingAverage: true
        }
        const model = buildCartesianModel(
            chartData(series(paces), average),
            { ...lineConfig, movingAveragePeriod: 7 },
            undefined
        )
        expect(model.datasets[1]!.data).toEqual(average.data)
        expect(model.datasets.filter((d) => isOutlierMarkerDataset(d))).toHaveLength(1)
    })
})

describe('buildCartesianModel - date-per-note axis (3.4.0)', () => {
    test('points carry their timestamp, markers included', () => {
        const xValues = paces.map((_, i) => Date.UTC(2025, 5, 1 + i * 3))
        const data: ChartData = { ...chartData(series(paces)), xValues }
        const model = buildCartesianModel(data, lineConfig, undefined)

        const main = model.datasets[0]!.data as { x: number; y: number | null }[]
        expect(main[0]).toEqual({ x: xValues[0]!, y: 372 })
        expect(main[5]!.x).toBe(xValues[5]!)
        expect(main[5]!.y).toBe(model.yPlan.max!)

        const marker = model.datasets[1]!.data as { x: number; y: number | null }[]
        expect(marker[0]).toEqual({ x: xValues[0]!, y: null })
        expect(marker[5]).toEqual({ x: xValues[5]!, y: model.yPlan.max! })
    })
})

describe('point markers (3.4.0)', () => {
    test('kept up to 40 points, hidden above, still hoverable', () => {
        expect(POINT_MARKER_THRESHOLD).toBe(40)
        expect(densePointStyle(new Array<number>(40).fill(1))).toEqual({})
        expect(densePointStyle(new Array<number>(41).fill(1))).toEqual({
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 8
        })
    })

    test('gaps do not count as points', () => {
        const sparse = [...new Array<number>(30).fill(1), ...new Array<null>(30).fill(null)]
        expect(densePointStyle(sparse)).toEqual({})
    })

    test('a 170-point line has no markers; its outlier marker stays visible', () => {
        const values = Array.from({ length: 170 }, (_, i) => 380 + (i % 10))
        values[42] = 49997
        const model = buildCartesianModel(chartData(series(values)), lineConfig, undefined)
        expect(model.datasets[0]!.pointRadius).toBe(0)
        expect(model.datasets[1]!.pointRadius).toBe(OUTLIER_MARKER_RADIUS)
    })

    test('bars have no markers to hide', () => {
        const values = Array.from({ length: 170 }, (_, i) => 380 + (i % 10))
        const model = buildCartesianModel(
            chartData(series(values)),
            { ...lineConfig, chartType: 'bar' },
            undefined
        )
        expect(model.datasets[0]!.pointRadius).toBeUndefined()
    })
})

describe('moving average emphasis (3.4.0)', () => {
    const clean = [372, 380, 385, 390, 377, 395, 388, 383, 379, 391]
    const average: ChartDataset = {
        label: '7-note average',
        data: clean.map(() => 384),
        filePaths: clean.map(() => []),
        isMovingAverage: true
    }

    test('the average is the main line, the raw series fades behind it', () => {
        const model = buildCartesianModel(
            chartData(series(clean), average),
            { ...lineConfig, fill: true, movingAveragePeriod: 7 },
            undefined
        )
        const [raw, avg] = model.datasets

        expect(avg!.borderWidth).toBe(MOVING_AVERAGE_LINE_WIDTH)
        expect(avg!.borderDash).toBeUndefined()
        expect(avg!.fill).toBe(false)
        expect(avg!.order).toBe(0)
        expect(avg!.pointRadius).toBe(0)

        expect(raw!.borderWidth).toBe(1)
        expect(raw!.fill).toBe(false)
        expect(raw!.order).toBe(1)
        expect(raw!.borderColor).toContain('0.35')
        expect(raw!.pointRadius).toBe(2)
    })

    test('a dense raw series behind an average has no markers', () => {
        const values = Array.from({ length: 60 }, (_, i) => 380 + (i % 10))
        const model = buildCartesianModel(
            chartData(series(values), { ...average, data: values.map(() => 384) }),
            { ...lineConfig, movingAveragePeriod: 7 },
            undefined
        )
        expect(model.datasets[0]!.pointRadius).toBe(0)
    })

    test('without an average nothing changes', () => {
        const model = buildCartesianModel(
            chartData(series(clean)),
            { ...lineConfig, fill: true },
            undefined
        )
        const raw = model.datasets[0]!
        expect(raw.borderWidth).toBe(2)
        expect(raw.fill).toBe(true)
        expect(raw.order).toBeUndefined()
    })
})

describe('incremental updates (3.4.0)', () => {
    const durationLine = { ...lineConfig, valueFormat: 'duration-mm-ss' } as ChartConfig
    const base = [372, 380, 385, 390, 377, 383, 395, 388, 383, 379, 391]

    test('a marker that changes side gets its new direction', () => {
        const above = [...base]
        above[5] = 49997
        const below = [...base]
        below[5] = 3
        const before = buildCartesianModel(chartData(series(above)), durationLine, undefined)
        const after = buildCartesianModel(chartData(series(below)), durationLine, undefined)

        // What the chart holds: a copy of the first render's marker dataset
        const shown = { ...before.datasets[1]! }
        expect((shown.pointRotation as number[])[5]).toBe(0)
        syncDatasetFromModel(shown, after.datasets[1]!)
        expect((shown.pointRotation as number[])[5]).toBe(180)
        expect(shown.data).toEqual(after.datasets[1]!.data)
    })

    test('a marker that moves to another note follows it', () => {
        const first = [...base]
        first[2] = 49997
        const second = [...base]
        second[8] = 49997
        const before = buildCartesianModel(chartData(series(first)), durationLine, undefined)
        const after = buildCartesianModel(chartData(series(second)), durationLine, undefined)
        const shown = { ...before.datasets[1]! }
        syncDatasetFromModel(shown, after.datasets[1]!)
        const data = shown.data as (number | null)[]
        expect(data[2]).toBeNull()
        expect(data[8]).not.toBeNull()
    })

    test('markers come back when a series drops to 40 points or fewer', () => {
        const dense = Array.from({ length: 50 }, (_, i) => 380 + (i % 10))
        const sparse = dense.slice(0, 30)
        const before = buildCartesianModel(chartData(series(dense)), lineConfig, undefined)
        const after = buildCartesianModel(chartData(series(sparse)), lineConfig, undefined)
        const shown: Record<string, unknown> = { ...before.datasets[0]! }
        expect(shown['pointRadius']).toBe(0)
        syncDatasetFromModel(shown, after.datasets[0]!)
        expect('pointRadius' in shown).toBe(false)
        expect('pointHitRadius' in shown).toBe(false)
    })
})

describe('datasetsToggledWith (3.4.0)', () => {
    test('a series toggles with its own outlier markers only', () => {
        const datasets = [
            { label: 'A' },
            { label: 'B' },
            { label: 'A (outside the scale)', ltOutlierMarkerFor: 0 },
            { label: 'B (outside the scale)', ltOutlierMarkerFor: 1 }
        ]
        expect(datasetsToggledWith(datasets, 0)).toEqual([0, 2])
        expect(datasetsToggledWith(datasets, 1)).toEqual([1, 3])
        expect(datasetsToggledWith([{ label: 'A' }], 0)).toEqual([0])
    })
})
