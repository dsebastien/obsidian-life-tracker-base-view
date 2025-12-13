import * as pluginManifest from '../../manifest.json'
import type { LogLevel } from '../app/types'

export const LOG_SEPARATOR = '--------------------------------------------------------'
export const LOG_PREFIX = `${pluginManifest.name}:`

/**
 * Log a message
 * @param message
 * @param level
 * @param data
 */
export const log = (message: string, level?: LogLevel, ...data: unknown[]): void => {
    const logMessage = `${LOG_PREFIX} ${message}`
    switch (level) {
        case 'debug':
            console.debug(logMessage, data)
            break
        case 'info':
            console.info(logMessage, data)
            break
        case 'warn':
            console.warn(logMessage, data)
            break
        case 'error':
            console.error(logMessage, data)
            break
        default:
            console.debug(logMessage, data)
    }
}
