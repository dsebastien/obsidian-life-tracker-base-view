import type { LifeTrackerPlugin } from '../plugin'
import type { CaptureTarget } from '../types'
import { captureToday } from './capture-command'
import { destinationName } from './capture-note'

/** Prefix of the per-target command ids; the target id follows */
export const CAPTURE_TARGET_COMMAND_PREFIX = 'capture-today-target-'

/** Command id of a target's "Capture today" command (without the plugin prefix) */
export function captureTargetCommandId(target: Pick<CaptureTarget, 'id'>): string {
    return `${CAPTURE_TARGET_COMMAND_PREFIX}${target.id}`
}

/** Command name of a target's "Capture today" command */
export function captureTargetCommandName(target: CaptureTarget): string {
    return `Capture today: ${destinationName(target)}`
}

/** What changes to apply to the registered per-target commands */
export interface CommandSyncPlan {
    /** Command ids to remove (target deleted, or renamed and re-added) */
    remove: string[]
    /** Targets whose command must be (re-)added */
    add: CaptureTarget[]
}

/**
 * Compare the registered commands (id → name) with the targets. A rename is a
 * remove + add: Obsidian has no way to rename a registered command.
 */
export function planCommandSync(
    registered: ReadonlyMap<string, string>,
    targets: readonly CaptureTarget[]
): CommandSyncPlan {
    const wanted = new Map(
        targets.map((target) => [captureTargetCommandId(target), captureTargetCommandName(target)])
    )
    const remove: string[] = []
    for (const [id, name] of registered) {
        if (wanted.get(id) !== name) remove.push(id)
    }
    const add = targets.filter(
        (target) =>
            registered.get(captureTargetCommandId(target)) !== captureTargetCommandName(target)
    )
    return { remove, add }
}

/** Commands registered per plugin instance: id → name */
const registeredByPlugin = new WeakMap<LifeTrackerPlugin, Map<string, string>>()

/**
 * Bring the per-target "Capture today: <target>" commands in line with the
 * settings: one command per target, added, renamed and removed as targets
 * change. Cheap when nothing changed, so it can run on every settings change.
 */
export function syncCaptureTargetCommands(plugin: LifeTrackerPlugin): void {
    let registered = registeredByPlugin.get(plugin)
    if (!registered) {
        registered = new Map()
        registeredByPlugin.set(plugin, registered)
    }

    const plan = planCommandSync(registered, plugin.settings.captureTargets)
    for (const id of plan.remove) {
        plugin.removeCommand(id)
        registered.delete(id)
    }
    for (const target of plan.add) {
        const id = captureTargetCommandId(target)
        const targetId = target.id
        plugin.addCommand({
            id,
            name: captureTargetCommandName(target),
            callback: () => {
                // Resolved when run: the target may have been edited since
                const current = plugin.settings.captureTargets.find(
                    (candidate) => candidate.id === targetId
                )
                if (current) captureToday(plugin, current)
            }
        })
        registered.set(id, captureTargetCommandName(target))
    }
}
