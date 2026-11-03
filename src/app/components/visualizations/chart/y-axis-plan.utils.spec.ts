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
