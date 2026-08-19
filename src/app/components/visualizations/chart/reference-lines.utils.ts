import type { BasesPropertyId } from 'obsidian'
import type { ChartConfig, ChartDataset, ReferenceLineConfig } from '../../../types'
import { getChartColorScheme } from '../../../../utils'
import { periodLabel } from '../../../services/progress-aggregation.utils'

/**
 * One horizontal line to draw across a cartesian chart, with enough styling
 * information to keep an explicit reference line and a goal target visually
 * distinct when both are configured (issue #156).
 */
export interface ReferenceLineSpec {
    value: number
    label: string
    color: string
    /** Dash pattern; defaults to the reference line's [5, 5] */
    dash?: number[]
    /** Where the label anchors; opposite ends keep coinciding lines readable */
    labelPosition?: 'start' | 'end'
    /**
     * Draw as a line accumulating `value` per plotted period instead of a
     * horizontal one — the goal target's shape when the chart plots a running
     * total (issue #158)
     */
    cumulativePerPeriod?: boolean
}

/** Dash pattern for explicit reference lines */
export const REFERENCE_LINE_DASH = [5, 5]

/** Tighter dash pattern for the goal target's line, so the two never look alike */
export const TARGET_LINE_DASH = [2, 3]

/**
 * Build every horizontal line a cartesian chart should draw: the explicit
 * reference line, the goal target's line (issue #6), and the per-property
 * overlay reference lines.
 *
 * A configured reference line and an enabled target are both drawn
 * (issue #156) — they answer different questions ("where is this threshold?"
 * vs "what is my goal?") and hiding one behind the other made the surviving
 * line ambiguous. They stay distinguishable by dash pattern and by label
 * anchor: reference labels sit at the right edge, the target's at the left.
 */
export function buildCartesianReferenceLines(
    chartConfig: ChartConfig,
    overlayReferenceLines: Record<BasesPropertyId, ReferenceLineConfig> | undefined,
    datasets: ChartDataset[]
): ReferenceLineSpec[] {
    const referenceLines: ReferenceLineSpec[] = []
    const colors = getChartColorScheme(chartConfig.colorScheme)

    // Single property reference line
    if (chartConfig.referenceLine?.enabled) {
        const color = colors[0] ?? '#8884d8'
        const label =
            chartConfig.referenceLine.label ?? `Reference: ${chartConfig.referenceLine.value}`
        referenceLines.push({
            value: chartConfig.referenceLine.value,
            label,
            color,
            dash: REFERENCE_LINE_DASH,
            labelPosition: 'end'
        })
    }

    // A goal target draws itself as a reference line (issue #6), so a target
    // set on a chart is visible without configuring the same number twice
    const target = chartConfig.target
    if (target?.enabled) {
        const unit = target.unit ? ` ${target.unit}` : ''

        if (chartConfig.runningTotal) {
            // Against a cumulative series a static per-period target is
            // misleading: "50 per day" must climb 50 a day alongside the data
            // (issue #158). That only translates cleanly when the target's
            // period matches the plotted granularity — a "per week" goal has
            // no honest slope on a daily axis, so it is dropped rather than
            // drawn wrong.
            if (target.period === chartConfig.granularity) {
                referenceLines.push({
                    value: target.value,
                    label: `Target: ${target.value}${unit} per ${periodLabel(target.period, 1)} (cumulative)`,
                    color: colors[0] ?? '#8884d8',
                    dash: TARGET_LINE_DASH,
                    labelPosition: 'start',
                    cumulativePerPeriod: true
                })
            }
        } else {
            referenceLines.push({
                value: target.value,
                label: `Target: ${target.value}${unit}`,
                color: colors[0] ?? '#8884d8',
                dash: TARGET_LINE_DASH,
                labelPosition: 'start'
            })
        }
    }

    // Overlay reference lines (one per dataset/property)
    if (overlayReferenceLines) {
        datasets.forEach((dataset, index) => {
            const propertyId = dataset.propertyId
            if (!propertyId) return

            const refLineConfig = overlayReferenceLines[propertyId]
            if (!refLineConfig?.enabled) return

            const color = colors[index % colors.length] ?? '#8884d8'
            const label = refLineConfig.label ?? `${dataset.label}: ${refLineConfig.value}`
            referenceLines.push({
                value: refLineConfig.value,
                label,
                color,
                dash: REFERENCE_LINE_DASH,
                labelPosition: 'end'
            })
        })
    }

    return referenceLines
}
