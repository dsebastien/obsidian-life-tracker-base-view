import type { App, BasesPropertyId } from 'obsidian'
import { BaseVisualization } from '../base-visualization'
import type {
    ExportTable,
    ProgressConfig,
    ProgressData,
    ProgressPeriod,
    TargetConfig,
    VisualizationDataPoint,
    VisualizationDateRange
} from '../../../types'
import { aggregateForProgress, periodLabel } from '../../../services/progress-aggregation.utils'
import { TouchNavigationGate } from '../touch-navigation'
import { formatDateByGranularity, log, setCssProps } from '../../../../utils'

/**
 * Circular progress toward a goal target (issues #6 and #126).
 *
 * The ring shows the period the view ends in — the week you are in right now,
 * not an average of the whole range — because that is the only number you can
 * still act on. The range's hit rate goes underneath, where it reports the
 * trend without competing with the current number.
 */

/** Geometry of the ring, in SVG user units */
const RING_SIZE = 120
const RING_STROKE = 12
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * How many recent periods the strip shows. Bars share the available width, so
 * this is a history depth rather than a layout constraint.
 */
const RECENT_PERIOD_COUNT = 26

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Format a number for display: integers stay bare, fractions keep one decimal
 */
function formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * One-line statement of what the target asks for, e.g. "3 days per week"
 */
export function describeTarget(target: TargetConfig): string {
    const amount = formatAmount(target.value)
    const unit = target.unit ? ` ${target.unit}` : target.metric === 'count' ? ' entries' : ''
    const direction = target.direction === 'at-most' ? 'at most' : 'at least'
    return `${direction} ${amount}${unit} per ${periodLabel(target.period, 1)}`
}

export class ProgressVisualization extends BaseVisualization {
    private progressConfig: ProgressConfig
    private progressData: ProgressData | null = null
    private viewDateRange: VisualizationDateRange | null = null
    private readonly touchNavigation = new TouchNavigationGate()

    constructor(
        containerEl: HTMLElement,
        app: App,
        propertyId: BasesPropertyId,
        displayName: string,
        config: ProgressConfig
    ) {
        super(containerEl, app, propertyId, displayName, config)
        this.progressConfig = config
    }

    override setViewDateRange(range: VisualizationDateRange | null): void {
        this.viewDateRange = range
    }

    override render(data: VisualizationDataPoint[]): void {
        log(`Rendering progress ring for ${this.displayName}`, 'debug')

        const target = this.progressConfig.target

        this.containerEl.empty()
        this.createSectionHeader(this.cardTitle(target))

        if (!target?.enabled) {
            this.progressData = null
            this.renderMissingTarget()
            return
        }

        this.progressData = aggregateForProgress(
            data,
            this.propertyId,
            this.displayName,
            target,
            this.viewDateRange
        )

        const wrapper = this.containerEl.createDiv({ cls: 'lt-progress' })
        this.touchNavigation.observe(wrapper)

        this.renderRing(wrapper, this.progressData)
        this.renderTargetLine(wrapper, target)

        if (this.progressConfig.showHitRate !== false) {
            this.renderHitRate(wrapper, this.progressData)
            this.renderStreaks(wrapper, this.progressData)
            this.renderRecentPeriods(wrapper, this.progressData)
        }
    }

    /**
     * A property can carry several goals at once (days a week *and* reps a
     * week), and the card title is per property — so the goal goes in the
     * title, or the two rings would be indistinguishable at a glance.
     */
    private cardTitle(target: TargetConfig | undefined): string {
        if (!target?.enabled) return this.displayName

        const comparator = target.direction === 'at-most' ? '≤' : '≥'
        const amount = formatAmount(target.value)
        const unit = target.unit ? ` ${target.unit}` : ''
        // A rate only makes sense for metrics that accumulate: "≥ 150 reps per
        // week" reads right, "≤ 80 kg per week" does not
        const per =
            target.metric === 'count' || target.metric === 'sum'
                ? `/${periodLabel(target.period, 1)}`
                : ''

        return `${this.displayName} · ${comparator} ${amount}${unit}${per}`
    }

    override update(data: VisualizationDataPoint[]): void {
        // The card is small and entirely derived from the data, so a rebuild is
        // cheaper than a diff and cannot drift out of sync
        this.render(data)
    }

    override destroy(): void {
        this.touchNavigation.dispose()
        this.progressData = null
    }

    /**
     * Prompt shown when the type is chosen before a goal exists. Without it the
     * card would read as "no data" and send the user looking in the wrong place.
     */
    private renderMissingTarget(): void {
        const emptyEl = this.containerEl.createDiv({ cls: 'lt-progress-empty' })
        emptyEl.createDiv({ cls: 'lt-progress-empty-icon', text: '🎯' })
        emptyEl.createDiv({
            cls: 'lt-progress-empty-text',
            text: 'No target set. Right-click this card and choose "Configure target".'
        })
    }

    private renderRing(container: HTMLElement, data: ProgressData): void {
        const current = data.current
        const ratio = current?.ratio ?? 0
        const status = current?.status ?? 'behind'

        const ringEl = container.createDiv({ cls: `lt-progress-ring lt-progress-ring--${status}` })

        const svg = activeDocument.createElementNS(SVG_NS, 'svg')
        svg.setAttribute('viewBox', `0 0 ${RING_SIZE} ${RING_SIZE}`)
        svg.setAttribute('role', 'img')
        svg.setAttribute(
            'aria-label',
            status === 'no-data'
                ? `${this.displayName}: nothing recorded this ${periodLabel(data.target.period, 1)}`
                : `${this.displayName}: ${formatAmount(current?.actual ?? 0)} of ${formatAmount(
                      data.target.value
                  )}`
        )
        svg.classList.add('lt-progress-ring-svg')

        const track = activeDocument.createElementNS(SVG_NS, 'circle')
        track.classList.add('lt-progress-ring-track')
        track.setAttribute('cx', String(RING_SIZE / 2))
        track.setAttribute('cy', String(RING_SIZE / 2))
        track.setAttribute('r', String(RING_RADIUS))
        track.setAttribute('stroke-width', String(RING_STROKE))
        svg.appendChild(track)

        const arc = activeDocument.createElementNS(SVG_NS, 'circle')
        arc.classList.add('lt-progress-ring-arc')
        arc.setAttribute('cx', String(RING_SIZE / 2))
        arc.setAttribute('cy', String(RING_SIZE / 2))
        arc.setAttribute('r', String(RING_RADIUS))
        arc.setAttribute('stroke-width', String(RING_STROKE))
        arc.setAttribute('stroke-dasharray', String(RING_CIRCUMFERENCE))
        arc.setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * (1 - ratio)))
        svg.appendChild(arc)

        ringEl.appendChild(svg)

        const centerEl = ringEl.createDiv({ cls: 'lt-progress-ring-center' })
        centerEl.createDiv({
            cls: 'lt-progress-value',
            // An em dash, not a 0: nothing was recorded, which is not the same
            // as having recorded a zero (issue #6)
            text: status === 'no-data' ? '—' : formatAmount(current?.actual ?? 0)
        })
        centerEl.createDiv({
            cls: 'lt-progress-goal',
            text: `/ ${formatAmount(data.target.value)}${data.target.unit ? ` ${data.target.unit}` : ''}`
        })

        if (current && current.filePaths.length > 0) {
            ringEl.setAttribute('role', 'button')
            ringEl.setAttribute('tabindex', '0')
            ringEl.addEventListener('click', () => this.openCurrentPeriod(current))
            ringEl.addEventListener('keydown', (event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    this.openFilePaths(current.filePaths)
                }
            })
        }
    }

    /** Open the notes behind the ring, honoring the touch gate (issue #154) */
    private openCurrentPeriod(current: ProgressPeriod): void {
        if (!this.touchNavigation.shouldNavigate('current')) {
            return
        }
        this.openFilePaths(current.filePaths)
    }

    private renderTargetLine(container: HTMLElement, target: TargetConfig): void {
        container.createDiv({
            cls: 'lt-progress-target',
            text: describeTarget(target)
        })
    }

    private renderHitRate(container: HTMLElement, data: ProgressData): void {
        const measured = data.periods.filter((period) => period.status !== 'no-data').length
        const label = periodLabel(data.target.period, measured)
        container.createDiv({
            cls: 'lt-progress-hit-rate',
            text: `${data.metCount} of ${measured} ${label} met`
        })
    }

    /**
     * Streaks of periods that met the target (issue #100), the same row the
     * heatmap shows. A goal is mostly about not breaking the chain, so the
     * current and best runs belong next to the hit rate.
     */
    private renderStreaks(container: HTMLElement, data: ProgressData): void {
        const { currentStreak, longestStreak } = data.streaks
        const unit = (count: number): string => `${count} ${periodLabel(data.target.period, count)}`

        const streaksEl = container.createDiv({ cls: 'lt-progress-streaks' })
        streaksEl.createSpan({
            cls: 'lt-progress-streaks-item',
            text: `Streak: ${unit(currentStreak)}`
        })
        streaksEl.createSpan({
            cls: 'lt-progress-streaks-item',
            text: `Best: ${unit(longestStreak)}`
        })
    }

    /**
     * A strip of the most recent periods, one bar each, so the trend behind the
     * hit rate is visible without a second card
     */
    private renderRecentPeriods(container: HTMLElement, data: ProgressData): void {
        const recent = data.periods.slice(-RECENT_PERIOD_COUNT)
        if (recent.length === 0) return

        const stripEl = container.createDiv({ cls: 'lt-progress-strip' })

        for (const period of recent) {
            const barEl = stripEl.createDiv({
                cls: `lt-progress-strip-bar lt-progress-strip-bar--${period.status}`,
                attr: {
                    'title': `${formatDateByGranularity(period.date, data.target.period)}: ${formatAmount(
                        period.actual
                    )}`,
                    'aria-hidden': 'true'
                }
            })
            setCssProps(barEl, { height: `${Math.max(period.ratio, 0.08) * 100}%` })
        }
    }

    override getExportData(): ExportTable | null {
        const data = this.progressData
        if (!data) return null

        return {
            headers: ['Period', 'Value', 'Target', 'Met'],
            rows: data.periods.map((period) => [
                formatDateByGranularity(period.date, data.target.period),
                period.actual,
                data.target.value,
                period.met ? 'yes' : 'no'
            ])
        }
    }

    /** The ring is a single static figure: nothing to animate progressively */
    override supportsAnimation(): boolean {
        return false
    }
}
