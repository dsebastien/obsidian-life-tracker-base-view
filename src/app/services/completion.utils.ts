import type { VisualizationDataPoint } from '../types'

/**
 * How often a checkbox property was ticked over the periods on screen
 * (issue #161).
 *
 * `checked` counts the periods that were ticked, `tracked` every period the
 * visualization covers — ticked or not. The rate is the ratio of the two.
 */
export interface CompletionStats {
    checked: number
    tracked: number
    /** `checked / tracked`, in the 0..1 range. Zero when nothing is tracked. */
    rate: number
}

/**
 * Whether a series is boolean data, read from the values rather than from the
 * property definition (issue #161).
 *
 * The definition is the wrong authority here: it is optional, it can be stale,
 * and its name match ignores the `note.` / `formula.` namespace, so a checkbox
 * definition for `note.done` can end up attached to a numeric `formula.done`.
 * The extracted values cannot lie — `booleanValue` is set only for genuine
 * booleans, and a checkbox reaches the visualizations as `booleanValue` with
 * `numericValue` 1/0 alongside it.
 *
 * Every recorded entry must be boolean, not merely one: a property holding a
 * mix of booleans and real numbers still has a meaningful record.
 */
export function isBooleanSeries(dataPoints: VisualizationDataPoint[]): boolean {
    let sawBoolean = false

    for (const point of dataPoints) {
        if (point.booleanValue !== null) {
            sawBoolean = true
            continue
        }
        // A recorded non-boolean value disqualifies the series; an absent one
        // (both readings null) says nothing either way.
        if (point.numericValue !== null) return false
    }

    return sawBoolean
}

/**
 * Compute how often a checkbox property was ticked (issue #161).
 *
 * This is what replaces the personal record for checkbox properties: a record
 * over booleans is always `true` and says nothing, whereas "42/90 days"
 * describes the habit.
 *
 * Takes the **period values the visualization renders** — heatmap cells, or a
 * chart dataset — not the raw entries. Raw entries would make the denominator
 * "days you wrote the property down", so a habit logged only on the days it
 * was done would read a triumphant "42/42 (100%)". Counting the periods on
 * screen instead gives the honest "42 of the 90 days shown".
 *
 * A period counts as ticked when it holds a value other than 0, matching how
 * heatmaps render (0 shows as absence) and how streaks are computed.
 *
 * Unlike a record this carries no judgement, so it needs no polarity: it
 * counts periods rather than calling any of them best.
 */
export function computeCompletionStats(periodValues: readonly (number | null)[]): CompletionStats {
    let checked = 0

    for (const value of periodValues) {
        if (value !== null && value !== 0) checked++
    }

    const tracked = periodValues.length
    return { checked, tracked, rate: tracked === 0 ? 0 : checked / tracked }
}

/**
 * Format completion stats for the stats row: "✅ Checked: 42/90 days (47%)".
 *
 * The percentage is rounded to a whole number: a completion rate is read at a
 * glance, and decimals only add noise.
 */
export function formatCompletionStats(stats: CompletionStats, unit: string): string {
    const plural = stats.tracked === 1 ? '' : 's'
    const percent = Math.round(stats.rate * 100)
    return `✅ Checked: ${stats.checked}/${stats.tracked} ${unit}${plural} (${percent}%)`
}

/** Spelled-out form of the completion chip, for its tooltip. */
export function describeCompletionStats(stats: CompletionStats, unit: string): string {
    const plural = stats.tracked === 1 ? '' : 's'
    const percent = Math.round(stats.rate * 100)
    return `Checked on ${stats.checked} of the ${stats.tracked} ${unit}${plural} shown (${percent}%)`
}
