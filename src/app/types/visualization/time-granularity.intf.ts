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
