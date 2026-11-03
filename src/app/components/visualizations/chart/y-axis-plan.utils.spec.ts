import { describe, expect, test } from 'bun:test'
import { planYAxis, yAxisBeginsAtZero } from './y-axis-plan.utils'

describe('yAxisBeginsAtZero', () => {
    test('number-format charts keep starting at zero', () => {
        expect(yAxisBeginsAtZero('line', undefined, undefined)).toBe(true)
        expect(yAxisBeginsAtZero('line', 'number', undefined)).toBe(true)
    })

    test('duration lines fit their data, bars never do', () => {
        expect(yAxisBeginsAtZero('line', 'duration-mm-ss', undefined)).toBe(false)
        expect(yAxisBeginsAtZero('bar', 'duration-mm-ss', undefined)).toBe(true)
    })

    test('an explicit scale minimum replaces the zero baseline', () => {
        expect(yAxisBeginsAtZero('bar', 'number', { min: 5, max: 10 })).toBe(false)
    })
})

describe('planYAxis - value format', () => {
    test('number format leaves Chart.js auto-fit alone', () => {
        const plan = planYAxis({
            series: [{ data: [300, 360, 420] }],
            referenceValues: [],
            beginAtZero: true,
            valueFormat: 'number'
        })
        expect(plan.min).toBeUndefined()
        expect(plan.max).toBeUndefined()
        expect(plan.stepSize).toBeUndefined()
        expect(plan.data).toEqual([[300, 360, 420]])
    })

    test('a 5:00-7:00 pace ticks every 30 seconds', () => {
        const plan = planYAxis({
            series: [{ data: [300, null, 360, 420] }],
            referenceValues: [],
            beginAtZero: false,
            valueFormat: 'duration-mm-ss'
        })
        expect(plan.stepSize).toBe(30)
    })

    test('reference values and the zero baseline widen the step', () => {
        const plan = planYAxis({
            series: [{ data: [300, 420] }],
            referenceValues: [600],
            beginAtZero: true,
            valueFormat: 'duration-mm-ss'
        })
        expect(plan.stepSize).toBe(120)
    })

    test('series kept out of the range do not widen it', () => {
        const plan = planYAxis({
            series: [{ data: [300, 420] }, { data: [5000], includeInRange: false }],
            referenceValues: [],
            beginAtZero: false,
            valueFormat: 'duration-mm-ss'
        })
        expect(plan.stepSize).toBe(30)
    })

    test('an explicit scale sets the range the step covers', () => {
        const plan = planYAxis({
            series: [{ data: [300, 420] }],
            referenceValues: [],
            scale: { min: 0, max: 3600 },
            beginAtZero: true,
            valueFormat: 'duration-mm-ss'
        })
        expect(plan.stepSize).toBe(600)
    })
})

/** Ten paces around 6:20 plus one bad entry */
const paces = [372, 380, 385, 390, 377, 395, 388, 383, 379, 391]
const withOutlier = [...paces.slice(0, 5), 49997, ...paces.slice(5)]

describe('planYAxis - outliers (3.4.0)', () => {
    test('the axis fits the bulk and the outlier is clamped to its top edge', () => {
        const plan = planYAxis({
            series: [{ data: withOutlier, fitToBulk: true }],
            referenceValues: [],
            beginAtZero: false,
            valueFormat: 'duration-mm-ss'
        })
        expect(plan.min).toBe(370)
        expect(plan.max).toBe(395)
        expect(plan.stepSize).toBe(5)
        expect(plan.data[0]![5]).toBe(395)
        expect(plan.clamped[0]).toEqual([{ index: 5, value: 49997, side: 'above' }])
        // Every other value is untouched
        expect(plan.data[0]!.filter((_, i) => i !== 5)).toEqual(paces)
    })

    test('a zero baseline stays in the range', () => {
        const plan = planYAxis({
            series: [{ data: withOutlier, fitToBulk: true }],
            referenceValues: [],
            beginAtZero: true
        })
        expect(plan.min).toBe(0)
        expect(plan.max).toBe(400)
        expect(plan.clamped[0]).toHaveLength(1)
    })

    test('a low outlier is clamped to the bottom edge', () => {
        const plan = planYAxis({
            series: [{ data: [...paces, 3], fitToBulk: true }],
            referenceValues: [],
            beginAtZero: false
        })
        expect(plan.min).toBe(370)
        expect(plan.clamped[0]).toEqual([{ index: 10, value: 3, side: 'below' }])
        expect(plan.data[0]![10]).toBe(370)
    })

    test('reference values stay in view', () => {
        const plan = planYAxis({
            series: [{ data: withOutlier, fitToBulk: true }],
            referenceValues: [450],
            beginAtZero: false
        })
        expect(plan.max).toBeGreaterThanOrEqual(450)
        expect(plan.clamped[0]).toHaveLength(1)
    })

    test('show-all and explicit scales keep every value', () => {
        const showAll = planYAxis({
            series: [{ data: withOutlier, fitToBulk: true }],
            referenceValues: [],
            beginAtZero: false,
            outlierMode: 'show-all'
        })
        expect(showAll.min).toBeUndefined()
        expect(showAll.data[0]).toEqual(withOutlier)
        expect(showAll.clamped[0]).toEqual([])

        const explicit = planYAxis({
            series: [{ data: withOutlier, fitToBulk: true }],
            referenceValues: [],
            scale: { min: null, max: 1000 },
            beginAtZero: false
        })
        expect(explicit.max).toBeUndefined()
        expect(explicit.data[0]).toEqual(withOutlier)
    })

    test('series not fitted to the bulk are neither fenced nor clamped', () => {
        const average = withOutlier.map(() => 5000)
        const plan = planYAxis({
            series: [
                { data: withOutlier, fitToBulk: true },
                { data: average, includeInRange: false }
            ],
            referenceValues: [],
            beginAtZero: false
        })
        expect(plan.max).toBe(395)
        expect(plan.data[1]).toEqual(average)
        expect(plan.clamped[1]).toEqual([])

        const notFitted = planYAxis({
            series: [{ data: withOutlier }],
            referenceValues: [],
            beginAtZero: false
        })
        expect(notFitted.min).toBeUndefined()
        expect(notFitted.clamped[0]).toEqual([])
    })

    test('overlays: an outlier in one series, the bulk of all series sets the range', () => {
        const other = [10, 12, 11, 13, 12, 11, 10, 12, 11, 13, 12]
        const plan = planYAxis({
            series: [
                { data: withOutlier, fitToBulk: true },
                { data: other, fitToBulk: true }
            ],
            referenceValues: [],
            beginAtZero: false
        })
        expect(plan.min).toBeLessThanOrEqual(10)
        expect(plan.max).toBeGreaterThanOrEqual(395)
        expect(plan.max).toBeLessThan(1000)
        expect(plan.clamped[0]).toHaveLength(1)
        expect(plan.clamped[1]).toEqual([])
    })

    test('fewer than 8 points never fit', () => {
        const plan = planYAxis({
            series: [{ data: [380, 385, 49997], fitToBulk: true }],
            referenceValues: [],
            beginAtZero: false
        })
        expect(plan.max).toBeUndefined()
        expect(plan.clamped[0]).toEqual([])
    })
})
