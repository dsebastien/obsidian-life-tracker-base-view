import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    ExportTable,
    TagCloudConfig,
    TagCloudData,
    VisualizationDataPoint
} from '../../../types'
import { sharedAggregationService } from '../../../services/data-aggregation.service'
import { Tooltip, formatTagTooltip } from '../../ui/tooltip'
import { log } from '../../../../utils'

/**
 * Tag cloud visualization for tags and lists
 */
/**
 * Separator for signature parts: a unit separator can't appear in a tag name,
 * so no tag text can forge a signature match.
 */
const SIGNATURE_SEPARATOR = '\u001f'

/**
 * Signature of what is currently rendered, used to skip no-op updates
 * (issue #104): the tags in render order with their frequencies, plus the
 * overall max frequency — font sizes are relative to it, so a change outside
 * the rendered slice still resizes the visible tags.
 */
function signatureOf(tags: TagCloudData['tags'], maxFrequency: number): string {
    return [String(maxFrequency), ...tags.map((tag) => `${tag.tag}=${tag.frequency}`)].join(
        SIGNATURE_SEPARATOR
    )
}

/** Same tags in the same order, regardless of frequency */
function sameTagOrder(a: TagCloudData['tags'], b: TagCloudData['tags']): boolean {
    if (a.length !== b.length) return false
    return a.every((tag, index) => tag.tag === b[index]?.tag)
}

export class TagCloudVisualization extends BaseVisualization {
    private tagCloudConfig: TagCloudConfig
    private tooltip: Tooltip | null = null
    private cloudEl: HTMLElement | null = null
    private tagCloudData: TagCloudData | null = null
    /** Tags actually rendered, in render order (sorted + capped) */
    private renderedTags: TagCloudData['tags'] = []
    private renderedSignature: string | null = null

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: TagCloudConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.tagCloudConfig = config
    }

    /**
     * Render the tag cloud with data
     */
    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering tag cloud for ${this.displayName}`, 'debug')

        // Each render builds a fresh tooltip; drop the previous one so repeated
        // structural updates don't accumulate orphaned tooltip elements
        this.tooltip?.destroy()
        this.tooltip = null

        // Aggregate data (use shared service)
        this.tagCloudData = sharedAggregationService.aggregateForTagCloud(
            data,
            this.propertyId,
            this.displayName
        )

        if (this.tagCloudData.tags.length === 0) {
            this.renderedTags = []
            this.renderedSignature = null
            this.cloudEl = null
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

        const sortedTags = this.selectTags(this.tagCloudData)
        this.renderedTags = sortedTags
        this.renderedSignature = signatureOf(sortedTags, this.tagCloudData.maxFrequency)

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
     * Sorted, capped list of tags in render order
     */
    private selectTags(tagCloudData: TagCloudData): TagCloudData['tags'] {
        const tags = [...tagCloudData.tags]
        if (this.tagCloudConfig.sortBy === 'alphabetical') {
            tags.sort((a, b) => a.tag.localeCompare(b.tag))
        }
        // Already sorted by frequency from aggregation service
        return tags.slice(0, this.tagCloudConfig.maxTags)
    }

    /**
     * Update the tag cloud, avoiding DOM work when nothing visible changed
     * (issue #104). Unrelated property edits trigger view-wide updates, and a
     * full teardown + re-render per update was the dominant cost.
     */
    override update(data: VisualizationDataPoint[]): void {
        if (!this.cloudEl || this.renderedSignature === null) {
            this.render(data)
            return
        }

        const newData = sharedAggregationService.aggregateForTagCloud(
            data,
            this.propertyId,
            this.displayName
        )

        if (newData.tags.length === 0) {
            this.render(data)
            return
        }

        const newTags = this.selectTags(newData)

        // Identical content: keep the DOM untouched
        if (signatureOf(newTags, newData.maxFrequency) === this.renderedSignature) {
            this.tagCloudData = newData
            this.renderedTags = newTags
            return
        }

        // Same tags in the same order: only the sizes and tooltips move
        if (!sameTagOrder(newTags, this.renderedTags)) {
            this.render(data)
            return
        }

        const tagEls = this.cloudEl.querySelectorAll<HTMLElement>('.lt-tag')
        if (tagEls.length !== newTags.length) {
            this.render(data)
            return
        }

        tagEls.forEach((tagEl, index) => {
            const tagItem = newTags[index]
            if (!tagItem) return

            const fontSize = this.calculateFontSize(tagItem.frequency, newData.maxFrequency)
            const sizeClass = this.getSizeClass(fontSize)

            tagEl.className = `lt-tag ${sizeClass}`
            tagEl.dataset['frequency'] = String(tagItem.frequency)
        })

        this.tagCloudData = newData
        this.renderedTags = newTags
        this.renderedSignature = signatureOf(newTags, newData.maxFrequency)
    }

    /**
     * Tabular view of the currently rendered tags (issue #102)
     */
    override getExportData(): ExportTable | null {
        if (!this.tagCloudData) return null
        return {
            headers: ['Tag', 'Frequency'],
            rows: this.tagCloudData.tags.map((tag) => [tag.tag, tag.frequency])
        }
    }

    /**
     * Clean up resources
     */
    override destroy(): void {
        this.tooltip?.destroy()
        this.tooltip = null
        this.cloudEl = null
        this.tagCloudData = null
        this.renderedTags = []
        this.renderedSignature = null
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
     * Handle tag click - open related files
     */
    private handleTagClick(tag: string): void {
        if (!this.tagCloudData) return

        const tagItem = this.tagCloudData.tags.find((t) => t.tag === tag)
        if (tagItem && tagItem.filePaths.length > 0) {
            this.openFilePaths(tagItem.filePaths)
        }
    }
}
