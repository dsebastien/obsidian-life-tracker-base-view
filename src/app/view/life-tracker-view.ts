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
    TimeFrame,
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
import {
    DATA_ATTR_FULL,
    getTimeFrameDateRange,
    isDateInTimeFrame,
    type TimeFrameDateRange
} from '../../utils'

import { ColumnConfigService } from './column-config.service'
import { MaximizeStateService } from './maximize-state.service'
import { getVisualizationConfig } from './visualization-config.helper'

/**
 * Data attribute for visualization ID
 */
const DATA_ATTR_VISUALIZATION_ID = 'data-visualization-id'

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

    // Active visualizations (keyed by visualization ID)
    private visualizations: Map<
        string, // visualization ID
        {
            propertyId: BasesPropertyId
            propertyDisplayName: string
            visualization: BaseVisualization
        }
    > = new Map()

    // Track visualization types for change detection (keyed by visualization ID)
    private visualizationTypes: Map<string, VisualizationType> = new Map()

    // Track showEmptyValues setting for change detection (keyed by visualization ID)
    private visualizationShowEmptyValues: Map<string, boolean> = new Map()

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

    // Track previous time frame for change detection
    private previousTimeFrame: TimeFrame | null = null

    // ResizeObserver for handling viewport changes
    private resizeObserver: ResizeObserver | null = null
    private resizeTimeout: ReturnType<typeof setTimeout> | null = null

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

        // Set up ResizeObserver to handle viewport changes
        this.setupResizeObserver()
    }

    /**
     * Set up ResizeObserver to notify visualizations of size changes
     */
    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver(() => {
            // Debounce resize events to avoid excessive updates
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout)
            }
            this.resizeTimeout = setTimeout(() => {
                // Notify all visualizations of size change
                for (const viz of this.visualizations.values()) {
                    viz.visualization.handleResize()
                }
                this.resizeTimeout = null
            }, 100)
        })
        this.resizeObserver.observe(this.containerEl)
    }

    /**
     * Clean up ResizeObserver
     */
    private cleanupResizeObserver(): void {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout)
            this.resizeTimeout = null
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect()
            this.resizeObserver = null
        }
    }

    /**
     * Get all files currently in the view (for batch capture)
     * Filters by the configured time frame
     */
    getFiles(): TFile[] {
        const entries = this.data.data

        // Get time frame date range
        const timeFrameDateRange = getTimeFrameDateRange(this.gridSettings.timeFrame)

        // If no time frame filtering (AllTime), return all files
        if (!timeFrameDateRange) {
            return entries.map((entry) => entry.file)
        }

        // Resolve date anchors for filtering
        const dateAnchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, dateAnchorConfig)

        // Filter entries by time frame
        const filteredEntries = this.filterEntriesByTimeFrame(
            entries,
            dateAnchors,
            timeFrameDateRange
        )

        return filteredEntries.map((entry) => entry.file)
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

        // Get current time frame from config
        const currentTimeFrame = (this.config.get('timeFrame') as TimeFrame) ?? TimeFrame.AllTime

        if (canIncrementalUpdate) {
            // Fast path: update existing visualizations in place
            this.performIncrementalUpdate(entries)

            // If heatmap settings changed, refresh heatmaps without custom settings
            if (heatmapSettingsChanged) {
                this.refreshHeatmapsForGlobalSettingsChange()
            }

            // Update tracking
            this.previousHeatmapSettings = currentHeatmapSettings
            this.previousTimeFrame = currentTimeFrame
            return
        }

        // Update tracking for full re-render path
        this.previousHeatmapSettings = currentHeatmapSettings
        this.previousTimeFrame = currentTimeFrame

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
        const savedTimeFrame = this.config.get('timeFrame') as TimeFrame | undefined
        this.gridSettings.columns = savedColumns ?? DEFAULT_GRID_COLUMNS
        this.gridSettings.timeFrame = savedTimeFrame ?? TimeFrame.AllTime

        // Create control bar at the top
        createGridControls(this.containerEl, this.gridSettings, (settings) => {
            const timeFrameChanged = this.gridSettings.timeFrame !== settings.timeFrame
            this.gridSettings = settings

            // Set flag to prevent full re-render when config.set triggers onDataUpdated
            this.isUpdatingGridSettings = true

            // Persist grid settings to view config
            this.config.set('gridColumns', settings.columns)
            this.config.set('timeFrame', settings.timeFrame)

            // Reset flag after config updates
            this.isUpdatingGridSettings = false

            if (timeFrameChanged) {
                // Time frame changed - need full re-render to filter data
                this.onDataUpdated()
            } else {
                // Just columns changed - apply CSS changes, no full re-render needed
                this.applyGridSettings()
            }
        })

        // Create grid container
        this.gridEl = this.containerEl.createDiv({ cls: 'lt-grid' })
        this.applyGridSettings()

        // Resolve date anchors for all entries (cache them for reuse)
        const anchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
        this.cacheService.setDateAnchors(dateAnchors)

        // Filter entries based on time frame
        const timeFrameDateRange = getTimeFrameDateRange(this.gridSettings.timeFrame)
        const filteredEntries = this.filterEntriesByTimeFrame(
            entries,
            dateAnchors,
            timeFrameDateRange
        )

        // Check if any entries remain after filtering
        if (filteredEntries.length === 0) {
            createEmptyState(this.gridEl, 'No data available for the selected time frame', '📅')
            return
        }

        // Use async batched rendering to prevent UI freezing
        void this.renderPropertiesAsync(propertyIds, filteredEntries, dateAnchors, renderCycle)
    }

    /**
     * Filter entries based on time frame using their date anchors.
     * Returns all entries if dateRange is null (AllTime).
     */
    private filterEntriesByTimeFrame(
        entries: BasesEntry[],
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>,
        dateRange: TimeFrameDateRange | null
    ): BasesEntry[] {
        if (!dateRange) {
            return entries
        }

        return entries.filter((entry) => {
            const anchor = dateAnchors.get(entry)
            if (!anchor) {
                // No date anchor - include it (entry will show with no date)
                return true
            }
            return isDateInTimeFrame(anchor.date, dateRange)
        })
    }

    /**
     * Check if we can do an incremental update (structure unchanged, only data values changed)
     */
    private canDoIncrementalUpdate(entries: BasesEntry[], propertyIds: BasesPropertyId[]): boolean {
        // Can't do incremental if no existing visualizations
        if (this.visualizations.size === 0) return false

        // Can't do incremental if grid doesn't exist
        if (!this.gridEl) return false

        // Check if time frame has changed
        const currentTimeFrame = (this.config.get('timeFrame') as TimeFrame) ?? TimeFrame.AllTime
        if (this.previousTimeFrame !== null && this.previousTimeFrame !== currentTimeFrame) {
            return false
        }

        // Build set of property IDs that have existing visualizations
        const existingPropertyIds = new Set<BasesPropertyId>()
        for (const viz of this.visualizations.values()) {
            existingPropertyIds.add(viz.propertyId)
        }

        // Check if any properties were removed (existing visualizations not in new propertyIds)
        const propertyIdSet = new Set(propertyIds)
        for (const existingPropertyId of existingPropertyIds) {
            if (!propertyIdSet.has(existingPropertyId)) {
                // Property was removed - need full refresh to remove its card
                return false
            }
        }

        // Check if there are new properties that don't have visualizations yet
        // or if visualization type/count has changed
        for (const propertyId of propertyIds) {
            if (!existingPropertyIds.has(propertyId)) {
                // New property added - need full refresh to create its card
                return false
            }

            // Check if visualization count or type has changed for this property
            const displayName = this.config.getDisplayName(propertyId)
            const effectiveConfigs = this.columnConfigService.getEffectiveConfigs(
                propertyId,
                displayName
            )

            // Count existing visualizations for this property
            let existingVizCount = 0
            for (const [vizId, viz] of this.visualizations) {
                if (viz.propertyId === propertyId) {
                    existingVizCount++
                    // Check if type changed
                    const currentType = this.visualizationTypes.get(vizId)
                    const newConfig = effectiveConfigs.find((ec) => ec.config.id === vizId)
                    if (
                        newConfig &&
                        currentType &&
                        currentType !== newConfig.config.visualizationType
                    ) {
                        return false
                    }
                }
            }

            // Check if visualization count changed
            if (effectiveConfigs.length !== existingVizCount) {
                return false
            }

            if (effectiveConfigs.length === 0 && existingVizCount > 0) {
                // Property had a visualization but no longer has a config
                return false
            }

            // Check if showEmptyValues setting has changed (check first viz for property)
            const firstVizId = Array.from(this.visualizations.entries()).find(
                ([_, v]) => v.propertyId === propertyId
            )?.[0]
            if (firstVizId) {
                const currentShowEmptyValues = this.visualizationShowEmptyValues.get(firstVizId)
                const newShowEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
                if (
                    currentShowEmptyValues !== undefined &&
                    currentShowEmptyValues !== newShowEmptyValues
                ) {
                    return false
                }
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

        // Filter entries based on time frame
        const currentTimeFrame = (this.config.get('timeFrame') as TimeFrame) ?? TimeFrame.AllTime
        const timeFrameDateRange = getTimeFrameDateRange(currentTimeFrame)
        const filteredEntries = this.filterEntriesByTimeFrame(
            entries,
            dateAnchors,
            timeFrameDateRange
        )

        // Get showEmptyValues setting
        const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true

        this.visualizations.forEach((viz) => {
            // Update each visualization with new data (already filtered based on showEmptyValues)
            const dataPoints = this.aggregationService.createDataPoints(
                filteredEntries,
                viz.propertyId,
                viz.propertyDisplayName,
                dateAnchors,
                showEmptyValues
            )
            this.cacheService.setDataPoints(viz.propertyId, dataPoints)
            viz.visualization.update(dataPoints)
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
                const effectiveConfigs = this.columnConfigService.getEffectiveConfigs(
                    propertyId,
                    displayName
                )

                if (effectiveConfigs.length > 0) {
                    // Has configuration(s) (local overrides or global preset)
                    const showEmptyValues = (this.config.get('showEmptyValues') as boolean) ?? true
                    const dataPoints = this.aggregationService.createDataPoints(
                        entries,
                        propertyId,
                        displayName,
                        dateAnchors,
                        showEmptyValues
                    )
                    this.cacheService.setDataPoints(propertyId, dataPoints)

                    // Render all visualizations for this property
                    for (const effectiveConfig of effectiveConfigs) {
                        this.renderConfiguredColumn(
                            effectiveConfig.config,
                            displayName,
                            dataPoints,
                            effectiveConfigs.length > 1 // canRemove: only if multiple visualizations
                        )
                    }
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
     * @param canRemove - Whether the visualization can be removed (true when property has 2+ visualizations)
     */
    private renderConfiguredColumn(
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        dataPoints: VisualizationDataPoint[],
        canRemove: boolean
    ): void {
        if (!this.gridEl) return

        const cardEl = this.gridEl.createDiv({
            cls: 'lt-card',
            attr: {
                [DATA_ATTR_FULL.PROPERTY_ID]: columnConfig.propertyId,
                [DATA_ATTR_VISUALIZATION_ID]: columnConfig.id
            }
        })

        // Add context menu and touch handlers
        this.setupCardEventHandlers(
            cardEl,
            columnConfig.propertyId,
            columnConfig.id,
            displayName,
            canRemove
        )

        // Create visualization
        const visualization = this.createVisualization(cardEl, columnConfig, displayName)

        // Wire up maximize callback (using visualization ID)
        visualization.setMaximizeCallback((propertyId, maximize) => {
            this.maximizeService.handleMaximizeToggle(propertyId, maximize)
        })

        // Set animation duration from plugin settings
        visualization.setAnimationDuration(this.plugin.settings.animationDuration)

        // Render and store by visualization ID
        visualization.render(dataPoints)
        this.visualizations.set(columnConfig.id, {
            propertyId: columnConfig.propertyId,
            propertyDisplayName: displayName,
            visualization
        })
        this.visualizationTypes.set(columnConfig.id, columnConfig.visualizationType)
        this.visualizationShowEmptyValues.set(
            columnConfig.id,
            (this.config.get('showEmptyValues') as boolean) ?? true
        )
    }

    /**
     * Setup event handlers for card (context menu, touch)
     * Passes visualization ID and canRemove for context menu
     */
    private setupCardEventHandlers(
        cardEl: HTMLElement,
        propertyId: BasesPropertyId,
        visualizationId: string,
        displayName: string,
        canRemove: boolean
    ): void {
        // Add context menu handler (right-click)
        cardEl.addEventListener('contextmenu', (event) => {
            event.preventDefault()
            this.handleCardContextMenu(event, propertyId, visualizationId, displayName, canRemove)
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
                    this.handleCardContextMenu(
                        event,
                        propertyId,
                        visualizationId,
                        displayName,
                        canRemove
                    )
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
        visualizationId: string,
        displayName: string,
        canRemove: boolean
    ): void {
        // Fetch current config from service to ensure we show latest state
        const config = this.columnConfigService.getVisualizationConfig(propertyId, visualizationId)

        // If no local config, try to get from preset
        const effectiveConfig = config
            ? { config, isFromPreset: false }
            : this.columnConfigService.getEffectiveConfig(propertyId, displayName)

        if (!effectiveConfig) {
            // No config found - shouldn't happen for configured columns
            return
        }

        const { config: vizConfig, isFromPreset } = effectiveConfig
        const isMaximized = this.maximizeService.isMaximized(propertyId)

        // Get visualization config for heatmap-specific overrides
        const heatmapConfig: HeatmapMenuConfig | undefined =
            vizConfig.visualizationType === VisualizationType.Heatmap
                ? {
                      cellSize: vizConfig.heatmapCellSize,
                      showMonthLabels: vizConfig.heatmapShowMonthLabels,
                      showDayLabels: vizConfig.heatmapShowDayLabels
                  }
                : undefined

        showCardContextMenu(
            event,
            vizConfig.visualizationType,
            vizConfig.scale,
            vizConfig.colorScheme,
            heatmapConfig,
            isFromPreset,
            isMaximized,
            canRemove,
            (action: CardMenuAction) => {
                this.handleCardMenuAction(action, propertyId, visualizationId, displayName)
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
        visualizationId: string,
        displayName: string
    ): void {
        // Fetch current config from service
        const currentConfig = this.columnConfigService.getVisualizationConfig(
            propertyId,
            visualizationId
        )
        const isFromPreset = !currentConfig

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
                    this.columnConfigService.updateVisualizationConfig(
                        propertyId,
                        visualizationId,
                        {
                            visualizationType: action.visualizationType,
                            scale: undefined
                        }
                    )
                }
                // Full refresh to re-render all visualizations for this property
                this.onDataUpdated()
                break

            case 'configureScale':
                if (isFromPreset) {
                    // Create local override from preset with new scale
                    const preset = this.columnConfigService.findMatchingPreset(propertyId)
                    if (preset) {
                        this.columnConfigService.saveColumnConfig(
                            propertyId,
                            preset.visualizationType,
                            displayName,
                            action.scale,
                            preset.colorScheme
                        )
                    }
                } else {
                    this.columnConfigService.updateVisualizationConfig(
                        propertyId,
                        visualizationId,
                        { scale: action.scale }
                    )
                }
                this.onDataUpdated()
                break

            case 'configureColorScheme':
                if (isFromPreset) {
                    // Create local override from preset with new color scheme
                    const preset = this.columnConfigService.findMatchingPreset(propertyId)
                    if (preset) {
                        this.columnConfigService.saveColumnConfig(
                            propertyId,
                            preset.visualizationType,
                            displayName,
                            preset.scale,
                            action.colorScheme
                        )
                    }
                } else {
                    this.columnConfigService.updateVisualizationConfig(
                        propertyId,
                        visualizationId,
                        { colorScheme: action.colorScheme }
                    )
                }
                this.onDataUpdated()
                break

            case 'configureHeatmapCellSize':
                if (isFromPreset) {
                    const preset = this.columnConfigService.findMatchingPreset(propertyId)
                    if (preset) {
                        this.columnConfigService.saveColumnConfig(
                            propertyId,
                            preset.visualizationType,
                            displayName,
                            preset.scale,
                            preset.colorScheme
                        )
                    }
                }
                this.columnConfigService.updateVisualizationConfig(propertyId, visualizationId, {
                    heatmapCellSize: action.cellSize
                })
                this.onDataUpdated()
                break

            case 'configureHeatmapShowMonthLabels':
                if (isFromPreset) {
                    const preset = this.columnConfigService.findMatchingPreset(propertyId)
                    if (preset) {
                        this.columnConfigService.saveColumnConfig(
                            propertyId,
                            preset.visualizationType,
                            displayName,
                            preset.scale,
                            preset.colorScheme
                        )
                    }
                }
                this.columnConfigService.updateVisualizationConfig(propertyId, visualizationId, {
                    heatmapShowMonthLabels: action.showMonthLabels
                })
                this.onDataUpdated()
                break

            case 'configureHeatmapShowDayLabels':
                if (isFromPreset) {
                    const preset = this.columnConfigService.findMatchingPreset(propertyId)
                    if (preset) {
                        this.columnConfigService.saveColumnConfig(
                            propertyId,
                            preset.visualizationType,
                            displayName,
                            preset.scale,
                            preset.colorScheme
                        )
                    }
                }
                this.columnConfigService.updateVisualizationConfig(propertyId, visualizationId, {
                    heatmapShowDayLabels: action.showDayLabels
                })
                this.onDataUpdated()
                break

            case 'resetConfig':
                this.columnConfigService.resetVisualizationConfig(propertyId, visualizationId)
                this.onDataUpdated()
                break

            case 'toggleMaximize': {
                const isCurrentlyMaximized = this.maximizeService.isMaximized(propertyId)
                this.maximizeService.handleMaximizeToggle(propertyId, !isCurrentlyMaximized)
                break
            }

            case 'addVisualization': {
                // Add a new visualization by copying settings from the current one
                this.columnConfigService.addVisualization(propertyId, visualizationId)
                this.onDataUpdated()
                break
            }

            case 'removeVisualization': {
                // Remove this visualization (only allowed if property has 2+ visualizations)
                const removed = this.columnConfigService.removeVisualization(
                    propertyId,
                    visualizationId
                )
                if (removed) {
                    this.onDataUpdated()
                }
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
     * Triggers full refresh to simplify handling of multiple visualizations per property.
     */
    private refreshVisualizationsForPreset(_presetId: string): void {
        // With multiple visualizations per property, simplify by doing a full refresh
        this.onDataUpdated()
    }

    /**
     * Refresh heatmap visualizations that use global settings.
     * Triggers full refresh to simplify handling of multiple visualizations per property.
     */
    private refreshHeatmapsForGlobalSettingsChange(): void {
        // With multiple visualizations per property, simplify by doing a full refresh
        this.onDataUpdated()
    }

    /**
     * Called when view is unloaded
     */
    override onunload(): void {
        // Cancel any pending async render
        this.cancelPendingRender()

        // Clean up ResizeObserver
        this.cleanupResizeObserver()

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
