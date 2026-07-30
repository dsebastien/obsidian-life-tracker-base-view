import type { ValuePolarity } from '../app/types/property/property-definition.types'
import type { HeatmapPresetName } from './color.utils'

/**
 * Direction of a trend, as computed by `computeTrend`.
 */
export type TrendDirection = 'up' | 'down' | 'flat'

/**
 * What a trend *means* for the user, once the property's polarity is known
 * (issue #21).
 *
 * - `good` / `bad`: the value moved in the desirable / undesirable direction.
 * - `neutral`: either the property has no polarity configured, or the trend is
 *   flat — both cases must stay unjudged.
 */
export type TrendSentiment = 'good' | 'bad' | 'neutral'

/**
 * Read a stored polarity, treating anything missing or unrecognized as neutral.
 *
 * Property definitions can come from earlier plugin versions or from the
 * Obsidian Starter Kit plugin, neither of which writes this field.
 */
export function readPolarity(polarity: ValuePolarity | undefined): ValuePolarity {
    return polarity === 'higher-is-better' || polarity === 'lower-is-better' ? polarity : 'neutral'
}

/**
 * Decide whether a trend is an improvement, a regression, or neither.
 *
 * A flat trend is always neutral: below the "meaningful change" threshold there
 * is nothing to celebrate or worry about, whatever the polarity.
 */
export function resolveTrendSentiment(
    direction: TrendDirection,
    polarity: ValuePolarity | undefined
): TrendSentiment {
    const effective = readPolarity(polarity)
    if (effective === 'neutral' || direction === 'flat') return 'neutral'

    const higherIsBetter = effective === 'higher-is-better'
    const rising = direction === 'up'

    return rising === higherIsBetter ? 'good' : 'bad'
}

/**
 * One word describing the trend, for tooltips and the trend row.
 * Neutral trends keep the plain directional wording — claiming a mood rise is
 * "improving" would be a judgement the user never asked for.
 */
export function describeTrendSentiment(
    direction: TrendDirection,
    polarity: ValuePolarity | undefined
): string {
    const sentiment = resolveTrendSentiment(direction, polarity)
    if (sentiment === 'good') return 'improving'
    if (sentiment === 'bad') return 'worsening'
    return direction === 'flat' ? 'steady' : direction === 'up' ? 'rising' : 'falling'
}

/**
 * Heatmap gradient a property defaults to given its polarity (issue #21):
 * green when more is better, red when more is worse, so "more color = more of
 * the thing" reads correctly in both directions.
 *
 * Returns null for neutral properties, which keep the plugin-wide default.
 * This is only ever a *default* — an explicit per-card or view-wide scheme wins.
 */
export function polarityHeatmapPreset(
    polarity: ValuePolarity | undefined
): HeatmapPresetName | null {
    const effective = readPolarity(polarity)
    if (effective === 'higher-is-better') return 'green'
    if (effective === 'lower-is-better') return 'red'
    return null
}
