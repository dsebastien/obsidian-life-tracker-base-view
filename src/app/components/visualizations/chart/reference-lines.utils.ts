import type { BasesPropertyId } from 'obsidian'
import { TimeGranularity } from '../../../types'
import type { ChartConfig, ChartDataset, ReferenceLineConfig } from '../../../types'
import { formatTargetAmount, formatValue, getChartColorScheme } from '../../../../utils'
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
    /**
     * How many target periods the line accumulates over, when that is not the
     * number of plotted labels: on the date-per-note axis it comes from the
     * time span the notes cover (3.4.0)
     */
    cumulativePeriods?: number
}

/** Average length of each target period in ms, for time-proportional axes */
const PERIOD_MS: Record<TimeGranularity, number> = {
    [TimeGranularity.Daily]: 86_400_000,
    [TimeGranularity.Weekly]: 7 * 86_400_000,
    [TimeGranularity.Monthly]: (365.25 / 12) * 86_400_000,
    [TimeGranularity.Quarterly]: (365.25 / 4) * 86_400_000,
    [TimeGranularity.Yearly]: 365.25 * 86_400_000
}

/**
 * Periods of a target covered by a time span, counting the first: notes from
 * June 1 to June 15 cover 15 days, or 3 weeks (3.4.0)
 */
export function periodsInTimeSpan(
    range: { min: number; max: number },
    period: TimeGranularity
): number {
    return Math.max(0, range.max - range.min) / PERIOD_MS[period] + 1
}

/**
 * The y-value a reference line reaches by the chart's last period. Horizontal
 * lines sit at their value; a cumulative target line (issue #158) climbs to
 * `value × periods`.
 */
export function referenceLineEndValue(line: ReferenceLineSpec, labelCount: number): number {
    return line.cumulativePerPeriod
        ? line.value * Math.max(1, line.cumulativePeriods ?? labelCount)
        : line.value
}

/**
 * Every y-value the reference lines reach (start and end), so the y-axis can
 * keep them all in view
 */
export function referenceLineValues(
    referenceLines: ReferenceLineSpec[] | undefined,
    labelCount: number
): number[] {
    return (referenceLines ?? []).flatMap((line) => [
        line.value,
        referenceLineEndValue(line, labelCount)
    ])
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
    datasets: ChartDataset[],
    /** First and last note on the date-per-note axis (3.4.0); absent on period axes */
    timeRange?: { min: number; max: number }
): ReferenceLineSpec[] {
    const referenceLines: ReferenceLineSpec[] = []
    const colors = getChartColorScheme(chartConfig.colorScheme)
    // Default labels read in the card's value format ("Target: 5:30");
    // custom labels are the user's own text and stay as typed
    const show = (value: number): string => formatValue(value, chartConfig.valueFormat, String)

    // Single property reference line
    if (chartConfig.referenceLine?.enabled) {
        const color = colors[0] ?? '#8884d8'
        const label =
            chartConfig.referenceLine.label ?? `Reference: ${show(chartConfig.referenceLine.value)}`
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

        // Count and days targets count entries or days: never a duration
        const amount = formatTargetAmount(
            target.value,
            target.metric,
            chartConfig.valueFormat,
            String
        )
        const cumulative = {
            value: target.value,
            label: `Target: ${amount}${unit} per ${periodLabel(target.period, 1)} (cumulative)`,
            color: colors[0] ?? '#8884d8',
            dash: TARGET_LINE_DASH,
            labelPosition: 'start' as const,
            cumulativePerPeriod: true
        }

        if (chartConfig.runningTotal && chartConfig.xAxisSource === 'date-per-note') {
            // On a time-proportional axis the slope comes from the time the
            // notes span, whatever the target's period (3.4.0): notes over 15
            // days against "50 per day" end at 50 × 15. Without a span (no
            // notes yet) there is nothing to draw against
            if (timeRange) {
                referenceLines.push({
                    ...cumulative,
                    cumulativePeriods: periodsInTimeSpan(timeRange, target.period)
                })
            }
        } else if (chartConfig.runningTotal && chartConfig.xAxisSource === 'note-name') {
            // The note-name axis has no time: notes are not periods, so a
            // per-period goal has no honest slope there and is not drawn
        } else if (chartConfig.runningTotal) {
            // Against a cumulative series a static per-period target is
            // misleading: "50 per day" must climb 50 a day alongside the data
            // (issue #158). That only translates cleanly when the target's
            // period matches the plotted granularity — a "per week" goal has
            // no honest slope on a daily axis, so it is dropped rather than
            // drawn wrong.
            if (target.period === chartConfig.granularity) {
                referenceLines.push(cumulative)
            }
        } else {
            referenceLines.push({
                value: target.value,
                label: `Target: ${amount}${unit}`,
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
            const label = refLineConfig.label ?? `${dataset.label}: ${show(refLineConfig.value)}`
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
