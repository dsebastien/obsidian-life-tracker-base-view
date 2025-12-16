/**
 * Time frame options for filtering visualization data
 */
export enum TimeFrame {
    AllTime = 'all-time',
    ThisYear = 'this-year',
    LastYear = 'last-year',
    ThisMonth = 'this-month',
    LastMonth = 'last-month',
    ThisWeek = 'this-week',
    LastWeek = 'last-week',
    Last7Days = 'last-7-days',
    Last30Days = 'last-30-days',
    Last90Days = 'last-90-days',
    Last365Days = 'last-365-days'
}

/**
 * Display labels for time frame options (sentence case per UI guidelines)
 */
export const TIME_FRAME_LABELS: Record<TimeFrame, string> = {
    [TimeFrame.AllTime]: 'All time',
    [TimeFrame.ThisYear]: 'This year',
    [TimeFrame.LastYear]: 'Last year',
    [TimeFrame.ThisMonth]: 'This month',
    [TimeFrame.LastMonth]: 'Last month',
    [TimeFrame.ThisWeek]: 'This week',
    [TimeFrame.LastWeek]: 'Last week',
    [TimeFrame.Last7Days]: 'Last 7 days',
    [TimeFrame.Last30Days]: 'Last 30 days',
    [TimeFrame.Last90Days]: 'Last 90 days',
    [TimeFrame.Last365Days]: 'Last 365 days'
}

/**
 * Time frame options for dropdown (in display order)
 */
export const TIME_FRAME_OPTIONS: TimeFrame[] = [
    TimeFrame.AllTime,
    TimeFrame.ThisYear,
    TimeFrame.LastYear,
    TimeFrame.ThisMonth,
    TimeFrame.LastMonth,
    TimeFrame.ThisWeek,
    TimeFrame.LastWeek,
    TimeFrame.Last7Days,
    TimeFrame.Last30Days,
    TimeFrame.Last90Days,
    TimeFrame.Last365Days
]
