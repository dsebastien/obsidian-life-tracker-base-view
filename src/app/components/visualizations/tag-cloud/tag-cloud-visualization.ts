import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    TagCloudConfig,
    TagCloudData,
    VisualizationDataPoint
} from '../../../types/visualization.types'
import { DataAggregationService } from '../../../services/data-aggregation.service'
import { Tooltip, formatTagTooltip } from '../../ui/tooltip'
import { log } from '../../../../utils/log'

/**
 * Tag cloud visualization for tags and lists
 */
export class TagCloudVisualization extends BaseVisualization {
    private tagCloudConfig: TagCloudConfig
    private aggregationService: DataAggregationService
    private tooltip: Tooltip | null = null
    private cloudEl: HTMLElement | null = null
    private tagCloudData: TagCloudData | null = null

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: TagCloudConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.tagCloudConfig = config
        this.aggregationService = new DataAggregationService()
    }

    /**
     * Render the tag cloud with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering tag cloud for ${this.displayName}`, 'debug')

        // Aggregate data
        this.tagCloudData = this.aggregationService.aggregateForTagCloud(
            data,
            this.propertyId,
            this.displayName
        )

        if (this.tagCloudData.tags.length === 0) {
            this.showEmptyState(`No data found for "${this.displayName}"`)
            return
        }

        // Clear container
        this.containerEl.empty()

        // Create section header
        this.createSectionHeader(this.displayName)

        // Create tag cloud container
        this.cloudEl = this.containerEl.createDiv({ cls: 'lt-tag-cloud' })

        // Create tooltip
        this.tooltip = new Tooltip(this.cloudEl)

        // Sort tags based on config
        let sortedTags = [...this.tagCloudData.tags]
        if (this.tagCloudConfig.sortBy === 'alphabetical') {
            sortedTags.sort((a, b) => a.tag.localeCompare(b.tag))
        }
        // Already sorted by frequency from aggregation service

        // Limit to max tags
        sortedTags = sortedTags.slice(0, this.tagCloudConfig.maxTags)

        // Render tags
        for (const tagItem of sortedTags) {
            const fontSize = this.calculateFontSize(
                tagItem.frequency,
                this.tagCloudData.maxFrequency
            )
            const sizeClass = this.getSizeClass(fontSize)

            const tagEl = this.cloudEl.createSpan({
                cls: `lt-tag ${sizeClass}`,
                text: tagItem.tag
            })

            // Store data
            tagEl.dataset['tag'] = tagItem.tag
            tagEl.dataset['frequency'] = String(tagItem.frequency)

            // Add event listeners
            tagEl.addEventListener('mouseenter', (e) => this.handleTagHover(e, tagEl))
            tagEl.addEventListener('mouseleave', () => this.handleTagLeave())
            tagEl.addEventListener('click', () => this.handleTagClick(tagItem.tag))
        }
    }

    /**
     * Update the tag cloud with new data
     */
    override update(data: VisualizationDataPoint[]): void {
        // Re-render for simplicity
        this.render(data)
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.tooltip?.destroy()
        this.tooltip = null
        this.cloudEl = null
        this.tagCloudData = null
    }

    /**
     * Calculate font size based on frequency
     */
    private calculateFontSize(frequency: number, maxFrequency: number): number {
        if (maxFrequency === 0) return this.tagCloudConfig.minFontSize

        const ratio = frequency / maxFrequency
        const range = this.tagCloudConfig.maxFontSize - this.tagCloudConfig.minFontSize
        return this.tagCloudConfig.minFontSize + ratio * range
    }

    /**
     * Get CSS class for size
     */
    private getSizeClass(fontSize: number): string {
        const range = this.tagCloudConfig.maxFontSize - this.tagCloudConfig.minFontSize
        const step = range / 5

        if (fontSize < this.tagCloudConfig.minFontSize + step) return 'lt-tag--xs'
        if (fontSize < this.tagCloudConfig.minFontSize + step * 2) return 'lt-tag--sm'
        if (fontSize < this.tagCloudConfig.minFontSize + step * 3) return 'lt-tag--md'
        if (fontSize < this.tagCloudConfig.minFontSize + step * 4) return 'lt-tag--lg'
        return 'lt-tag--xl'
    }

    /**
     * Handle tag hover - show tooltip
     */
    private handleTagHover(_event: MouseEvent, tagEl: HTMLElement): void {
        if (!this.tooltip) return

        const tag = tagEl.dataset['tag'] ?? ''
        const frequencyStr = tagEl.dataset['frequency']
        const frequency = frequencyStr ? parseInt(frequencyStr, 10) : 0

        const { title, value } = formatTagTooltip(tag, frequency)

        const rect = tagEl.getBoundingClientRect()
        this.tooltip.show(rect.left + rect.width / 2, rect.top - 10, title, value)
    }

    /**
     * Handle tag leave - hide tooltip
     */
    private handleTagLeave(): void {
        this.tooltip?.hide()
    }

    /**
     * Handle tag click - open related entries
     */
    private handleTagClick(tag: string): void {
        if (!this.tagCloudData) return

        const tagItem = this.tagCloudData.tags.find((t) => t.tag === tag)
        if (tagItem && tagItem.entries.length > 0) {
            this.openEntries(tagItem.entries)
        }
    }
}
