import { Notice, type ObsidianProtocolData, type TFile } from 'obsidian'
import type { LifeTrackerPlugin } from '../plugin'
import { QuickAddModal } from '../components/modals/quick-add-modal'
import { FrontmatterService } from '../services/frontmatter.service'
import { PropertyRecognitionService } from '../services/property-recognition.service'
import {
    QUICK_ADD_PROTOCOL_ACTION,
    applyQuickAddAction,
    findQuickAddDefinition,
    parseQuickAddParams,
    resolveQuickAddDate,
    type QuickAddAction
} from '../services/quick-add.utils'
import { destinationName, withCaptureNote } from './capture-note'
import { resolveDefinitionTarget } from '../services/capture-target.utils'
import type { CaptureTarget } from '../types'
import { formatDateISO, isSameDay, log } from '../../utils'

const NO_DEFINITIONS_MESSAGE =
    'No property definitions configured. Add them in settings > Life Tracker > property definitions.'

/**
 * Register quick add (issue #122): a command and a ribbon icon that open the
 * quick-add panel, and an `obsidian://life-tracker-quick-add` link that logs a
 * value with no UI at all, for phone home-screen shortcuts.
 */
export function registerQuickAddCommand(plugin: LifeTrackerPlugin): void {
    const openPanel = (): void => {
        if (plugin.settings.propertyDefinitions.length === 0) {
            new Notice(NO_DEFINITIONS_MESSAGE)
            return
        }
        const activePath = plugin.app.workspace.getActiveFile()?.path ?? null
        new QuickAddModal(plugin, resolveQuickAddDate(activePath, new Date())).open()
    }

    plugin.addCommand({
        id: 'quick-add',
        name: 'Quick add',
        callback: openPanel
    })

    plugin.addRibbonIcon('circle-plus', 'Life Tracker: quick add', openPanel)

    plugin.registerObsidianProtocolHandler(QUICK_ADD_PROTOCOL_ACTION, (params) => {
        handleQuickAddLink(plugin, params)
    })
}

/**
 * Handle a quick-add link. Links always target today (or their `date`
 * parameter), never the open note: a home-screen shortcut must do the same
 * thing whatever happens to be open.
 */
function handleQuickAddLink(plugin: LifeTrackerPlugin, params: ObsidianProtocolData): void {
    const parsed = parseQuickAddParams(params)
    if (!parsed.ok) {
        new Notice(`Life Tracker quick add: ${parsed.error}`)
        return
    }

    if (plugin.settings.propertyDefinitions.length === 0) {
        new Notice(NO_DEFINITIONS_MESSAGE)
        return
    }

    const { request } = parsed
    const date = request.date ?? new Date()

    if (request.kind === 'open') {
        new QuickAddModal(plugin, date).open()
        return
    }

    const definition = findQuickAddDefinition(plugin.settings.propertyDefinitions, request.property)
    if (!definition) {
        new Notice(`Life Tracker quick add: no property named "${request.property}"`)
        return
    }

    // The property's capture target decides the note: the day's session note
    // for a session property, the daily note otherwise
    const target = resolveDefinitionTarget(definition, plugin.settings.captureTargets)
    withCaptureNote(plugin, target, date, (file: TFile) => {
        void applyToNote(plugin, file, definition.name, request.action, date, target)
    })
}

/**
 * Apply one action to a note and report the result in a notice.
 *
 * The definition is looked up again by name: the note may have just been
 * created, and settings could have changed while a confirmation was open.
 */
async function applyToNote(
    plugin: LifeTrackerPlugin,
    file: TFile,
    propertyName: string,
    action: QuickAddAction,
    date: Date,
    target: CaptureTarget | null
): Promise<void> {
    const definition = plugin.settings.propertyDefinitions.find((d) => d.name === propertyName)
    if (!definition) return
    const label = definition.displayName || definition.name

    // A capture target decides where its properties go: it already matched
    // the note by type, filter and date, and a note it just created may not
    // be fully indexed yet. Only the daily note is checked against mappings.
    if (
        !target &&
        !new PropertyRecognitionService(plugin.app).propertyAppliesToFile(file, definition)
    ) {
        new Notice(`Life Tracker quick add: ${label} does not apply to ${file.basename}`)
        return
    }

    const frontmatterService = new FrontmatterService(plugin.app)
    const current = frontmatterService.read(file)[definition.name]
    const result = applyQuickAddAction(definition, current, action)
    if (!result.ok) {
        new Notice(`Life Tracker quick add: ${result.error}`)
        return
    }

    const validation = frontmatterService.validate(result.value, definition)
    if (!validation.valid) {
        new Notice(`Life Tracker quick add: ${label}: ${validation.error ?? 'invalid value'}`)
        return
    }

    try {
        await frontmatterService.write(file, { [definition.name]: result.value })
    } catch (error: unknown) {
        log('Failed to save frontmatter', 'error', error)
        new Notice(`Failed to save "${label}" for ${file.basename} — your value was not persisted`)
        return
    }

    const day = isSameDay(date, new Date()) ? 'today' : formatDateISO(date)
    const where = target ? `, ${destinationName(target)}` : ''
    new Notice(`${label}: ${formatValue(result.value)} (${day}${where})`)
}

function formatValue(value: unknown): string {
    if (typeof value === 'boolean') return value ? '✓' : '✗'
    if (Array.isArray(value)) return value.map(String).join(', ')
    return String(value)
}
