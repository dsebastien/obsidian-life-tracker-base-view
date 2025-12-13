import type { LifeTrackerPlugin } from '../plugin'
import { registerCaptureCommand } from './capture-command'

/**
 * Register all plugin commands
 */
export function registerCommands(plugin: LifeTrackerPlugin): void {
    registerCaptureCommand(plugin)
}
