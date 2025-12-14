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
import { showCardContextMenu } from '../components/ui/card-context-menu'
import { createGridControls, DEFAULT_GRID_SETTINGS } from '../components/ui/grid-controls'
import { DEFAULT_GRID_COLUMNS } from './view-options'
import { log, DATA_ATTR_FULL } from '../../utils'
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
    private visualizations: Map<BasesPropertyId, BaseVisualization> = new Map()

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
            (propertyId) => this.getDataPointsForProperty(propertyId)
        )

        // Subscribe to global settings changes
        this.unsubscribeSettings = this.plugin.onSettingsChange((_settings, changeInfo) => {
            this.handleSettingsChange(changeInfo)
        })

        // Register as active file provider for batch capture
        this.plugin.setActiveFileProvider(this)

        log('LifeTrackerView created', 'debug')
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
     * Get data points for a specific property (with caching)
     */
    private getDataPointsForProperty(propertyId: BasesPropertyId): VisualizationDataPoint[] {
        // Check cache first
        const cached = this.cacheService.getDataPoints(propertyId)
        if (cached) {
            return cached
        }

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
            dateAnchors
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
            log('onDataUpdated skipped (grid settings update only)', 'debug')
            return
        }

        log('onDataUpdated called', 'debug')

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

        // Check if we can do an incremental update (same structure, just data changed)
        const canIncrementalUpdate = this.canDoIncrementalUpdate(entries, propertyIds)

        if (canIncrementalUpdate) {
            // Fast path: update existing visualizations in place
            this.performIncrementalUpdate(entries)
            return
        }

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
        const savedCardHeight = this.config.get('cardMinHeight') as number | undefined
        this.gridSettings.columns = savedColumns ?? DEFAULT_GRID_COLUMNS
        this.gridSettings.cardMinHeight = savedCardHeight ?? DEFAULT_GRID_SETTINGS.cardMinHeight

        // Create control bar at the top
        createGridControls(this.containerEl, this.gridSettings, (settings) => {
            this.gridSettings = settings

            // Set flag to prevent full re-render when config.set triggers onDataUpdated
            this.isUpdatingGridSettings = true

            // Persist grid settings to view config
            this.config.set('gridColumns', settings.columns)
            this.config.set('cardMinHeight', settings.cardMinHeight)

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

        // Filter properties to render (skip file properties)
        const propertiesToRender = propertyIds.filter((id) => !id.startsWith('file.'))

        // Use async batched rendering to prevent UI freezing
        void this.renderPropertiesAsync(propertiesToRender, entries, dateAnchors, renderCycle)
    }

    /**
     * Check if we can do an incremental update (structure unchanged, only data values changed)
     */
    private canDoIncrementalUpdate(entries: BasesEntry[], propertyIds: BasesPropertyId[]): boolean {
        // Can't do incremental if no existing visualizations
        if (this.visualizations.size === 0) return false

        // Can't do incremental if grid doesn't exist
        if (!this.gridEl) return false

        // Check if the same properties are configured with the same visualization types
        const filteredIds = propertyIds.filter((id) => !id.startsWith('file.'))

        for (const propertyId of filteredIds) {
            const existingViz = this.visualizations.get(propertyId)
            if (!existingViz) {
                // A property doesn't have a visualization - can't be incremental
                // (might be unconfigured or newly added)
                continue
            }
        }

        // If we have visualizations and entries, we can try incremental
        return entries.length > 0 && this.visualizations.size > 0
    }

    /**
     * Perform incremental update - update existing visualizations with new data
     */
    private performIncrementalUpdate(entries: BasesEntry[]): void {
        log('Performing incremental update', 'debug')

        // Get date anchors (use cache)
        let dateAnchors = this.cacheService.getDateAnchors()
        if (!dateAnchors) {
            const anchorConfig = this.getDateAnchorConfig()
            dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)
            this.cacheService.setDateAnchors(dateAnchors)
        }

        // Update each visualization with new data
        for (const [propertyId, viz] of this.visualizations) {
            const dataPoints = this.aggregationService.createDataPoints(
                entries,
                propertyId,
                dateAnchors
            )
            this.cacheService.setDataPoints(propertyId, dataPoints)
            viz.update(dataPoints)
        }
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
                log('Render cycle cancelled', 'debug')
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
                    const dataPoints = this.aggregationService.createDataPoints(
                        entries,
                        propertyId,
                        dateAnchors
                    )
                    this.cacheService.setDataPoints(propertyId, dataPoints)
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

            // Schedule next batch if more properties to render
            if (index < propertiesToRender.length) {
                this.pendingRenderFrame = requestAnimationFrame(renderBatch)
            } else {
                this.pendingRenderFrame = null
                log(`Async render complete: ${propertiesToRender.length} properties`, 'debug')
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
        dataPoints: VisualizationDataPoint[],
        isFromPreset: boolean = false
    ): void {
        if (!this.gridEl) return

        const cardEl = this.gridEl.createDiv({
            cls: 'lt-card',
            attr: { [DATA_ATTR_FULL.PROPERTY_ID]: columnConfig.propertyId }
        })

        // Add context menu and touch handlers
        this.setupCardEventHandlers(cardEl, columnConfig, displayName, isFromPreset)

        // Create visualization
        const visualization = this.createVisualization(cardEl, columnConfig, displayName)

        // Wire up maximize callback
        visualization.setMaximizeCallback((propertyId, maximize) => {
            this.maximizeService.handleMaximizeToggle(propertyId, maximize)
        })

        // Set animation duration from plugin settings
        visualization.setAnimationDuration(this.plugin.settings.animationDuration)

        // Render and store
        visualization.render(dataPoints)
        this.visualizations.set(columnConfig.propertyId, visualization)
    }

    /**
     * Setup event handlers for card (context menu, touch)
     */
    private setupCardEventHandlers(
        cardEl: HTMLElement,
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        isFromPreset: boolean
    ): void {
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
     */
    private handleCardContextMenu(
        event: MouseEvent | TouchEvent,
        columnConfig: ColumnVisualizationConfig,
        displayName: string,
        isFromPreset: boolean
    ): void {
        const isMaximized = this.maximizeService.isMaximized(columnConfig.propertyId)
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
                    this.columnConfigService.saveColumnConfig(
                        columnConfig.propertyId,
                        action.visualizationType,
                        displayName,
                        undefined // Clear scale for new type
                    )
                } else {
                    this.columnConfigService.updateColumnConfig(columnConfig.propertyId, {
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
                    this.columnConfigService.saveColumnConfig(
                        columnConfig.propertyId,
                        columnConfig.visualizationType,
                        displayName,
                        action.scale
                    )
                } else {
                    this.columnConfigService.updateColumnConfig(columnConfig.propertyId, {
                        scale: action.scale
                    })
                }
                // Re-render the view
                this.onDataUpdated()
                break

            case 'resetConfig':
                this.columnConfigService.deleteColumnConfig(columnConfig.propertyId)
                // Re-render the view
                this.onDataUpdated()
                break

            case 'toggleMaximize': {
                const isCurrentlyMaximized = this.maximizeService.isMaximized(
                    columnConfig.propertyId
                )
                this.maximizeService.handleMaximizeToggle(
                    columnConfig.propertyId,
                    !isCurrentlyMaximized
                )
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

        const { columns, cardMinHeight } = this.gridSettings

        // Set CSS custom properties for grid layout
        this.gridEl.style.setProperty('--lt-grid-columns', String(columns))
        this.gridEl.style.setProperty('--lt-card-min-height', `${cardMinHeight}px`)
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
     * Handle settings changes with targeted updates when possible
     */
    private handleSettingsChange(changeInfo: SettingsChangeInfo): void {
        log('Settings changed', 'debug', changeInfo)

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
                    viz.setAnimationDuration(this.plugin.settings.animationDuration)
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
     * Refresh only the visualizations that use a specific preset
     */
    private refreshVisualizationsForPreset(presetId: string): void {
        const preset = this.plugin.settings.visualizationPresets.find((p) => p.id === presetId)
        const presetPattern = preset?.propertyNamePattern?.toLowerCase()

        // Find which visualizations use this preset
        const propertyIdsToRefresh: BasesPropertyId[] = []

        for (const propertyId of this.visualizations.keys()) {
            // Check if this property uses a preset (not local override)
            const localConfig = this.columnConfigService.getColumnConfig(propertyId)
            if (localConfig) {
                // Has local override, not using preset
                continue
            }

            // Extract raw property name to match against preset pattern
            const rawPropertyName = propertyId.includes('.')
                ? propertyId.substring(propertyId.indexOf('.') + 1)
                : propertyId
            const lowerRawName = rawPropertyName.toLowerCase()

            // Check if this property was using the preset (either matches or previously matched)
            // We need to refresh if the preset previously matched this property
            if (presetPattern && lowerRawName === presetPattern) {
                propertyIdsToRefresh.push(propertyId)
            } else {
                // Also check if this property might have matched a previous pattern
                // We need to re-evaluate all properties that don't have local config
                // since we don't know what the old pattern was
                propertyIdsToRefresh.push(propertyId)
            }
        }

        // Also check for unconfigured cards that might now match
        if (!this.gridEl) return

        if (propertyIdsToRefresh.length === 0) {
            log('No visualizations affected by preset change', 'debug')
            return
        }

        log('Refreshing visualizations for preset', 'debug', {
            presetId,
            propertyIds: propertyIdsToRefresh
        })

        // Refresh each affected visualization
        const entries = this.data.data
        const anchorConfig = this.getDateAnchorConfig()
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries, anchorConfig)

        for (const propertyId of propertyIdsToRefresh) {
            this.refreshSingleVisualization(propertyId, entries, dateAnchors)
        }
    }

    /**
     * Refresh a single visualization in place
     */
    private refreshSingleVisualization(
        propertyId: BasesPropertyId,
        entries: BasesEntry[],
        dateAnchors: Map<BasesEntry, ResolvedDateAnchor | null>
    ): void {
        if (!this.gridEl) return

        // Get the existing visualization and its card element
        const existingViz = this.visualizations.get(propertyId)
        if (!existingViz) {
            log('No existing visualization to refresh', 'debug', propertyId)
            return
        }

        // Find the card element for this visualization
        const cardEl = this.gridEl.querySelector(
            `[data-property-id="${propertyId}"]`
        ) as HTMLElement | null
        if (!cardEl) {
            log('No card element found for visualization', 'debug', propertyId)
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
        existingViz.destroy()
        this.visualizations.delete(propertyId)

        // Clear the card element
        cardEl.empty()

        // Create the new visualization in the same card
        const dataPoints = this.aggregationService.createDataPoints(
            entries,
            propertyId,
            dateAnchors
        )

        const visualization = this.createVisualization(cardEl, effectiveConfig.config, displayName)

        // Wire up maximize callback
        visualization.setMaximizeCallback((propId, maximize) => {
            this.maximizeService.handleMaximizeToggle(propId, maximize)
        })

        // Set animation duration
        visualization.setAnimationDuration(this.plugin.settings.animationDuration)

        // Render and store
        visualization.render(dataPoints)
        this.visualizations.set(propertyId, visualization)

        log('Refreshed single visualization', 'debug', propertyId)
    }

    /**
     * Called when view is unloaded
     */
    override onunload(): void {
        log('LifeTrackerView unloading', 'debug')

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
