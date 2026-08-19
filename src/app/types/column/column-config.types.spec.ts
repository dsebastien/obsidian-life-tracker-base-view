import { describe, expect, test } from 'bun:test'
import {
    DEFAULT_TARGET_WARN_THRESHOLD,
    normalizeTargetConfig,
    supportsTarget
} from './column-config.types'
import { TimeGranularity } from '../visualization/time-granularity.intf'
import { VisualizationType } from '../visualization/visualization-type.intf'

const VALID = {
    value: 3,
    metric: 'count',
    period: 'weekly',
    direction: 'at-least'
}

describe('normalizeTargetConfig', () => {
    test('accepts a well-formed target', () => {
        expect(normalizeTargetConfig(VALID)).toEqual({
            enabled: true,
            value: 3,
            metric: 'count',
            period: TimeGranularity.Weekly,
            direction: 'at-least',
            warnThreshold: DEFAULT_TARGET_WARN_THRESHOLD
        })
    })

    test('treats a missing "enabled" as enabled: a hand-written target is meant to be on', () => {
        expect(normalizeTargetConfig(VALID)?.enabled).toBe(true)
        expect(normalizeTargetConfig({ ...VALID, enabled: false })?.enabled).toBe(false)
    })

    test('keeps a usable unit and drops an empty one', () => {
        expect(normalizeTargetConfig({ ...VALID, unit: ' reps ' })?.unit).toBe('reps')
        expect(normalizeTargetConfig({ ...VALID, unit: '  ' })?.unit).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, unit: 42 })?.unit).toBeUndefined()
    })

    test('keeps an in-range warn threshold and replaces anything else', () => {
        expect(normalizeTargetConfig({ ...VALID, warnThreshold: 0.8 })?.warnThreshold).toBe(0.8)
        expect(normalizeTargetConfig({ ...VALID, warnThreshold: 5 })?.warnThreshold).toBe(
            DEFAULT_TARGET_WARN_THRESHOLD
        )
        expect(normalizeTargetConfig({ ...VALID, warnThreshold: 'high' })?.warnThreshold).toBe(
            DEFAULT_TARGET_WARN_THRESHOLD
        )
    })

    test('rejects a target rather than half-applying it', () => {
        expect(normalizeTargetConfig(undefined)).toBeUndefined()
        expect(normalizeTargetConfig(null)).toBeUndefined()
        expect(normalizeTargetConfig([VALID])).toBeUndefined()
        expect(normalizeTargetConfig('3 per week')).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, value: 'three' })).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, value: Number.NaN })).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, metric: 'median' })).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, period: 'fortnightly' })).toBeUndefined()
        expect(normalizeTargetConfig({ ...VALID, direction: 'exactly' })).toBeUndefined()
    })
})

describe('supportsTarget', () => {
    test('is true for the progress ring and cartesian charts', () => {
        expect(supportsTarget(VisualizationType.Progress)).toBe(true)
        expect(supportsTarget(VisualizationType.LineChart)).toBe(true)
        expect(supportsTarget(VisualizationType.BarChart)).toBe(true)
        expect(supportsTarget(VisualizationType.AreaChart)).toBe(true)
    })

    test('is false where there is nowhere to draw it', () => {
        expect(supportsTarget(VisualizationType.Heatmap)).toBe(false)
        expect(supportsTarget(VisualizationType.PieChart)).toBe(false)
        expect(supportsTarget(VisualizationType.TagCloud)).toBe(false)
    })
})
