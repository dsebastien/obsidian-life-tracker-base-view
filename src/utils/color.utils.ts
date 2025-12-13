import type { HeatmapColorScheme } from '../app/types'

/**
 * Default GitHub-style heatmap color scheme (green)
 */
export const DEFAULT_HEATMAP_COLORS: HeatmapColorScheme = {
    empty: 'var(--background-modifier-border)',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
}

/**
 * Dark mode heatmap colors (inverted intensity)
 */
export const DARK_HEATMAP_COLORS: HeatmapColorScheme = {
    empty: 'var(--background-modifier-border)',
    levels: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']
}

/**
 * Alternative color schemes
 */
export const HEATMAP_PRESETS: Record<string, HeatmapColorScheme> = {
    green: DEFAULT_HEATMAP_COLORS,
    blue: {
        empty: 'var(--background-modifier-border)',
        levels: ['#ebedf0', '#c6e6ff', '#79c0ff', '#388bfd', '#1f6feb']
    },
    purple: {
        empty: 'var(--background-modifier-border)',
        levels: ['#ebedf0', '#d8b9ff', '#b87fff', '#8957e5', '#6e40c9']
    },
    orange: {
        empty: 'var(--background-modifier-border)',
        levels: ['#ebedf0', '#ffdfb6', '#ffc680', '#ffa657', '#f0883e']
    },
    red: {
        empty: 'var(--background-modifier-border)',
        levels: ['#ebedf0', '#ffc1c1', '#ff8080', '#ff4040', '#da3633']
    }
}

/**
 * Get color for a heatmap cell based on level (0-4)
 */
export function getHeatmapColor(level: 0 | 1 | 2 | 3 | 4, scheme: HeatmapColorScheme): string {
    if (level === 0) return scheme.empty
    return scheme.levels[level] ?? scheme.empty
}

/**
 * Get color level based on value and range
 */
export function getColorLevelForValue(
    value: number | null,
    min: number,
    max: number
): 0 | 1 | 2 | 3 | 4 {
    if (value === null || value === undefined) return 0
    if (max === min) return value > 0 ? 4 : 0

    const normalized = (value - min) / (max - min)

    if (normalized <= 0) return 0
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
    return document.body.classList.contains('theme-dark')
}

/**
 * CSS variable names for heatmap color scheme
 */
export const HEATMAP_CSS_VARS = {
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
 * @param element - The container element to apply colors to
 * @param colorScheme - The color scheme to apply
 */
export function applyHeatmapColorScheme(
    element: HTMLElement,
    colorScheme: HeatmapColorScheme
): void {
    if (!colorScheme) return

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
export function getThemeAwareHeatmapColors(): HeatmapColorScheme {
    return isDarkTheme() ? DARK_HEATMAP_COLORS : DEFAULT_HEATMAP_COLORS
}
