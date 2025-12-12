import { BasesView, type BasesPropertyId, type QueryController } from 'obsidian'
import type { LifeTrackerBaseViewPlugin } from '../plugin'
import type { PropertyVisualizationPreset } from '../types/plugin-settings.intf'
import { DateAnchorService } from '../services/date-anchor.service'
import { DataAggregationService } from '../services/data-aggregation.service'
import { TimeGranularity } from '../domain/time-granularity.enum'
import { VisualizationType } from '../domain/visualization-type.enum'
import type {
    ColumnConfigMap,
    ColumnVisualizationConfig,
    ScaleConfig
} from '../types/column-config.types'
import type {
    ChartConfig,
    HeatmapConfig,
    TagCloudConfig,
    VisualizationConfig,
    VisualizationDataPoint
} from '../types/visualization.types'
import { BaseVisualization } from '../components/visualizations/base-visualization'
import { HeatmapVisualization } from '../components/visualizations/heatmap/heatmap-visualization'
import { ChartVisualization } from '../components/visualizations/chart/chart-visualization'
import { TagCloudVisualization } from '../components/visualizations/tag-cloud/tag-cloud-visualization'
import { TimelineVisualization } from '../components/visualizations/timeline/timeline-visualization'
import { createEmptyState, EMPTY_STATE_MESSAGES } from '../components/ui/empty-state'
import { createColumnConfigCard } from '../components/ui/column-config-card'
import { showCardContextMenu, type CardMenuAction } from '../components/ui/card-context-menu'
import {
    createGridControls,
    DEFAULT_GRID_SETTINGS,
    type GridSettings
} from '../components/ui/grid-controls'
import { DEFAULT_CELL_SIZE, DEFAULT_EMBEDDED_HEIGHT, DEFAULT_GRID_COLUMNS } from './view-options'
import { HEATMAP_PRESETS } from '../../utils/color-utils'
import { log } from '../../utils/log'

/**
 * View type identifier
 */
export const LIFE_TRACKER_VIEW_TYPE = 'life-tracker'

/**
 * Config key for storing column configurations
 */
const COLUMN_CONFIGS_KEY = 'columnConfigs'

/**
 * Life Tracker Base View implementation
 */
export class LifeTrackerView extends BasesView {
    type = LIFE_TRACKER_VIEW_TYPE

    private plugin: LifeTrackerBaseViewPlugin
    private containerEl: HTMLElement
    private gridEl: HTMLElement | null = null

    // Services
    private dateAnchorService: DateAnchorService
    private aggregationService: DataAggregationService

    // Active visualizations
    private visualizations: Map<BasesPropertyId, BaseVisualization> = new Map()

    // Grid settings (runtime state)
    private gridSettings: GridSettings = { ...DEFAULT_GRID_SETTINGS }

    // Maximized card state
    private maximizedPropertyId: BasesPropertyId | null = null
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null

    constructor(
        controller: QueryController,
        scrollEl: HTMLElement,
        plugin: LifeTrackerBaseViewPlugin
    ) {
        super(controller)

        this.plugin = plugin

        // Create container
        this.containerEl = scrollEl.createDiv({ cls: 'lt-container' })

        // Initialize services
        this.dateAnchorService = new DateAnchorService()
        this.aggregationService = new DataAggregationService()

        log('LifeTrackerView created', 'debug')
    }

    /**
     * Get stored column configurations
     */
    private getColumnConfigs(): ColumnConfigMap {
        return (this.config.get(COLUMN_CONFIGS_KEY) as ColumnConfigMap) ?? {}
    }

    /**
     * Save column configuration for a property
     */
    private saveColumnConfig(
        propertyId: BasesPropertyId,
        visualizationType: VisualizationType,
        displayName: string,
        scale?: ScaleConfig
    ): void {
        const configs = this.getColumnConfigs()
        const config: ColumnVisualizationConfig = {
            propertyId,
            visualizationType,
            displayName,
            configuredAt: Date.now()
        }
        if (scale) {
            config.scale = scale
        }
        configs[propertyId] = config
        this.config.set(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Get column config for a property (if exists as local override)
     */
    private getColumnConfig(propertyId: BasesPropertyId): ColumnVisualizationConfig | null {
        const configs = this.getColumnConfigs()
        return configs[propertyId] ?? null
    }

    /**
     * Find a matching global preset for a property name
     */
    private findMatchingPreset(displayName: string): PropertyVisualizationPreset | null {
        const presets = this.plugin.settings.visualizationPresets
        const lowerName = displayName.toLowerCase()

        for (const preset of presets) {
            if (preset.propertyNamePattern.toLowerCase() === lowerName) {
                return preset
            }
        }

        return null
    }

    /**
     * Get effective configuration for a property
     * Priority: local override > global preset > null (unconfigured)
     */
    private getEffectiveConfig(
        propertyId: BasesPropertyId,
        displayName: string
    ): { config: ColumnVisualizationConfig; isFromPreset: boolean } | null {
        // Check for local override first
        const localConfig = this.getColumnConfig(propertyId)
        if (localConfig) {
            return { config: localConfig, isFromPreset: false }
        }

        // Check for matching global preset
        const preset = this.findMatchingPreset(displayName)
        if (preset) {
            // Create a config from the preset
            const configFromPreset: ColumnVisualizationConfig = {
                propertyId,
                visualizationType: preset.visualizationType,
                displayName,
                configuredAt: 0, // Not persisted
                scale: preset.scale
            }
            return { config: configFromPreset, isFromPreset: true }
        }

        return null
    }

    /**
     * Called when data changes - main render logic
     */
    override onDataUpdated(): void {
        log('onDataUpdated called', 'debug')

        // Clean up maximize state and existing visualizations
        this.cleanupMaximizeState()
        this.destroyVisualizations()
        this.containerEl.empty()

        // Get entries and properties
        const entries = this.data.data
        const propertyIds = this.config.getOrder()

        if (entries.length === 0) {
            createEmptyState(this.containerEl, EMPTY_STATE_MESSAGES.noData, '📊')
            return
        }

        if (propertyIds.length === 0) {
            createEmptyState(this.containerEl, EMPTY_STATE_MESSAGES.noProperties, '⚙️')
            return
        }

        // Load grid columns from config
        const savedColumns = this.config.get('gridColumns') as number | undefined
        this.gridSettings.columns = savedColumns ?? DEFAULT_GRID_COLUMNS

        // Create control bar at the top
        createGridControls(this.containerEl, this.gridSettings, (settings) => {
            this.gridSettings = settings
            // Persist columns to view config
            this.config.set('gridColumns', settings.columns)
            this.applyGridSettings()
        })

        // Create grid container
        this.gridEl = this.containerEl.createDiv({ cls: 'lt-grid' })
        this.applyGridSettings()

        // Resolve date anchors for all entries
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries)

        // Render each property
        for (const propertyId of propertyIds) {
            // Skip file properties for visualization
            if (propertyId.startsWith('file.')) continue

            const displayName = this.config.getDisplayName(propertyId)
            const effectiveConfig = this.getEffectiveConfig(propertyId, displayName)

            if (effectiveConfig) {
                // Has configuration (local override or global preset)
                const dataPoints = this.aggregationService.createDataPoints(
                    entries,
                    propertyId,
                    dateAnchors
                )
                this.renderConfiguredColumn(
                    effectiveConfig.config,
                    displayName,
                    dataPoints,
                    effectiveConfig.isFromPreset
                )
            } else {
                // No configuration - show config card
                this.renderUnconfiguredColumn(propertyId, displayName)
            }
        }
    }

    /**
     * Render a configured column with its visualization
     */
    private renderConfiguredColumn(
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        dataPoints: VisualizationDataPoint[],
        isFromPreset: boolean = false
    ): void {
        if (!this.gridEl) return

        const cardEl = this.gridEl.createDiv({
            cls: 'lt-card',
            attr: { 'data-property-id': columnConfig.propertyId }
        })
        const vizConfig = this.getVisualizationConfig(columnConfig.visualizationType, columnConfig)

        // Add context menu handler (right-click)
        cardEl.addEventListener('contextmenu', (event) => {
            event.preventDefault()
            this.handleCardContextMenu(event, columnConfig, displayName, isFromPreset)
        })

        // Add long-touch support for context menu
        let longTouchTimer: ReturnType<typeof setTimeout> | null = null
        let touchStartPos: { x: number; y: number } | null = null

        cardEl.addEventListener('touchstart', (event) => {
            const touch = event.touches[0]
            if (touch) {
                touchStartPos = { x: touch.clientX, y: touch.clientY }
                longTouchTimer = setTimeout(() => {
                    event.preventDefault()
                    this.handleCardContextMenu(event, columnConfig, displayName, isFromPreset)
                }, 500) // 500ms long press
            }
        })

        cardEl.addEventListener('touchmove', (event) => {
            // Cancel long touch if finger moves too much
            if (longTouchTimer && touchStartPos) {
                const touch = event.touches[0]
                if (touch) {
                    const dx = Math.abs(touch.clientX - touchStartPos.x)
                    const dy = Math.abs(touch.clientY - touchStartPos.y)
                    if (dx > 10 || dy > 10) {
                        clearTimeout(longTouchTimer)
                        longTouchTimer = null
                    }
                }
            }
        })

        cardEl.addEventListener('touchend', () => {
            if (longTouchTimer) {
                clearTimeout(longTouchTimer)
                longTouchTimer = null
            }
            touchStartPos = null
        })

        cardEl.addEventListener('touchcancel', () => {
            if (longTouchTimer) {
                clearTimeout(longTouchTimer)
                longTouchTimer = null
            }
            touchStartPos = null
        })

        let visualization: BaseVisualization

        switch (columnConfig.visualizationType) {
            case VisualizationType.Heatmap:
                visualization = new HeatmapVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as HeatmapConfig
                )
                break

            case VisualizationType.LineChart:
            case VisualizationType.BarChart:
                visualization = new ChartVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as ChartConfig
                )
                break

            case VisualizationType.TagCloud:
                visualization = new TagCloudVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as TagCloudConfig
                )
                break

            case VisualizationType.Timeline:
                visualization = new TimelineVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig
                )
                break

            default:
                // Should not happen, but fallback to heatmap
                visualization = new HeatmapVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as HeatmapConfig
                )
        }

        // Wire up maximize callback
        visualization.setMaximizeCallback((propertyId, maximize) => {
            this.handleMaximizeToggle(propertyId, maximize)
        })

        // Render and store
        visualization.render(dataPoints)
        this.visualizations.set(columnConfig.propertyId, visualization)
    }

    /**
     * Handle context menu on a card
     */
    private handleCardContextMenu(
        event: MouseEvent | TouchEvent,
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        isFromPreset: boolean
    ): void {
        const isMaximized = this.maximizedPropertyId === columnConfig.propertyId
        showCardContextMenu(
            event,
            columnConfig.visualizationType,
            columnConfig.scale,
            isFromPreset,
            isMaximized,
            (action: CardMenuAction) => {
                this.handleCardMenuAction(action, columnConfig, displayName, isFromPreset)
            }
        )
    }

    /**
     * Handle menu action from context menu
     */
    private handleCardMenuAction(
        action: CardMenuAction,
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        isFromPreset: boolean
    ): void {
        switch (action.type) {
            case 'changeVisualization':
                if (isFromPreset) {
                    // Create local override from preset with new visualization type
                    this.saveColumnConfig(
                        columnConfig.propertyId,
                        action.visualizationType,
                        displayName,
                        undefined // Clear scale for new type
                    )
                } else {
                    this.updateColumnConfig(columnConfig.propertyId, {
                        visualizationType: action.visualizationType,
                        scale: undefined
                    })
                }
                // Re-render the view
                this.onDataUpdated()
                break

            case 'configureScale':
                if (isFromPreset) {
                    // Create local override from preset with new scale
                    this.saveColumnConfig(
                        columnConfig.propertyId,
                        columnConfig.visualizationType,
                        displayName,
                        action.scale
                    )
                } else {
                    this.updateColumnConfig(columnConfig.propertyId, {
                        scale: action.scale
                    })
                }
                // Re-render the view
                this.onDataUpdated()
                break

            case 'resetConfig':
                this.deleteColumnConfig(columnConfig.propertyId)
                // Re-render the view
                this.onDataUpdated()
                break

            case 'toggleMaximize': {
                const isCurrentlyMaximized = this.maximizedPropertyId === columnConfig.propertyId
                this.handleMaximizeToggle(columnConfig.propertyId, !isCurrentlyMaximized)
                break
            }
        }
    }

    /**
     * Update an existing column configuration (local override)
     */
    private updateColumnConfig(
        propertyId: BasesPropertyId,
        updates: Partial<ColumnVisualizationConfig>
    ): void {
        const configs = this.getColumnConfigs()
        const existing = configs[propertyId]
        if (existing) {
            configs[propertyId] = {
                ...existing,
                ...updates,
                configuredAt: Date.now()
            }
            this.config.set(COLUMN_CONFIGS_KEY, configs)
        }
    }

    /**
     * Delete a column configuration (reset to unconfigured state)
     */
    private deleteColumnConfig(propertyId: BasesPropertyId): void {
        const configs = this.getColumnConfigs()
        delete configs[propertyId]
        this.config.set(COLUMN_CONFIGS_KEY, configs)
    }

    /**
     * Handle maximize toggle for a card
     */
    private handleMaximizeToggle(propertyId: BasesPropertyId, maximize: boolean): void {
        const previousMaximized = this.maximizedPropertyId

        // Clean up any existing escape handler first
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }

        if (maximize) {
            this.maximizedPropertyId = propertyId

            // Add escape key handler - use arrow function that reads current state
            this.escapeHandler = (e: KeyboardEvent): void => {
                if (e.key === 'Escape' && this.maximizedPropertyId) {
                    e.preventDefault()
                    e.stopPropagation()
                    this.handleMaximizeToggle(this.maximizedPropertyId, false)
                }
            }
            document.addEventListener('keydown', this.escapeHandler)

            // Add maximized class to container
            this.containerEl.classList.add('lt-container--has-maximized')
        } else {
            this.maximizedPropertyId = null

            // Remove maximized class from container
            this.containerEl.classList.remove('lt-container--has-maximized')
        }

        // Update visualization states
        for (const [id, viz] of this.visualizations) {
            const isMaximized = id === this.maximizedPropertyId
            viz.setMaximized(isMaximized)
        }

        // Update card classes
        if (this.gridEl) {
            const cards = this.gridEl.querySelectorAll('.lt-card')
            cards.forEach((card) => {
                const cardPropertyId = card.getAttribute('data-property-id')
                if (cardPropertyId === this.maximizedPropertyId) {
                    card.classList.add('lt-card--maximized')
                } else {
                    card.classList.remove('lt-card--maximized')
                    if (this.maximizedPropertyId) {
                        card.classList.add('lt-card--hidden')
                    } else {
                        card.classList.remove('lt-card--hidden')
                    }
                }
            })
        }

        // Re-render the maximized visualization to fit new size
        if (maximize) {
            const viz = this.visualizations.get(propertyId)
            if (viz) {
                // Get data points for re-render
                const entries = this.data.data
                const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries)
                const dataPoints = this.aggregationService.createDataPoints(
                    entries,
                    propertyId,
                    dateAnchors
                )
                viz.update(dataPoints)
            }
        } else if (previousMaximized) {
            // Re-render the previously maximized visualization
            const viz = this.visualizations.get(previousMaximized)
            if (viz) {
                const entries = this.data.data
                const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries)
                const dataPoints = this.aggregationService.createDataPoints(
                    entries,
                    previousMaximized,
                    dateAnchors
                )
                viz.update(dataPoints)
            }
        }
    }

    /**
     * Render an unconfigured column with a config selection card
     */
    private renderUnconfiguredColumn(propertyId: BasesPropertyId, displayName: string): void {
        if (!this.gridEl) return

        createColumnConfigCard(this.gridEl, displayName, (result) => {
            // Save config and re-render
            this.saveColumnConfig(propertyId, result.visualizationType, displayName, result.scale)
            this.onDataUpdated()
        })
    }

    /**
     * Apply current grid settings to the grid element
     */
    private applyGridSettings(): void {
        if (!this.gridEl) return

        const { columns, cardMinHeight } = this.gridSettings

        // Set CSS custom properties for grid layout
        this.gridEl.style.setProperty('--lt-grid-columns', String(columns))
        this.gridEl.style.setProperty('--lt-card-min-height', `${cardMinHeight}px`)
    }

    /**
     * Get visualization configuration from view config
     */
    private getVisualizationConfig(
        vizType: VisualizationType,
        columnConfig: ColumnVisualizationConfig
    ): VisualizationConfig {
        const granularity =
            (this.config.get('granularity') as TimeGranularity) ?? TimeGranularity.Daily
        const showEmptyDates = (this.config.get('showEmptyDates') as boolean) ?? true
        const embeddedHeight =
            (this.config.get('embeddedHeight') as number) ?? DEFAULT_EMBEDDED_HEIGHT

        const baseConfig: VisualizationConfig = {
            granularity,
            showEmptyDates,
            embeddedHeight
        }

        // Extract scale from column config if present
        const scale = columnConfig.scale

        switch (vizType) {
            case VisualizationType.Heatmap: {
                const colorSchemeName = (this.config.get('heatmapColorScheme') as string) ?? 'green'
                const colorScheme = HEATMAP_PRESETS[colorSchemeName] ?? HEATMAP_PRESETS['green']!

                return {
                    ...baseConfig,
                    colorScheme,
                    cellSize: (this.config.get('heatmapCellSize') as number) ?? DEFAULT_CELL_SIZE,
                    cellGap: 2,
                    showMonthLabels: (this.config.get('heatmapShowMonthLabels') as boolean) ?? true,
                    showDayLabels: (this.config.get('heatmapShowDayLabels') as boolean) ?? true,
                    scale
                } as HeatmapConfig
            }

            case VisualizationType.LineChart:
            case VisualizationType.BarChart:
                return {
                    ...baseConfig,
                    chartType: vizType === VisualizationType.LineChart ? 'line' : 'bar',
                    showLegend: (this.config.get('chartShowLegend') as boolean) ?? false,
                    showGrid: (this.config.get('chartShowGrid') as boolean) ?? true,
                    tension: 0.3,
                    scale
                } as ChartConfig

            case VisualizationType.TagCloud:
                return {
                    ...baseConfig,
                    minFontSize: 12,
                    maxFontSize: 32,
                    sortBy:
                        (this.config.get('tagCloudSortBy') as 'frequency' | 'alphabetical') ??
                        'frequency',
                    maxTags: (this.config.get('tagCloudMaxTags') as number) ?? 50
                } as TagCloudConfig

            default:
                return baseConfig
        }
    }

    /**
     * Clean up all visualizations
     */
    private destroyVisualizations(): void {
        for (const viz of this.visualizations.values()) {
            viz.destroy()
        }
        this.visualizations.clear()
    }

    /**
     * Called when view is unloaded
     */
    override onunload(): void {
        log('LifeTrackerView unloading', 'debug')
        this.cleanupMaximizeState()
        this.destroyVisualizations()
    }

    /**
     * Clean up maximize state and handlers
     */
    private cleanupMaximizeState(): void {
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler)
            this.escapeHandler = null
        }
        this.maximizedPropertyId = null
        this.containerEl.classList.remove('lt-container--has-maximized')
    }
}
