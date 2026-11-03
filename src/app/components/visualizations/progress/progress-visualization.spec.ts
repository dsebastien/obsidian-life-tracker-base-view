import { describe, expect, test } from 'bun:test'
import { describeTarget, formatTargetAmount } from './progress-visualization'
import { TimeGranularity, type TargetConfig } from '../../../types'

const paceTarget: TargetConfig = {
    enabled: true,
    value: 330,
    metric: 'average',
    period: TimeGranularity.Weekly,
    direction: 'at-most'
}

describe('formatTargetAmount (3.4.0)', () => {
    test('value metrics read in the card format', () => {
        expect(formatTargetAmount(330, 'average', 'duration-mm-ss')).toBe('5:30')
        expect(formatTargetAmount(95, 'sum', 'duration-h-mm')).toBe('1:35')
        expect(formatTargetAmount(330, 'latest', undefined)).toBe('330')
    })

    test('count and days stay plain numbers', () => {
        expect(formatTargetAmount(3, 'days', 'duration-mm-ss')).toBe('3')
        expect(formatTargetAmount(3, 'count', 'duration-h-mm')).toBe('3')
    })
})

describe('describeTarget', () => {
    test('uses the value format when given', () => {
        expect(describeTarget(paceTarget, 'duration-mm-ss')).toBe('at most 5:30 per week')
        expect(describeTarget(paceTarget)).toBe('at most 330 per week')
    })
})
