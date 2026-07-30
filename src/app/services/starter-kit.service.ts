import type { App } from 'obsidian'
import {
    STARTER_KIT_PLUGIN_ID,
    type StarterKitApi,
    type StarterKitApiResult,
    type StarterKitNoteType,
    type StarterKitProperty
} from '../types'
import { log } from '../../utils'
import { collectSources, type StarterKitSource } from './starter-kit.utils'

/**
 * Shape of Obsidian's (undeclared) plugin registry, duck-typed.
 *
 * `app.plugins` is not part of the public `obsidian` typings, so it is reached
 * through a single narrow cast here rather than sprinkled `as` casts elsewhere.
 */
interface PluginRegistryHost {
    plugins?: {
        plugins?: Record<string, unknown>
        enabledPlugins?: Set<string>
    }
}

/** The bits of the Starter Kit plugin instance we look at */
interface StarterKitPluginInstance {
    api?: unknown
    manifest?: { version?: unknown }
}

/**
 * Keep only entries that actually have the shape we consume.
 *
 * The envelope being `success: true` says nothing about `data`: a future Starter
 * Kit could return an object where a list is expected, or a note type without
 * `properties`. Anything malformed is dropped here rather than blowing up a
 * settings render or the startup sync.
 */
function isValidProperty(value: unknown): value is StarterKitProperty {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<StarterKitProperty>
    return typeof candidate.name === 'string' && typeof candidate.type === 'string'
}

function isValidNoteType(value: unknown): value is StarterKitNoteType {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<StarterKitNoteType>
    return (
        typeof candidate.id === 'string' &&
        typeof candidate.name === 'string' &&
        Array.isArray(candidate.properties) &&
        Array.isArray(candidate.mappings)
    )
}

/**
 * Reads note types and properties from the Obsidian Starter Kit plugin, when it
 * is installed and enabled (see `documentation/plans/starter-kit-integration.md`).
 *
 * Everything here is defensive. Starter Kit is a separate plugin with its own
 * release cycle and no versioned API contract, so each method is feature-detected
 * and every failure degrades to "not available" rather than throwing into a
 * render or a settings tab.
 */
export class StarterKitService {
    constructor(private readonly app: App) {}

    /**
     * The Starter Kit plugin instance, or null when it is absent or disabled.
     */
    private getPluginInstance(): StarterKitPluginInstance | null {
        const host = this.app as unknown as PluginRegistryHost
        const instance = host.plugins?.plugins?.[STARTER_KIT_PLUGIN_ID]
        if (!instance || typeof instance !== 'object') return null
        return instance as StarterKitPluginInstance
    }

    /**
     * The Starter Kit API, or null when it is missing any method we rely on.
     *
     * Feature-detected rather than assumed: an older or newer Starter Kit that
     * lacks one of these must degrade, not crash.
     */
    private getApi(): StarterKitApi | null {
        const instance = this.getPluginInstance()
        const api = instance?.api
        if (!api || typeof api !== 'object') return null

        const candidate = api as Partial<StarterKitApi>
        if (
            typeof candidate.listNoteTypes !== 'function' ||
            typeof candidate.listGlobalProperties !== 'function'
        ) {
            log('Starter Kit found but its API is missing expected methods', 'debug')
            return null
        }

        return candidate as StarterKitApi
    }

    /** Whether Starter Kit is installed, enabled, and exposing a usable API */
    isAvailable(): boolean {
        return this.getApi() !== null
    }

    /** Starter Kit's version string, for display. Null when unknown. */
    getVersion(): string | null {
        const version = this.getPluginInstance()?.manifest?.version
        return typeof version === 'string' ? version : null
    }

    /**
     * Unwrap Starter Kit's `ApiResult` envelope, tolerating a call that throws.
     */
    private read<T>(label: string, call: () => StarterKitApiResult<T>): T | null {
        try {
            const result = call()
            if (!result || typeof result !== 'object') return null
            if (!result.success || result.data === undefined) {
                log(`Starter Kit ${label} failed`, 'debug', result.error)
                return null
            }
            return result.data
        } catch (error: unknown) {
            log(`Starter Kit ${label} threw`, 'warn', error)
            return null
        }
    }

    /** Note types defined in Starter Kit, or an empty list when unavailable */
    listNoteTypes(): StarterKitNoteType[] {
        const api = this.getApi()
        if (!api) return []

        const data = this.read('listNoteTypes', () => api.listNoteTypes())
        if (!Array.isArray(data)) return []

        return data.filter(isValidNoteType).map((noteType) => ({
            ...noteType,
            properties: noteType.properties.filter(isValidProperty),
            mappings: noteType.mappings.filter(
                (mapping): mapping is StarterKitNoteType['mappings'][number] =>
                    !!mapping && typeof mapping === 'object'
            )
        }))
    }

    /** Starter Kit's global properties, or an empty list when unavailable */
    listGlobalProperties(): StarterKitProperty[] {
        const api = this.getApi()
        if (!api) return []

        const data = this.read('listGlobalProperties', () => api.listGlobalProperties())
        if (!Array.isArray(data)) return []

        return data.filter(isValidProperty)
    }

    /**
     * Every importable property, note types first then global properties.
     * Empty when Starter Kit is unavailable, which callers can treat as
     * "nothing to sync" without a special case.
     */
    collectSources(): StarterKitSource[] {
        if (!this.isAvailable()) return []
        return collectSources(this.listNoteTypes(), this.listGlobalProperties())
    }
}
