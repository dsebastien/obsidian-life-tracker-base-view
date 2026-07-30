import type {
    DiscreteHeatmapColorScheme,
    GradientHeatmapColorScheme,
    HeatmapColorScheme
} from '../app/types'

/** Shared "no data" color for every built-in heatmap preset */
const HEATMAP_EMPTY_COLOR = 'var(--background-modifier-border)'

/**
 * Default GitHub-style heatmap color scheme (green)
 */
const DEFAULT_HEATMAP_COLORS: GradientHeatmapColorScheme = {
    kind: 'gradient',
    empty: HEATMAP_EMPTY_COLOR,
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
}

/**
 * Dark mode heatmap colors (inverted intensity)
 */
const DARK_HEATMAP_COLORS: GradientHeatmapColorScheme = {
    kind: 'gradient',
    empty: HEATMAP_EMPTY_COLOR,
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
}

/**
 * Named heatmap gradient presets.
 *
 * `viridis` and `cividis` are perceptually uniform and safe for color vision
 * deficiency (issue #136); cividis is specifically optimized for deuteranopia.
 * Both stay legible in grayscale, unlike the single-hue presets.
 */
export const HEATMAP_PRESETS: Record<string, GradientHeatmapColorScheme> = {
    green: DEFAULT_HEATMAP_COLORS,
    blue: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#c6e6ff', '#79c0ff', '#388bfd', '#1f6feb']
    },
    purple: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#d8b9ff', '#b87fff', '#8957e5', '#6e40c9']
    },
    orange: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#ffdfb6', '#ffc680', '#ffa657', '#f0883e']
    },
    red: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#ffc1c1', '#ff8080', '#ff4040', '#da3633']
    },
    viridis: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#440154', '#31688e', '#35b779', '#fde725']
    },
    cividis: {
        kind: 'gradient',
        empty: HEATMAP_EMPTY_COLOR,
        levels: ['#ebedf0', '#00224e', '#35618f', '#7d8e9a', '#fee838']
    }
}

/**
 * Names of the built-in heatmap gradient presets.
 */
export type HeatmapPresetName =
    | 'green'
    | 'blue'
    | 'purple'
    | 'orange'
    | 'red'
    | 'viridis'
    | 'cividis'

/**
 * Stored value meaning "no explicit heatmap scheme chosen": fall back to the
 * property's polarity (issue #21), then to the plugin default.
 *
 * Exists because Obsidian may write a declared view-option `default` into the
 * stored config, which would make an untouched setting look like a deliberate
 * choice and starve every lower-precedence default.
 */
export const HEATMAP_SCHEME_AUTO = 'auto'

/**
 * Canonical heatmap gradient options, shared by the view options dropdown, the
 * per-card popover and the settings preset dropdown.
 */
export const HEATMAP_COLOR_SCHEME_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'green', label: 'Green (GitHub)' },
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'orange', label: 'Orange' },
    { value: 'red', label: 'Red' },
    { value: 'viridis', label: 'Viridis (colorblind-friendly)' },
    { value: 'cividis', label: 'Cividis (colorblind-friendly)' }
]

/**
 * Okabe-Ito qualitative palette: the standard set of eight colors chosen to stay
 * distinguishable under deuteranopia, protanopia and tritanopia (issue #136).
 * Used for the `colorblind` chart scheme and to seed custom heatmap mappings.
 */
export const COLORBLIND_SAFE_PALETTE: readonly string[] = [
    '#0072b2', // blue
    '#e69f00', // orange
    '#009e73', // bluish green
    '#cc79a7', // reddish purple
    '#56b4e9', // sky blue
    '#d55e00', // vermillion
    '#f0e442', // yellow
    '#000000' // black
]

/**
 * Default 5-step ramp for a freshly created custom mapping (issue #82).
 * Diverging blue → orange rather than red → green: red/green is exactly the
 * axis most color vision deficiencies collapse (issue #136).
 */
const DEFAULT_DISCRETE_RAMP: readonly string[] = [
    '#0072b2', // blue — low
    '#56b4e9', // sky blue
    '#f0e442', // yellow — middle
    '#e69f00', // orange
    '#d55e00' // vermillion — high
]

/**
 * Build the scheme a user gets when first switching a heatmap to custom
 * mapping: values 1..5 on a colorblind-safe ramp, which covers the mood-style
 * 1..5 scales issue #82 was filed for.
 */
export function createDefaultDiscreteScheme(): DiscreteHeatmapColorScheme {
    const mapping: Record<string, string> = {}
    DEFAULT_DISCRETE_RAMP.forEach((color, index) => {
        mapping[String(index + 1)] = color
    })
    return {
        kind: 'discrete',
        empty: HEATMAP_EMPTY_COLOR,
        mapping
    }
}

/**
 * Color to pre-fill when the user adds a mapping entry: continue through the
 * colorblind-safe palette so added entries stay distinguishable from existing
 * ones without the user having to think about it.
 */
export function nextDiscreteEntryColor(existingCount: number): string {
    return COLORBLIND_SAFE_PALETTE[existingCount % COLORBLIND_SAFE_PALETTE.length]!
}

/**
 * Whether a heatmap scheme maps values directly to colors (issue #82)
 */
export function isDiscreteHeatmapScheme(
    scheme: HeatmapColorScheme
): scheme is DiscreteHeatmapColorScheme {
    return scheme.kind === 'discrete'
}

/**
 * Get color for a heatmap cell based on level (0-4).
 * Gradient schemes only — discrete schemes have no levels; go through
 * `resolveHeatmapCellColor` instead.
 */
export function getHeatmapColor(
    level: 0 | 1 | 2 | 3 | 4,
    scheme: GradientHeatmapColorScheme
): string {
    if (level === 0) return scheme.empty
    return scheme.levels[level] ?? scheme.empty
}

/**
 * Resolve the color of a single heatmap cell, whatever the scheme kind.
 * The single entry point renderers should use.
 *
 * Discrete schemes ignore `min`/`max` entirely: the point of a mapping is that
 * a value means the same thing regardless of the range around it.
 */
export function resolveHeatmapCellColor(
    value: number | null,
    scheme: HeatmapColorScheme,
    min: number,
    max: number
): string {
    if (value === null || value === undefined) return scheme.empty

    if (isDiscreteHeatmapScheme(scheme)) {
        return scheme.mapping[String(value)] ?? scheme.fallback ?? scheme.empty
    }

    return getHeatmapColor(getColorLevelForValue(value, min, max), scheme)
}

/**
 * Validate a `colorScheme` value read from view config as an inline heatmap
 * scheme, returning null when it is a preset name or unusable.
 *
 * View config comes from a `.base` file on disk, so it can be anything. A bare
 * `{ empty, levels }` object (the shape presets had before issue #82) is
 * upgraded to an explicit gradient scheme rather than rejected.
 */
export function normalizeHeatmapColorScheme(raw: unknown): HeatmapColorScheme | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null

    const candidate = raw as Record<string, unknown>
    const empty = typeof candidate['empty'] === 'string' ? candidate['empty'] : HEATMAP_EMPTY_COLOR

    if (candidate['kind'] === 'discrete') {
        const rawMapping = candidate['mapping']
        if (typeof rawMapping !== 'object' || rawMapping === null || Array.isArray(rawMapping)) {
            return null
        }

        const mapping: Record<string, string> = {}
        for (const [key, value] of Object.entries(rawMapping as Record<string, unknown>)) {
            if (typeof value === 'string' && value.length > 0) {
                mapping[key] = value
            }
        }

        const scheme: DiscreteHeatmapColorScheme = { kind: 'discrete', empty, mapping }
        if (typeof candidate['fallback'] === 'string') {
            scheme.fallback = candidate['fallback']
        }
        return scheme
    }

    // Gradient, either explicit or in the pre-#82 shape
    const rawLevels: unknown = candidate['levels']
    if (!Array.isArray(rawLevels) || rawLevels.length !== 5) return null

    const [level0, level1, level2, level3, level4] = rawLevels as unknown[]
    if (
        typeof level0 !== 'string' ||
        typeof level1 !== 'string' ||
        typeof level2 !== 'string' ||
        typeof level3 !== 'string' ||
        typeof level4 !== 'string'
    ) {
        return null
    }

    return {
        kind: 'gradient',
        empty,
        levels: [level0, level1, level2, level3, level4]
    }
}

/**
 * Map a value in [min, max] to a heatmap intensity level.
 *
 * - null/undefined → 0 (empty).
 * - When the scale floor is 0, value 0 also → 0. "Zero count" on a 0-based
 *   scale means absence (issue #87).
 * - Otherwise, present values map to levels 1-4 so cells at min stay
 *   visible (issue #76 — e.g. year-range heatmaps where min is the
 *   earliest year, not "no data").
 */
export function getColorLevelForValue(
    value: number | null,
    min: number,
    max: number
): 0 | 1 | 2 | 3 | 4 {
    if (value === null || value === undefined) return 0
    if (min === 0 && value === 0) return 0
    if (max === min) return 4

    const normalized = (value - min) / (max - min)

    if (normalized <= 0.25) return 1
    if (normalized <= 0.5) return 2
    if (normalized <= 0.75) return 3
    return 4
}

/**
 * Default chart color palette using Obsidian variables
 */
export const DEFAULT_CHART_COLORS: string[] = [
    'var(--color-blue)',
    'var(--color-green)',
    'var(--color-orange)',
    'var(--color-purple)',
    'var(--color-red)',
    'var(--color-cyan)',
    'var(--color-yellow)',
    'var(--color-pink)'
]

/**
 * Fallback chart colors (hex values for Chart.js)
 */
export const CHART_COLORS_HEX: string[] = [
    '#4c8bf5', // blue
    '#34a853', // green
    '#fbbc05', // orange
    '#9334e6', // purple
    '#ea4335', // red
    '#00bcd4', // cyan
    '#ffeb3b', // yellow
    '#e91e63' // pink
]

/**
 * Chart color scheme identifiers
 */
export type ChartColorScheme =
    | 'default'
    | 'green'
    | 'blue'
    | 'purple'
    | 'orange'
    | 'red'
    | 'colorblind'

/** Every valid chart scheme name, for runtime validation of stored config. */
export const CHART_COLOR_SCHEMES: readonly ChartColorScheme[] = [
    'default',
    'green',
    'blue',
    'purple',
    'orange',
    'red',
    'colorblind'
]

/**
 * Chart color presets - 8 distinct colors per scheme
 * Each scheme uses colors from the same color family
 */
export const CHART_COLOR_PRESETS: Record<ChartColorScheme, string[]> = {
    default: CHART_COLORS_HEX,
    green: ['#216e39', '#2ea043', '#3fb950', '#56d364', '#7ee787', '#aff5b4', '#d3f9d8', '#e6ffec'],
    blue: ['#1f6feb', '#388bfd', '#58a6ff', '#79c0ff', '#a5d6ff', '#c6e6ff', '#ddf4ff', '#f0f8ff'],
    purple: [
        '#6e40c9',
        '#8957e5',
        '#a371f7',
        '#b87fff',
        '#d2a8ff',
        '#d8b9ff',
        '#e8daff',
        '#f5f0ff'
    ],
    orange: [
        '#f0883e',
        '#ffa657',
        '#ffc680',
        '#ffdf5d',
        '#ffe58f',
        '#fff1c2',
        '#fff8dc',
        '#fffbe6'
    ],
    red: ['#da3633', '#f85149', '#ff7b72', '#ffa198', '#ffbdbb', '#ffc1c1', '#ffdcd9', '#ffebe9'],
    // Okabe-Ito: distinguishable under the common color vision deficiencies,
    // unlike the single-family presets above where adjacent series differ only
    // in lightness (issue #136)
    colorblind: [...COLORBLIND_SAFE_PALETTE]
}

/**
 * Canonical color scheme options shared by the settings preset dropdown and
 * the per-card context menu. Single source of truth for the available schemes.
 */
export const COLOR_SCHEME_OPTIONS: ReadonlyArray<{ value: ChartColorScheme; label: string }> = [
    { value: 'default', label: 'Default' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'orange', label: 'Orange' },
    { value: 'red', label: 'Red' },
    { value: 'colorblind', label: 'Colorblind-friendly' }
]

/**
 * Get chart colors for a specific scheme
 */
export function getChartColorScheme(scheme: ChartColorScheme | undefined): string[] {
    if (!scheme) return CHART_COLOR_PRESETS.default
    return CHART_COLOR_PRESETS[scheme] ?? CHART_COLOR_PRESETS.default
}

/**
 * Narrow a stored `colorScheme` to a chart scheme name.
 *
 * The field is shared with heatmaps, which may store an inline custom scheme
 * object or a heatmap-only preset name (issue #82) — neither means anything to
 * a chart, so both resolve to undefined (the default palette).
 */
export function asChartColorScheme(raw: unknown): ChartColorScheme | undefined {
    if (typeof raw !== 'string') return undefined
    return CHART_COLOR_SCHEMES.includes(raw as ChartColorScheme)
        ? (raw as ChartColorScheme)
        : undefined
}

/**
 * Semantic colors for boolean values.
 * Used to ensure consistent coloring in pie/doughnut charts
 * regardless of which value has more occurrences.
 */
export const BOOLEAN_COLORS = {
    true: '#34a853', // green - positive/yes
    false: '#ea4335' // red - negative/no
} as const

/**
 * Get semantic color for a boolean value
 */
export function getBooleanColor(value: string): string {
    const normalized = value.toLowerCase()
    if (normalized === 'true') return BOOLEAN_COLORS.true
    if (normalized === 'false') return BOOLEAN_COLORS.false
    return CHART_COLORS_HEX[0]! // fallback to first color
}

/**
 * Get chart color by index (cycles through palette)
 */
export function getChartColor(index: number, useHex = false): string {
    const colors = useHex ? CHART_COLORS_HEX : DEFAULT_CHART_COLORS
    return colors[index % colors.length]!
}

/**
 * Get color with alpha transparency
 */
export function getColorWithAlpha(color: string, alpha: number): string {
    // If it's a CSS variable, we can't modify it directly
    if (color.startsWith('var(')) {
        return color
    }

    // Handle hex colors
    if (color.startsWith('#')) {
        const hex = color.slice(1)
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    // Handle rgb/rgba
    if (color.startsWith('rgb')) {
        const match = color.match(/\d+/g)
        if (match && match.length >= 3) {
            const [r, g, b] = match
            return `rgba(${r}, ${g}, ${b}, ${alpha})`
        }
    }

    return color
}

/**
 * Generate gradient colors between two colors
 */
export function generateGradient(startColor: string, endColor: string, steps: number): string[] {
    // Simple implementation - returns interpolated colors
    // For production, consider using a color library
    const colors: string[] = []

    for (let i = 0; i < steps; i++) {
        const ratio = i / (steps - 1)
        colors.push(interpolateColor(startColor, endColor, ratio))
    }

    return colors
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1: string, color2: string, ratio: number): string {
    const hex1 = color1.replace('#', '')
    const hex2 = color2.replace('#', '')

    const r1 = parseInt(hex1.slice(0, 2), 16)
    const g1 = parseInt(hex1.slice(2, 4), 16)
    const b1 = parseInt(hex1.slice(4, 6), 16)

    const r2 = parseInt(hex2.slice(0, 2), 16)
    const g2 = parseInt(hex2.slice(2, 4), 16)
    const b2 = parseInt(hex2.slice(4, 6), 16)

    const r = Math.round(r1 + (r2 - r1) * ratio)
    const g = Math.round(g1 + (g2 - g1) * ratio)
    const b = Math.round(b1 + (b2 - b1) * ratio)

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Check if current theme is dark
 */
export function isDarkTheme(): boolean {
    return activeDocument.body.classList.contains('theme-dark')
}

/**
 * CSS variable names for heatmap color scheme
 */
const HEATMAP_CSS_VARS = {
    EMPTY: '--lt-heatmap-empty',
    LEVEL_0: '--lt-heatmap-level-0',
    LEVEL_1: '--lt-heatmap-level-1',
    LEVEL_2: '--lt-heatmap-level-2',
    LEVEL_3: '--lt-heatmap-level-3',
    LEVEL_4: '--lt-heatmap-level-4'
} as const

/**
 * Apply heatmap color scheme CSS variables to a container element.
 * This sets the CSS custom properties that control heatmap cell colors.
 *
 * No-op for discrete schemes: their colors are unbounded, so cells carry an
 * inline background instead of a level class (issue #82).
 *
 * @param element - The container element to apply colors to
 * @param colorScheme - The color scheme to apply
 */
export function applyHeatmapColorScheme(
    element: HTMLElement,
    colorScheme: HeatmapColorScheme
): void {
    if (!colorScheme || isDiscreteHeatmapScheme(colorScheme)) return

    element.style.setProperty(HEATMAP_CSS_VARS.EMPTY, colorScheme.empty)
    element.style.setProperty(HEATMAP_CSS_VARS.LEVEL_0, colorScheme.levels[0] ?? '')
    element.style.setProperty(HEATMAP_CSS_VARS.LEVEL_1, colorScheme.levels[1] ?? '')
    element.style.setProperty(HEATMAP_CSS_VARS.LEVEL_2, colorScheme.levels[2] ?? '')
    element.style.setProperty(HEATMAP_CSS_VARS.LEVEL_3, colorScheme.levels[3] ?? '')
    element.style.setProperty(HEATMAP_CSS_VARS.LEVEL_4, colorScheme.levels[4] ?? '')
}

/**
 * Get appropriate heatmap scheme for current theme
 */
export function getThemeAwareHeatmapColors(): GradientHeatmapColorScheme {
    return isDarkTheme() ? DARK_HEATMAP_COLORS : DEFAULT_HEATMAP_COLORS
}
