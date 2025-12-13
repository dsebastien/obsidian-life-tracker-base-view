import { BasesView, type BasesPropertyId, type QueryController, type TFile } from 'obsidian'
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
    type VisualizationDataPoint
} from '../types'
import { DateAnchorService } from '../services/date-anchor.service'
import { DataAggregationService } from '../services/data-aggregation.service'
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

    constructor(controller: QueryController, scrollEl: HTMLElement, plugin: LifeTrackerPlugin) {
        super(controller)

        this.plugin = plugin

        // Create container
        this.containerEl = scrollEl.createDiv({ cls: 'lt-container' })

        // Initialize services
        this.dateAnchorService = new DateAnchorService()
        this.aggregationService = new DataAggregationService()
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
        this.unsubscribeSettings = this.plugin.onSettingsChange(() => {
            log('Global settings changed, refreshing view', 'debug')
            this.onDataUpdated()
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
     * Get data points for a specific property
     */
    private getDataPointsForProperty(propertyId: BasesPropertyId): VisualizationDataPoint[] {
        const entries = this.data.data
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries)
        return this.aggregationService.createDataPoints(entries, propertyId, dateAnchors)
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

        // Clean up maximize state and existing visualizations
        this.maximizeService.cleanup()
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

        // Resolve date anchors for all entries
        const dateAnchors = this.dateAnchorService.resolveAllAnchors(entries)

        // Render each property
        for (const propertyId of propertyIds) {
            // Skip file properties for visualization
            if (propertyId.startsWith('file.')) continue

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
     * Called when view is unloaded
     */
    override onunload(): void {
        log('LifeTrackerView unloading', 'debug')

        // Unregister as file provider
        this.plugin.setActiveFileProvider(null)

        // Unsubscribe from settings changes
        if (this.unsubscribeSettings) {
            this.unsubscribeSettings()
            this.unsubscribeSettings = null
        }

        this.maximizeService.cleanup()
        this.destroyVisualizations()
    }
}
