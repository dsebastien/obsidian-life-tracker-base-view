/**
 * Time granularity for visualizations
 */
export enum TimeGranularity {
    Daily = 'daily',
    Weekly = 'weekly',
    Monthly = 'monthly',
    Quarterly = 'quarterly',
    Yearly = 'yearly'
}

/**
 * All granularity values, for runtime validation of stored config.
 */
export const TIME_GRANULARITY_OPTIONS: readonly TimeGranularity[] = [
    TimeGranularity.Daily,
    TimeGranularity.Weekly,
    TimeGranularity.Monthly,
    TimeGranularity.Quarterly,
    TimeGranularity.Yearly
]

/**
 * Period unit label per granularity, singular. Shared by every stats row that
 * counts periods — heatmap streaks and the checkbox completion chip.
 */
export const GRANULARITY_UNIT: Record<TimeGranularity, string> = {
    [TimeGranularity.Daily]: 'day',
    [TimeGranularity.Weekly]: 'week',
    [TimeGranularity.Monthly]: 'month',
    [TimeGranularity.Quarterly]: 'quarter',
    [TimeGranularity.Yearly]: 'year'
}
