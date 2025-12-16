import {
    BasesView,
    type BasesEntry,
    type BasesPropertyId,
    type QueryController,
    type TFile
} from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import {
    DEFAULT_BATCH_FILTER_MODE,
    VisualizationType,
    type FileProvider,
    type CardMenuAction,
    type GridSettings,
    type BatchFilterMode,
    type ColumnVisualizationConfig,
    type ChartConfig,
    type HeatmapConfig,
    type TagCloudConfig,
    type VisualizationDataPoint,
    type SettingsChangeInfo,
    type ResolvedDateAnchor,
    type DateAnchorConfig
} from '../types'
import { DateAnchorService } from '../services/date-anchor.service'
import { DataAggregationService } from '../services/data-aggregation.service'
import { RenderCacheService } from '../services/render-cache.service'
import { BaseVisualization } from '../components/visualizations/base-visualization'
import { HeatmapVisualization } from '../components/visualizations/heatmap/heatmap-visualization'
import { ChartVisualization } from '../components/visualizations/chart/chart-visualization'
import { TagCloudVisualization } from '../components/visualizations/tag-cloud/tag-cloud-visualization'
import { TimelineVisualization } from '../components/visualizations/timeline/timeline-visualization'
import { createEmptyState, EMPTY_STATE_MESSAGES } from '../components/ui/empty-state'
import { createColumnConfigCard } from '../components/ui/column-config-card'
import { showCardContextMenu, type HeatmapMenuConfig } from '../components/ui/card-context-menu'
import { createGridControls, DEFAULT_GRID_SETTINGS } from '../components/ui/grid-controls'
import { DEFAULT_GRID_COLUMNS } from './view-options'
import { DATA_ATTR_FULL } from '../../utils'
import { ColumnConfigService } from './column-config.service'
import { MaximizeStateService } from './maximize-state.service'
import { getVisualizationConfig } from './visualization-config.helper'

/**
 * Number of visualizations to render per animation frame batch
 */
const RENDER_BATCH_SIZE = 3

/**
 * View type identifier
 */
export const LIFE_TRACKER_VIEW_TYPE = 'life-tracker'

/**
 * Life Tracker Base View implementation
 */
export class LifeTrackerView extends BasesView implements FileProvider {
    type = LIFE_TRACKER_VIEW_TYPE

    private plugin: LifeTrackerPlugin
    private containerEl: HTMLElement
    private gridEl: HTMLElement | null = null

    // Services
    private dateAnchorService: DateAnchorService
    private aggregationService: DataAggregationService
    private cacheService: RenderCacheService
    private columnConfigService: ColumnConfigService
    private maximizeService: MaximizeStateService

    // Active visualizations
    private visualizations: Map<
        BasesPropertyId,
        { propertyDisplayName: string; visualization: BaseVisualization }
    > = new Map()

    // Track visualization types for change detection
    private visualizationTypes: Map<BasesPropertyId, VisualizationType> = new Map()

    // Track showEmptyValues setting for change detection
    private visualizationShowEmptyValues: Map<BasesPropertyId, boolean> = new Map()

    // Grid settings (runtime state)
    private gridSettings: GridSettings = { ...DEFAULT_GRID_SETTINGS }

    // Flag to skip re-render when only grid settings change
    private isUpdatingGridSettings = false

    // Cleanup function for settings listener
    private unsubscribeSettings: (() => void) | null = null

    // Track pending render for cancellation
    private pendingRenderFrame: number | null = null

    // Track current render cycle for async rendering
    private currentRenderCycle: number = 0

    // Track previous heatmap settings for change detection
    private previousHeatmapSettings: {
        cellSize: number | undefined
        showMonthLabels: boolean | undefined
        showDayLabels: boolean | undefined
        colorScheme: string | undefined
    } | null = null

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: LifeTrackerPlugin) {
        super(controller)

        this.plugin = plugin

        // Create container
        this.containerEl = scrollEl.createDiv({ cls: 'lt-container' })

        // Initialize services
        this.dateAnchorService = new DateAnchorService()
        this.aggregationService = new DataAggregationService()
        this.cacheService = new RenderCacheService()
        this.columnConfigService = new ColumnConfigService(
            plugin,
            (key) => this.config.get(key),
            (key, value) => this.config.set(key, value)
        )
        this.maximizeService = new MaximizeStateService(
            this.containerEl,
            () => this.gridEl,
            () => this.visualizations,
            (propertyId, propertyDisplayName) => {
                // Get data points (already filtered based on showEmptyValues setting)
                const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
                return this.getDataPointsForProperty(
                    propertyId,
                    propertyDisplayName,
                    showEmptyValues
                )
            }
        )

        // Subscribe to global settings changes
        this.unsubscribeSettings = this.plugin.onSettingsChange((_settings, changeInfo) => {
            this.handleSettingsChange(changeInfo)
        })

        // Register as active file provider for batch capture
        this.plugin.setActiveFileProvider(this)
    }

    /**
     * Get all files currently in the view (for batch capture)
     */
    getFiles(): TFile[] {
        return this.data.data.map((entry) => entry.file)
    }

    /**
     * Get the filter mode for batch capture (Life Tracker view uses default)
     */
    getFilterMode(): BatchFilterMode {
        return DEFAULT_BATCH_FILTER_MODE
    }

    /**
     * Build date anchor config based on view settings.
     * If dateAnchorProperty is set, prioritize that property.
     */
    private getDateAnchorConfig(): DateAnchorConfig[] | undefined {
        const dateAnchorProperty = this.config.get('dateAnchorProperty') as
            | BasesPropertyId
            | undefined

        if (!dateAnchorProperty) {
            // No custom property set, use default behavior
            return undefined
        }

        // Build config that prioritizes the selected property
        return [
            // User-selected property gets highest priority
            this.dateAnchorService.createPropertyConfig(dateAnchorProperty, 0),
            // Then fall back to filename
            this.dateAnchorService.createFilenameConfig(1),
            // Then file creation time as last resort
            this.dateAnchorService.createMetadataConfig('ctime', 2)
        ]
    }

    /**
     * Get data points for a specific property (with caching).
     * When showEmptyValues is false, filters out entries without meaningful data.
     */
    private getDataPointsForProperty(
        propertyId: BasesPropertyId,
        propertyDisplayName: string,
        showEmptyValues: boolean
    ): VisualizationDataPoint[] {
        // Check cache first
        const cached = this.cacheService.getDataPoints(propertyId)
        if (cached) {
            return cached
        }

        // TODO add support for groupings
        const entries = this.data.data

        // Get or compute date anchors
        let dateAnchors = this.cacheService.getDateAnchors()
        if (!dateAnchors) {
            const anchorConfig = this.getDateAnchorConfig()
            dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
            this.cacheService.setDateAnchors(dateAnchors)
        }

        const dataPoints = this.aggregationService.createDataPoints(
            entries,
            propertyId,
            propertyDisplayName,
            dateAnchors,
            showEmptyValues
        )
        this.cacheService.setDataPoints(propertyId, dataPoints)
        return dataPoints
    }

    /**
     * Called when data changes - main render logic
     */
    override onDataUpdated(): void {
        // Skip full re-render if we're just updating grid settings
        if (this.isUpdatingGridSettings) {
            return
        }

        // Cancel any pending async render
        this.cancelPendingRender()

        // Increment render cycle to invalidate any in-flight async renders
        this.currentRenderCycle++
        const renderCycle = this.currentRenderCycle

        // Get entries and properties
        const entries = this.data.data
        const propertyIds = this.config.getOrder()

        // Start new cache cycle (invalidates stale cached data if entries changed)
        this.cacheService.startRenderCycle(entries)

        // Get current heatmap settings from view config
        const currentHeatmapSettings = {
            cellSize: this.config.get('heatmapCellSize') as number | undefined,
            showMonthLabels: this.config.get('heatmapShowMonthLabels') as boolean | undefined,
            showDayLabels: this.config.get('heatmapShowDayLabels') as boolean | undefined,
            colorScheme: this.config.get('heatmapColorScheme') as string | undefined
        }

        // Check if heatmap settings changed
        const heatmapSettingsChanged =
            this.previousHeatmapSettings !== null &&
            (this.previousHeatmapSettings.cellSize !== currentHeatmapSettings.cellSize ||
                this.previousHeatmapSettings.showMonthLabels !==
                    currentHeatmapSettings.showMonthLabels ||
                this.previousHeatmapSettings.showDayLabels !==
                    currentHeatmapSettings.showDayLabels ||
                this.previousHeatmapSettings.colorScheme !== currentHeatmapSettings.colorScheme)

        // Check if we can do an incremental update (same structure, just data changed)
        const canIncrementalUpdate = this.canDoIncrementalUpdate(entries, propertyIds)

        if (canIncrementalUpdate) {
            // Fast path: update existing visualizations in place
            this.performIncrementalUpdate(entries)

            // If heatmap settings changed, refresh heatmaps without custom settings
            if (heatmapSettingsChanged) {
                this.refreshHeatmapsForGlobalSettingsChange()
            }

            // Update tracking
            this.previousHeatmapSettings = currentHeatmapSettings
            return
        }

        // Update tracking for full re-render path
        this.previousHeatmapSettings = currentHeatmapSettings

        // Full re-render path
        this.maximizeService.cleanup()
        this.destroyVisualizations()
        this.containerEl.empty()

        if (entries.length === 0) {
            createEmptyState(this.containerEl, EMPTY_STATE_MESSAGES.noData, '📊')
            return
        }

        if (propertyIds.length === 0) {
            createEmptyState(this.containerEl, EMPTY_STATE_MESSAGES.noProperties, '⚙️')
            return
        }

        // Load grid settings from config
        const savedColumns = this.config.get('gridColumns') as number | undefined
        this.gridSettings.columns = savedColumns ?? DEFAULT_GRID_COLUMNS

        // Create control bar at the top
        createGridControls(this.containerEl, this.gridSettings, (settings) => {
            this.gridSettings = settings

            // Set flag to prevent full re-render when config.set triggers onDataUpdated
            this.isUpdatingGridSettings = true

            // Persist grid settings to view config
            this.config.set('gridColumns', settings.columns)

            // Reset flag after config updates
            this.isUpdatingGridSettings = false

            // Just apply CSS changes, no full re-render needed
            this.applyGridSettings()
        })

        // Create grid container
        this.gridEl = this.containerEl.createDiv({ cls: 'lt-grid' })
        this.applyGridSettings()

        // Resolve date anchors for all entries (cache them for reuse)
        const anchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
        this.cacheService.setDateAnchors(dateAnchors)

        // Use async batched rendering to prevent UI freezing
        void this.renderPropertiesAsync(propertyIds, entries, dateAnchors, renderCycle)
    }

    /**
     * Check if we can do an incremental update (structure unchanged, only data values changed)
     */
    private canDoIncrementalUpdate(entries: BasesEntry[], propertyIds: BasesPropertyId[]): boolean {
        // Can't do incremental if no existing visualizations
        if (this.visualizations.size === 0) return false

        // Can't do incremental if grid doesn't exist
        if (!this.gridEl) return false

        // Check if there are new properties that don't have visualizations yet
        // or if visualization type has changed
        for (const propertyId of propertyIds) {
            const existingViz = this.visualizations.get(propertyId)

            if (!existingViz) {
                // New property added - need full refresh to create its card
                // (whether it has a config or not - unconfigured shows config card)
                return false
            }

            // Check if visualization type has changed for existing visualizations
            const displayName = this.config.getDisplayName(propertyId)
            const effectiveConfig = this.columnConfigService.getEffectiveConfig(
                propertyId,
                displayName
            )
            if (effectiveConfig) {
                const currentType = this.visualizationTypes.get(propertyId)
                if (currentType && currentType !== effectiveConfig.config.visualizationType) {
                    return false
                }
            } else {
                // Property had a visualization but no longer has a config (e.g., after reset with no preset)
                // Need full refresh to show unconfigured state
                return false
            }

            // Check if showEmptyValues setting has changed
            const currentShowEmptyValues = this.visualizationShowEmptyValues.get(propertyId)
            const newShowEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
            if (
                currentShowEmptyValues !== undefined &&
                currentShowEmptyValues !== newShowEmptyValues
            ) {
                return false
            }
        }

        // If we have visualizations and entries, we can try incremental
        return entries.length > 0 && this.visualizations.size > 0
    }

    /**
     * Perform incremental update - update existing visualizations with new data
     */
    private performIncrementalUpdate(entries: BasesEntry[]): void {
        // Get date anchors (use cache)
        let dateAnchors = this.cacheService.getDateAnchors()
        if (!dateAnchors) {
            const anchorConfig = this.getDateAnchorConfig()
            dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
            this.cacheService.setDateAnchors(dateAnchors)
        }

        // Get showEmptyValues setting
        const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true

        this.visualizations.forEach((value, key) => {
            // Update each visualization with new data (already filtered based on showEmptyValues)
            const dataPoints = this.aggregationService.createDataPoints(
                entries,
                key,
                value.propertyDisplayName,
                dateAnchors,
                showEmptyValues
            )
            this.cacheService.setDataPoints(key, dataPoints)
            value.visualization.update(dataPoints)
        })
    }

    /**
     * Render properties asynchronously in batches to prevent UI freezing
     */
    private async renderPropertiesAsync(
        propertiesToRender: BasesPropertyId[],
        entries: BasesEntry[],
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>,
        renderCycle: number
    ): Promise<void> {
        let index = 0

        const renderBatch = (): void => {
            // Check if this render cycle is still current
            if (renderCycle !== this.currentRenderCycle) {
                return
            }

            const batchEnd = Math.min(index + RENDER_BATCH_SIZE, propertiesToRender.length)

            // Render a batch of properties
            for (; index < batchEnd; index++) {
                const propertyId = propertiesToRender[index]
                if (!propertyId) continue

                const displayName = this.config.getDisplayName(propertyId)
                const effectiveConfig = this.columnConfigService.getEffectiveConfig(
                    propertyId,
                    displayName
                )

                if (effectiveConfig) {
                    // Has configuration (local override or global preset)
                    const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
                    const dataPoints = this.aggregationService.createDataPoints(
                        entries,
                        propertyId,
                        displayName,
                        dateAnchors,
                        showEmptyValues
                    )
                    this.cacheService.setDataPoints(propertyId, dataPoints)
                    this.renderConfiguredColumn(effectiveConfig.config, displayName, dataPoints)
                } else {
                    // No configuration - show config card
                    this.renderUnconfiguredColumn(propertyId, displayName)
                }
            }

            // Schedule next batch if more properties to render
            if (index < propertiesToRender.length) {
                this.pendingRenderFrame = requestAnimationFrame(renderBatch)
            } else {
                this.pendingRenderFrame = null
            }
        }

        // Start rendering
        this.pendingRenderFrame = requestAnimationFrame(renderBatch)
    }

    /**
     * Cancel any pending async render
     */
    private cancelPendingRender(): void {
        if (this.pendingRenderFrame !== null) {
            cancelAnimationFrame(this.pendingRenderFrame)
            this.pendingRenderFrame = null
        }
    }

    /**
     * Render a configured column with its visualization
     */
    private renderConfiguredColumn(
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        dataPoints: VisualizationDataPoint[]
    ): void {
        if (!this.gridEl) return

        const cardEl = this.gridEl.createDiv({
            cls: 'lt-card',
            attr: { [DATA_ATTR_FULL.PROPERTY_ID]: columnConfig.propertyId }
        })

        // Add context menu and touch handlers (only pass propertyId to avoid stale config)
        this.setupCardEventHandlers(cardEl, columnConfig.propertyId, displayName)

        // Create visualization
        const visualization = this.createVisualization(cardEl, columnConfig, displayName)

        // Wire up maximize callback
        visualization.setMaximizeCallback((propertyId, maximize) => {
            this.maximizeService.handleMaximizeToggle(propertyId, maximize)
        })

        // Set animation duration from plugin settings
        visualization.setAnimationDuration(this.plugin.settings.animationDuration)

        // Render and store (data points are already filtered based on showEmptyValues)
        visualization.render(dataPoints)
        this.visualizations.set(columnConfig.propertyId, {
            propertyDisplayName: displayName,
            visualization
        })
        this.visualizationTypes.set(columnConfig.propertyId, columnConfig.visualizationType)
        this.visualizationShowEmptyValues.set(
            columnConfig.propertyId,
            (this.config.get('showEmptyValues') as boolean) ?? true
        )
    }

    /**
     * Setup event handlers for card (context menu, touch)
     * Only passes propertyId to avoid stale config references - config is fetched fresh when menu opens
     */
    private setupCardEventHandlers(
        cardEl: HTMLElement,
        propertyId: BasesPropertyId,
        displayName: string
    ): void {
        // Add context menu handler (right-click)
        cardEl.addEventListener('contextmenu', (event) => {
            event.preventDefault()
            this.handleCardContextMenu(event, propertyId, displayName)
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
                    this.handleCardContextMenu(event, propertyId, displayName)
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
    }

    /**
     * Create a visualization instance based on type
     */
    private createVisualization(
        cardEl: HTMLElement,
        columnConfig: ColumnVisualizationConfig,
        displayName: string
    ): BaseVisualization {
        const vizConfig = getVisualizationConfig(
            columnConfig.visualizationType,
            columnConfig,
            (key) => this.config.get(key)
        )

        switch (columnConfig.visualizationType) {
            case VisualizationType.Heatmap:
                return new HeatmapVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as HeatmapConfig
                )

            case VisualizationType.LineChart:
            case VisualizationType.BarChart:
            case VisualizationType.AreaChart:
            case VisualizationType.PieChart:
            case VisualizationType.DoughnutChart:
            case VisualizationType.RadarChart:
            case VisualizationType.PolarAreaChart:
            case VisualizationType.ScatterChart:
            case VisualizationType.BubbleChart:
                return new ChartVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as ChartConfig
                )

            case VisualizationType.TagCloud:
                return new TagCloudVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as TagCloudConfig
                )

            case VisualizationType.Timeline:
                return new TimelineVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig
                )

            default:
                // Fallback to heatmap
                return new HeatmapVisualization(
                    cardEl,
                    this.app,
                    columnConfig.propertyId,
                    displayName,
                    vizConfig as HeatmapConfig
                )
        }
    }

    /**
     * Handle context menu on a card
     * Fetches fresh config from service to ensure menu shows current state
     */
    private handleCardContextMenu(
        event: MouseEvent | TouchEvent,
        propertyId: BasesPropertyId,
        displayName: string
    ): void {
        // Fetch current config from service to ensure we show latest state
        const effectiveConfig = this.columnConfigService.getEffectiveConfig(propertyId, displayName)
        if (!effectiveConfig) {
            // No config found - shouldn't happen for configured columns
            return
        }

        const { config, isFromPreset } = effectiveConfig
        const isMaximized = this.maximizeService.isMaximized(propertyId)

        // Get local column config for heatmap-specific overrides
        const localConfig = this.columnConfigService.getColumnConfig(propertyId)
        const heatmapConfig: HeatmapMenuConfig | undefined =
            config.visualizationType === VisualizationType.Heatmap
                ? {
                      cellSize: localConfig?.heatmapCellSize,
                      showMonthLabels: localConfig?.heatmapShowMonthLabels,
                      showDayLabels: localConfig?.heatmapShowDayLabels
                  }
                : undefined

        showCardContextMenu(
            event,
            config.visualizationType,
            config.scale,
            config.colorScheme,
            heatmapConfig,
            isFromPreset,
            isMaximized,
            (action: CardMenuAction) => {
                this.handleCardMenuAction(action, propertyId, displayName)
            }
        )
    }

    /**
     * Handle menu action from context menu
     * Fetches fresh config from service to ensure actions use current state
     */
    private handleCardMenuAction(
        action: CardMenuAction,
        propertyId: BasesPropertyId,
        displayName: string
    ): void {
        // Fetch current config from service
        const effectiveConfig = this.columnConfigService.getEffectiveConfig(propertyId, displayName)
        const currentConfig = effectiveConfig?.config
        const isFromPreset = effectiveConfig?.isFromPreset ?? false

        switch (action.type) {
            case 'changeVisualization':
                if (isFromPreset) {
                    // Create local override from preset with new visualization type
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        action.visualizationType,
                        displayName,
                        undefined // Clear scale for new type
                    )
                } else {
                    this.columnConfigService.updateColumnConfig(propertyId, {
                        visualizationType: action.visualizationType,
                        scale: undefined
                    })
                }
                // Only refresh this specific visualization
                this.refreshVisualization(propertyId)
                break

            case 'configureScale':
                if (isFromPreset && currentConfig) {
                    // Create local override from preset with new scale
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        currentConfig.visualizationType,
                        displayName,
                        action.scale,
                        currentConfig.colorScheme
                    )
                } else {
                    this.columnConfigService.updateColumnConfig(propertyId, {
                        scale: action.scale
                    })
                }
                // Only refresh this specific visualization
                this.refreshVisualization(propertyId)
                break

            case 'configureColorScheme':
                if (isFromPreset && currentConfig) {
                    // Create local override from preset with new color scheme
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        currentConfig.visualizationType,
                        displayName,
                        currentConfig.scale,
                        action.colorScheme
                    )
                } else {
                    this.columnConfigService.updateColumnConfig(propertyId, {
                        colorScheme: action.colorScheme
                    })
                }
                // Only refresh this specific visualization
                this.refreshVisualization(propertyId)
                break

            case 'configureHeatmapCellSize':
                if (isFromPreset && currentConfig) {
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        currentConfig.visualizationType,
                        displayName,
                        currentConfig.scale,
                        currentConfig.colorScheme
                    )
                }
                this.columnConfigService.updateColumnConfig(propertyId, {
                    heatmapCellSize: action.cellSize
                })
                this.refreshVisualization(propertyId)
                break

            case 'configureHeatmapShowMonthLabels':
                if (isFromPreset && currentConfig) {
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        currentConfig.visualizationType,
                        displayName,
                        currentConfig.scale,
                        currentConfig.colorScheme
                    )
                }
                this.columnConfigService.updateColumnConfig(propertyId, {
                    heatmapShowMonthLabels: action.showMonthLabels
                })
                this.refreshVisualization(propertyId)
                break

            case 'configureHeatmapShowDayLabels':
                if (isFromPreset && currentConfig) {
                    this.columnConfigService.saveColumnConfig(
                        propertyId,
                        currentConfig.visualizationType,
                        displayName,
                        currentConfig.scale,
                        currentConfig.colorScheme
                    )
                }
                this.columnConfigService.updateColumnConfig(propertyId, {
                    heatmapShowDayLabels: action.showDayLabels
                })
                this.refreshVisualization(propertyId)
                break

            case 'resetConfig':
                this.columnConfigService.deleteColumnConfig(propertyId)
                // Only refresh this specific visualization
                this.refreshVisualization(propertyId)
                break

            case 'toggleMaximize': {
                const isCurrentlyMaximized = this.maximizeService.isMaximized(propertyId)
                this.maximizeService.handleMaximizeToggle(propertyId, !isCurrentlyMaximized)
                break
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
            this.columnConfigService.saveColumnConfig(
                propertyId,
                result.visualizationType,
                displayName,
                result.scale
            )
            this.onDataUpdated()
        })
    }

    /**
     * Apply current grid settings to the grid element
     */
    private applyGridSettings(): void {
        if (!this.gridEl) return

        const { columns } = this.gridSettings

        // Set CSS custom properties for grid layout
        this.gridEl.style.setProperty('--lt-grid-columns', String(columns))
    }

    /**
     * Clean up all visualizations
     */
    private destroyVisualizations(): void {
        for (const viz of this.visualizations.values()) {
            viz.visualization.destroy()
        }
        this.visualizations.clear()
        this.visualizationTypes.clear()
        this.visualizationShowEmptyValues.clear()
    }

    /**
     * Handle settings changes with targeted updates when possible
     */
    private handleSettingsChange(changeInfo: SettingsChangeInfo): void {
        switch (changeInfo.type) {
            case 'preset-updated':
            case 'preset-deleted':
                // Only refresh visualizations that use this preset
                this.refreshVisualizationsForPreset(changeInfo.presetId)
                break

            case 'preset-added':
                // New preset might match existing unconfigured properties
                // Do a full refresh to show the new configuration
                this.onDataUpdated()
                break

            case 'animation-duration-changed':
                // Just update animation duration on existing visualizations
                for (const viz of this.visualizations.values()) {
                    viz.visualization.setAnimationDuration(this.plugin.settings.animationDuration)
                }
                break

            case 'property-definitions-changed':
            case 'confetti-setting-changed':
                // These don't affect the visualization view, no refresh needed
                break

            case 'full':
            default:
                // Full refresh for unknown changes
                this.onDataUpdated()
                break
        }
    }

    /**
     * Refresh visualizations affected by a preset change.
     * For preset-updated: only refreshes visualizations matching the preset pattern.
     * For preset-deleted: refreshes all visualizations without local config.
     */
    private refreshVisualizationsForPreset(presetId: string): void {
        if (!this.gridEl) return

        // Try to find the preset (will exist for updates, not for deletes)
        const preset = this.plugin.settings.visualizationPresets.find((p) => p.id === presetId)
        const presetPattern = preset?.propertyNamePattern?.toLowerCase()

        // Collect properties to refresh
        const propertyIdsToRefresh: BasesPropertyId[] = []
        for (const propertyId of this.visualizations.keys()) {
            // Skip properties with local config (they don't use presets)
            if (this.columnConfigService.getColumnConfig(propertyId)) {
                continue
            }

            if (presetPattern) {
                // Preset exists (update case): only refresh if pattern matches
                const rawPropertyName = propertyId.includes('.')
                    ? propertyId.substring(propertyId.indexOf('.') + 1)
                    : propertyId
                if (rawPropertyName.toLowerCase() === presetPattern) {
                    propertyIdsToRefresh.push(propertyId)
                }
            } else {
                // Preset deleted: refresh all without local config
                propertyIdsToRefresh.push(propertyId)
            }
        }

        if (propertyIdsToRefresh.length === 0) return

        // Refresh each affected visualization
        const entries = this.data.data
        const anchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
        this.cacheService.setDateAnchors(dateAnchors)

        for (const propertyId of propertyIdsToRefresh) {
            this.refreshSingleVisualizationWithData(propertyId, entries, dateAnchors)
        }
    }

    /**
     * Refresh heatmap visualizations that use global settings.
     * Called when global heatmap settings (cellSize, showMonthLabels, showDayLabels, colorScheme) change.
     * Skips heatmaps with custom per-visualization settings.
     */
    private refreshHeatmapsForGlobalSettingsChange(): void {
        if (!this.gridEl) return

        // Collect heatmap visualizations that use global settings
        const propertyIdsToRefresh: BasesPropertyId[] = []

        for (const propertyId of this.visualizations.keys()) {
            // Check if this is a heatmap
            const vizType = this.visualizationTypes.get(propertyId)
            if (vizType !== VisualizationType.Heatmap) {
                continue
            }

            // Check if it has custom heatmap settings
            const localConfig = this.columnConfigService.getColumnConfig(propertyId)
            const hasCustomSettings =
                localConfig?.heatmapCellSize !== undefined ||
                localConfig?.heatmapShowMonthLabels !== undefined ||
                localConfig?.heatmapShowDayLabels !== undefined ||
                localConfig?.colorScheme !== undefined

            // Skip heatmaps with custom settings
            if (hasCustomSettings) {
                continue
            }

            propertyIdsToRefresh.push(propertyId)
        }

        if (propertyIdsToRefresh.length === 0) return

        // Refresh each affected heatmap
        const entries = this.data.data
        const anchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
        this.cacheService.setDateAnchors(dateAnchors)

        for (const propertyId of propertyIdsToRefresh) {
            this.refreshSingleVisualizationWithData(propertyId, entries, dateAnchors)
        }
    }

    /**
     * Refresh a single visualization in place.
     * Gets entries and date anchors from cache or computes them.
     */
    private refreshVisualization(propertyId: BasesPropertyId): void {
        if (!this.gridEl) return

        // Get entries and date anchors
        const entries = this.data.data
        let dateAnchors = this.cacheService.getDateAnchors()
        if (!dateAnchors) {
            const anchorConfig = this.getDateAnchorConfig()
            dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
            this.cacheService.setDateAnchors(dateAnchors)
        }

        this.refreshSingleVisualizationWithData(propertyId, entries, dateAnchors)
    }

    /**
     * Refresh a single visualization in place with provided data.
     * Used by refreshVisualization and refreshVisualizationsForPreset.
     */
    private refreshSingleVisualizationWithData(
        propertyId: BasesPropertyId,
        entries: BasesEntry[],
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>
    ): void {
        if (!this.gridEl) return

        // Get the existing visualization and its card element
        const existingViz = this.visualizations.get(propertyId)
        if (!existingViz) {
            return
        }

        // Find the card element for this visualization
        const cardEl = this.gridEl.querySelector(
            `[data-property-id="${propertyId}"]`
        ) as HTMLElement | null
        if (!cardEl) {
            return
        }

        // Get the display name
        const displayName = this.config.getDisplayName(propertyId)

        // Get the new effective config
        const effectiveConfig = this.columnConfigService.getEffectiveConfig(propertyId, displayName)

        if (!effectiveConfig) {
            // No longer has a config - property should become unconfigured
            // For simplicity, do a full refresh in this case
            this.onDataUpdated()
            return
        }

        // Destroy the old visualization
        existingViz.visualization.destroy()
        this.visualizations.delete(propertyId)
        this.visualizationTypes.delete(propertyId)
        this.visualizationShowEmptyValues.delete(propertyId)

        // Clear the card element
        cardEl.empty()

        // Create the new visualization in the same card
        const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
        const dataPoints = this.aggregationService.createDataPoints(
            entries,
            propertyId,
            displayName,
            dateAnchors,
            showEmptyValues
        )
        this.cacheService.setDataPoints(propertyId, dataPoints)

        const visualization = this.createVisualization(cardEl, effectiveConfig.config, displayName)

        // Wire up maximize callback
        visualization.setMaximizeCallback((propId, maximize) => {
            this.maximizeService.handleMaximizeToggle(propId, maximize)
        })

        // Set animation duration
        visualization.setAnimationDuration(this.plugin.settings.animationDuration)

        // Render and store (data points are already filtered based on showEmptyValues)
        visualization.render(dataPoints)
        this.visualizations.set(propertyId, {
            propertyDisplayName: displayName,
            visualization: visualization
        })
        this.visualizationTypes.set(propertyId, effectiveConfig.config.visualizationType)
        this.visualizationShowEmptyValues.set(propertyId, showEmptyValues)
    }

    /**
     * Called when view is unloaded
     */
    override onunload(): void {
        // Cancel any pending async render
        this.cancelPendingRender()

        // Unregister as file provider
        this.plugin.setActiveFileProvider(null)

        // Unsubscribe from settings changes
        if (this.unsubscribeSettings) {
            this.unsubscribeSettings()
            this.unsubscribeSettings = null
        }

        // Clear cache
        this.cacheService.clearAll()

        this.maximizeService.cleanup()
        this.destroyVisualizations()
    }
}
