import { describe, expect, it } from 'bun:test'
import { formatHeatmapTooltip } from './tooltip'
import { TimeGranularity } from '../../types'

const mapping = { '⭐': 1, '⭐⭐': 2, '⭐⭐⭐': 3 }
const date = new Date(2026, 10, 25)

describe('formatHeatmapTooltip value label', () => {
    it('shows the mapped label for an exact value', () => {
        const t = formatHeatmapTooltip(
            date,
            2,
            1,
            'Rating',
            TimeGranularity.Daily,
            null,
            undefined,
            mapping
        )
        expect(t.value).toBe('Rating: ⭐⭐')
    })
    it('keeps the number when no label matches', () => {
        const t = formatHeatmapTooltip(
            date,
            1.5,
            2,
            'Rating',
            TimeGranularity.Daily,
            null,
            undefined,
            mapping
        )
        expect(t.value).toBe('Rating: 1.50')
    })
})
