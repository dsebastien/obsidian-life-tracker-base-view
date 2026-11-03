import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import {
    buildCartesianModel,
    isOutlierMarkerDataset,
    OUTLIER_MARKER_RADIUS
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
