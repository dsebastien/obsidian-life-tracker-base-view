import { describe, expect, test } from 'bun:test'
import {
    axisStep,
    durationTickStep,
    formatMinutesAsDuration,
    formatSecondsAsDuration,
    formatValue,
    isDurationFormat,
    niceNumberStep
} from './value-format.utils'
import { normalizeValueFormat } from '../app/types/column/column-config.types'

describe('formatSecondsAsDuration', () => {
    test('reads seconds as m:ss', () => {
        expect(formatSecondsAsDuration(330)).toBe('5:30')
        expect(formatSecondsAsDuration(387)).toBe('6:27')
        expect(formatSecondsAsDuration(0)).toBe('0:00')
        expect(formatSecondsAsDuration(59)).toBe('0:59')
    })

    test('rounds to the second, carrying into the minute', () => {
        expect(formatSecondsAsDuration(387.4)).toBe('6:27')
        expect(formatSecondsAsDuration(59.6)).toBe('1:00')
    })

    test('switches to h:mm:ss from one hour on', () => {
        expect(formatSecondsAsDuration(3599)).toBe('59:59')
        expect(formatSecondsAsDuration(3600)).toBe('1:00:00')
        expect(formatSecondsAsDuration(3725)).toBe('1:02:05')
        expect(formatSecondsAsDuration(49997)).toBe('13:53:17')
    })
})

describe('formatMinutesAsDuration', () => {
    test('reads minutes as h:mm', () => {
        expect(formatMinutesAsDuration(95)).toBe('1:35')
        expect(formatMinutesAsDuration(45)).toBe('0:45')
        expect(formatMinutesAsDuration(480)).toBe('8:00')
    })

    test('rounds to the minute', () => {
        expect(formatMinutesAsDuration(95.6)).toBe('1:36')
    })
})

describe('formatValue', () => {
    test('number format (and no format) keeps the caller number rendering', () => {
        expect(formatValue(330, 'number', (v) => `#${v}`)).toBe('#330')
        expect(formatValue(330, undefined, (v) => `#${v}`)).toBe('#330')
    })

    test('duration formats', () => {
        expect(formatValue(330, 'duration-mm-ss')).toBe('5:30')
        expect(formatValue(95, 'duration-h-mm')).toBe('1:35')
    })

    test('negative or non-finite values fall back to the number format', () => {
        expect(formatValue(-30, 'duration-mm-ss', (v) => `#${v}`)).toBe('#-30')
        expect(formatValue(Number.NaN, 'duration-h-mm', () => 'n/a')).toBe('n/a')
        expect(formatValue(Number.POSITIVE_INFINITY, 'duration-mm-ss', () => 'inf')).toBe('inf')
    })

    test('default number rendering keeps up to two decimals', () => {
        expect(formatValue(1.23456, 'number')).toBe((1.23).toLocaleString())
    })
})

describe('isDurationFormat', () => {
    test('only the duration formats', () => {
        expect(isDurationFormat('duration-mm-ss')).toBe(true)
        expect(isDurationFormat('duration-h-mm')).toBe(true)
        expect(isDurationFormat('number')).toBe(false)
        expect(isDurationFormat(undefined)).toBe(false)
    })
})

describe('durationTickStep', () => {
    test('a 5:00-7:00 pace range ticks every 30 seconds', () => {
        expect(durationTickStep(120, 'duration-mm-ss')).toBe(30)
    })

    test('picks the smallest ladder step within the interval budget', () => {
        expect(durationTickStep(25, 'duration-mm-ss')).toBe(5)
        expect(durationTickStep(60, 'duration-mm-ss')).toBe(10)
        expect(durationTickStep(420, 'duration-mm-ss')).toBe(120)
        expect(durationTickStep(1500, 'duration-mm-ss')).toBe(300)
        expect(durationTickStep(4 * 3600, 'duration-mm-ss')).toBe(3600)
    })

    test('minutes use a minute ladder', () => {
        expect(durationTickStep(90, 'duration-h-mm')).toBe(15)
        expect(durationTickStep(150, 'duration-h-mm')).toBe(30)
        expect(durationTickStep(600, 'duration-h-mm')).toBe(120)
    })

    test('beyond the ladder, multiples of the largest step', () => {
        expect(durationTickStep(30 * 86400, 'duration-mm-ss')).toBe(5 * 86400)
    })

    test('a flat range still gets a usable step', () => {
        expect(durationTickStep(0, 'duration-mm-ss')).toBe(30)
        expect(durationTickStep(0, 'duration-h-mm')).toBe(15)
    })
})

describe('niceNumberStep / axisStep', () => {
    test('1-2-5 steps', () => {
        expect(niceNumberStep(420)).toBe(100)
        expect(niceNumberStep(60)).toBe(10)
        expect(niceNumberStep(0.15)).toBeCloseTo(0.05)
        expect(niceNumberStep(0)).toBe(1)
    })

    test('axisStep picks the ladder by format', () => {
        expect(axisStep(120, 'duration-mm-ss')).toBe(30)
        expect(axisStep(120, 'number')).toBe(20)
        expect(axisStep(120, undefined)).toBe(20)
    })
})

describe('normalizeValueFormat', () => {
    test('accepts known formats, drops anything else', () => {
        expect(normalizeValueFormat('duration-mm-ss')).toBe('duration-mm-ss')
        expect(normalizeValueFormat('duration-h-mm')).toBe('duration-h-mm')
        expect(normalizeValueFormat('number')).toBe('number')
        expect(normalizeValueFormat('mm:ss')).toBeUndefined()
        expect(normalizeValueFormat(42)).toBeUndefined()
        expect(normalizeValueFormat(undefined)).toBeUndefined()
    })
})
