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
    getBooleanColor
} from './color.utils'

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
    formatDateISO,
    formatDateByGranularity,
    getMonthName,
    formatFileTitleWithWeekday
} from './date.utils'

// DOM utilities
export { CSS_CLASS, CSS_SELECTOR, DATA_ATTR, DATA_ATTR_FULL, setCssProps } from './dom.utils'

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
    extractBoolean,
    extractDate,
    extractDisplayLabel,
    extractList,
    isDateLike
} from './value.utils'
