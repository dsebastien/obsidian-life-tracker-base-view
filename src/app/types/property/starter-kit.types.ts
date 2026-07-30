import type {
    NumberRange,
    ObsidianPropertyType,
    PropertyAllowedValues,
    PropertyDefaultValue
} from './property-definition.types'
import type { Mapping } from './property-definition.types'

/**
 * Plugin id of the Obsidian Starter Kit plugin.
 *
 * Stable: that plugin is deliberately not distributed through the community
 * catalog, so the catalog's "id must not contain 'obsidian'" rule never forces
 * it to change.
 */
export const STARTER_KIT_PLUGIN_ID = 'obsidian-starter-kit'

/**
 * A Starter Kit property definition, as Life Tracker consumes it.
 *
 * The two plugins share no build, so this is Life Tracker's own copy of the
 * shape rather than an import. It is intentionally a *subset* of what Starter
 * Kit returns: only the fields Life Tracker actually reads are declared, so a
 * future Starter Kit field cannot silently change behavior here.
 */
export interface StarterKitProperty {
    /**
     * Stable id, minted by Starter Kit and never changed — including across a
     * rename. Optional because a vault whose Starter Kit predates the field has
     * not been through its backfill yet; links fall back to the name until then.
     */
    id?: string
    name: string
    displayName: string
    type: ObsidianPropertyType
    allowedValues: PropertyAllowedValues
    numberRange: NumberRange | null
    defaultValue: PropertyDefaultValue
    required: boolean
    description: string
}

/**
 * A Starter Kit note type, as Life Tracker consumes it.
 */
export interface StarterKitNoteType {
    id: string
    name: string
    description: string
    icon: string | null
    mappings: Mapping[]
    properties: StarterKitProperty[]
}

/**
 * Link from a Life Tracker property definition to its Starter Kit source.
 *
 * Stored on the definition so structure can be re-read on every load while the
 * fields Life Tracker owns (polarity, emojis, value mapping, order) survive
 * untouched. The note type name is cached so the UI can still say where a
 * definition came from when Starter Kit is not installed.
 */
export interface StarterKitPropertyLink {
    /** Source note type id, or null for a Starter Kit *global* property */
    noteTypeId: string | null
    /** Cached note type name for display; empty for global properties */
    noteTypeName: string
    /**
     * Starter Kit's stable property id. The preferred join key: it survives a
     * rename, which `propertyName` cannot. Absent for links made before Starter
     * Kit had ids, or against a Starter Kit that predates them.
     */
    propertyId?: string
    /**
     * Property name in Starter Kit. Kept as the fallback join key, and as the
     * only readable identification when Starter Kit is not installed.
     */
    propertyName: string
}

/**
 * What Life Tracker needs from the Starter Kit plugin API.
 *
 * Deliberately narrow: only the read methods used here. The service
 * feature-detects each one, so a Starter Kit version missing any of them
 * degrades instead of throwing.
 */
export interface StarterKitApi {
    listNoteTypes(): StarterKitApiResult<StarterKitNoteType[]>
    listGlobalProperties(): StarterKitApiResult<StarterKitProperty[]>
}

/**
 * Starter Kit's uniform API envelope.
 */
export interface StarterKitApiResult<T> {
    success: boolean
    data?: T
    error?: string
}
