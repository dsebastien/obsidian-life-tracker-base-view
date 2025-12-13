// Color utilities
export {
    DEFAULT_HEATMAP_COLORS,
    DARK_HEATMAP_COLORS,
    HEATMAP_PRESETS,
    getHeatmapColor,
    getColorLevelForValue,
    DEFAULT_CHART_COLORS,
    CHART_COLORS_HEX,
    getChartColor,
    getColorWithAlpha,
    generateGradient,
    isDarkTheme,
    getThemeAwareHeatmapColors
} from './color.utils'

// Date utilities
export {
    DATE_PATTERNS,
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
    formatDateISO,
    formatDateByGranularity,
    getMonthName,
    formatFileTitleWithWeekday
} from './date.utils'

// DOM utilities
export { CSS_CLASS, CSS_SELECTOR, DATA_ATTR, DATA_ATTR_FULL } from './dom.utils'

// Logging utilities
export { LOG_SEPARATOR, LOG_PREFIX, log } from './log.utils'

// Validation utilities
export {
    validateValue,
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
    coerceValue,
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
    extractDate,
    extractList,
    isDateLike,
    normalizeValue,
    getColorLevel
} from './value.utils'
