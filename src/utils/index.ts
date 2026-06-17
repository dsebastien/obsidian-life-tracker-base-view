// Color utilities
export {
    HEATMAP_PRESETS,
    getHeatmapColor,
    getColorLevelForValue,
    DEFAULT_CHART_COLORS,
    CHART_COLORS_HEX,
    BOOLEAN_COLORS,
    getChartColor,
    getColorWithAlpha,
    generateGradient,
    isDarkTheme,
    getThemeAwareHeatmapColors,
    applyHeatmapColorScheme,
    getBooleanColor,
    CHART_COLOR_PRESETS,
    COLOR_SCHEME_OPTIONS,
    getChartColorScheme
} from './color.utils'
export type { ChartColorScheme } from './color.utils'

// Date utilities
export {
    isValidDate,
    parseDateFromFilename,
    getDateFromISOWeek,
    getISOWeekNumber,
    getQuarter,
    addDays,
    addWeeks,
    addMonths,
    isSameDay,
    isSameWeek,
    isSameMonth,
    isSameQuarter,
    isSameYear,
    startOfDay,
    startOfWeek,
    startOfMonth,
    startOfQuarter,
    startOfYear,
    getWeeksBetween,
    formatDateForInput,
    formatDateISO,
    formatDateByGranularity,
    getMonthName,
    formatFileTitleWithWeekday,
    getTimeFrameDateRange,
    isDateInTimeFrame,
    setWeekStartDay,
    getWeekStartDay
} from './date.utils'
export type { TimeFrameDateRange, WeekStartDay } from './date.utils'

// DOM utilities
export {
    CSS_CLASS,
    CSS_SELECTOR,
    DATA_ATTR,
    DATA_ATTR_FULL,
    prefersReducedMotion,
    setCssProps
} from './dom.utils'

// Logging utilities
export { log } from './log.utils'

// Validation utilities
export {
    isEmpty,
    validateText,
    validateNumber,
    validateBoolean,
    validateDate,
    validateDatetime,
    validateList,
    validateTags,
    parseListValue,
    parseTagsValue,
    // Input blocking utilities
    isValidNumberKeystroke,
    clampToRange,
    sanitizeNumberPaste,
    isInAllowedValues,
    isTagAllowed,
    setupNumberInputBlocking
} from './validation.utils'

// Value extraction utilities
export {
    extractNumber,
    extractNumberWithMapping,
    extractBoolean,
    extractDate,
    extractDisplayLabel,
    extractList,
    isDateLike,
    extractPropertyName
} from './value.utils'

// Export utilities (CSV / image export)
export { toCsv, sanitizeFilename } from './export.utils'
