import type {
    Mapping,
    PropertyDefinition,
    StarterKitNoteType,
    StarterKitProperty,
    StarterKitPropertyLink
} from '../types'
import { createDefaultPropertyDefinition, PROPERTY_TYPES } from '../types'
import type { ObsidianPropertyType } from '../types'

/**
 * Starter Kit supports property types Life Tracker does not (`select`, `url`,
 * `time`, plus the legacy `multitext` / `boolean` aliases it normalizes away).
 * All of them are string-typed on disk, so they map onto `text` rather than
 * being stored verbatim — an unknown type would leave the settings dropdown
 * blank and fall back to a generic editor anyway.
 */
export function normalizeStarterKitType(type: string): ObsidianPropertyType {
    if ((PROPERTY_TYPES as string[]).includes(type)) {
        return type as ObsidianPropertyType
    }
    if (type === 'multitext') return 'list'
    if (type === 'boolean') return 'checkbox'
    return 'text'
}

/**
 * A Starter Kit property together with where it came from.
 */
export interface StarterKitSource {
    property: StarterKitProperty
    /** Owning note type, or null for a Starter Kit global property */
    noteType: StarterKitNoteType | null
}

/**
 * Build the link stored on a definition for a given source.
 */
export function buildLink(source: StarterKitSource): StarterKitPropertyLink {
    return {
        noteTypeId: source.noteType?.id ?? null,
        noteTypeName: source.noteType?.name ?? '',
        propertyName: source.property.name
    }
}

/**
 * Whether a link points at the given source.
 */
export function linkMatches(
    link: StarterKitPropertyLink | null | undefined,
    source: StarterKitSource
): boolean {
    if (!link) return false
    return (
        link.propertyName === source.property.name &&
        link.noteTypeId === (source.noteType?.id ?? null)
    )
}

/**
 * Whether a source can be imported at all.
 *
 * A note type whose mappings are all disabled recognizes **no** notes in Starter
 * Kit. Life Tracker reads an empty mapping list as "applies to every note"
 * (`propertyApplies` returns true when nothing is enabled), so importing such a
 * property would silently invert its scope from *nothing* to *everything* — and
 * a property that applies everywhere gets written into unrelated notes. There is
 * no way to express "matches nothing" in a Life Tracker definition, so these are
 * refused rather than mis-scoped.
 */
export function isImportableSource(source: StarterKitSource): boolean {
    if (source.property.name.trim().length === 0) return false
    if (!source.noteType) return true
    return source.noteType.mappings.some((mapping) => mapping.enabled)
}

/**
 * Mappings a linked definition should carry.
 *
 * Copied from the owning note type so the property applies to that type's notes.
 * This is a *data copy*, not a reimplementation of Starter Kit's recognition:
 * Life Tracker asks "does this property apply to this note?", which is a plain
 * OR over the mappings, not "which single type is this note?" — the question
 * whose tag-priority rules live in Starter Kit and must stay there.
 *
 * Global properties get none, matching their "applies everywhere" semantics.
 */
function mappingsFor(source: StarterKitSource): Mapping[] {
    if (!source.noteType) return []
    return source.noteType.mappings.map((mapping) => ({ ...mapping }))
}

/**
 * Fields Starter Kit owns on a linked definition (issue: SK integration).
 *
 * Everything else — `id`, `order`, `valueMapping`, `polarity`, `valueEmojis`,
 * `starterKitLink` — belongs to Life Tracker and must survive every sync.
 */
export function applyStarterKitStructure(
    definition: PropertyDefinition,
    source: StarterKitSource
): PropertyDefinition {
    const { property } = source

    return {
        ...definition,
        name: property.name,
        displayName: property.displayName,
        type: normalizeStarterKitType(property.type),
        allowedValues: Array.isArray(property.allowedValues)
            ? (property.allowedValues.slice() as PropertyDefinition['allowedValues'])
            : property.allowedValues,
        numberRange: property.numberRange ? { ...property.numberRange } : null,
        defaultValue: Array.isArray(property.defaultValue)
            ? [...property.defaultValue]
            : property.defaultValue,
        required: property.required,
        description: property.description,
        mappings: mappingsFor(source),
        starterKitLink: buildLink(source)
    }
}

/**
 * Whether a definition's structure already matches its Starter Kit source, so a
 * sync would be a no-op. Lets the loader skip writing settings on every start.
 */
export function isStructureInSync(
    definition: PropertyDefinition,
    source: StarterKitSource
): boolean {
    const synced = applyStarterKitStructure(definition, source)
    return JSON.stringify(synced) === JSON.stringify(definition)
}

/**
 * Create a brand-new Life Tracker definition from a Starter Kit property.
 */
export function createLinkedDefinition(
    source: StarterKitSource,
    id: string,
    order: number
): PropertyDefinition {
    return applyStarterKitStructure(createDefaultPropertyDefinition(id, order), source)
}

/**
 * Flatten Starter Kit's note types and global properties into one list of
 * importable sources, note types first, in Starter Kit's own order.
 */
export function collectSources(
    noteTypes: StarterKitNoteType[],
    globalProperties: StarterKitProperty[]
): StarterKitSource[] {
    const sources: StarterKitSource[] = []

    for (const noteType of noteTypes) {
        for (const property of noteType.properties) {
            sources.push({ property, noteType })
        }
    }
    for (const property of globalProperties) {
        sources.push({ property, noteType: null })
    }

    return sources
}

/**
 * What importing a source would do to the current definitions.
 *
 * - `create`: no definition uses that property name yet.
 * - `relink`: a definition is already linked to this exact source; importing
 *   refreshes its structure.
 * - `adopt`: an *unlinked* definition already uses that property name. Importing
 *   links it and takes structure from Starter Kit — the user's polarity, emojis
 *   and value mapping are kept, so this is safe but is surfaced separately
 *   because it changes where the structure comes from.
 * - `conflict`: the name is taken by a definition linked to a *different*
 *   source, or by an earlier entry in this same plan. Never resolved silently.
 * - `unmatched`: the source cannot be represented — a blank property name, or a
 *   note type with no enabled mappings (see `isImportableSource`).
 */
export type ImportAction = 'create' | 'relink' | 'adopt' | 'conflict' | 'unmatched'

export interface ImportPlanEntry {
    source: StarterKitSource
    action: ImportAction
    /** Existing definition this entry would touch, when there is one */
    existingId: string | null
}

/**
 * Decide what would happen for each source, without changing anything.
 *
 * Property *name* is the identity: two definitions for the same frontmatter key
 * would both write to it, so the name is what can collide.
 */
export function planImport(
    sources: StarterKitSource[],
    definitions: PropertyDefinition[]
): ImportPlanEntry[] {
    const byName = new Map<string, PropertyDefinition>()
    for (const definition of definitions) {
        if (definition.name) byName.set(definition.name, definition)
    }

    // Two note types can define the same property name. Without tracking what
    // earlier entries already claim, both would plan as `create` (two
    // definitions writing the same frontmatter key) or both as `adopt` (the
    // second silently rebinding the first's link and mappings).
    const claimedNames = new Set<string>()

    return sources.map((source): ImportPlanEntry => {
        const name = source.property.name

        if (!isImportableSource(source)) {
            return { source, action: 'unmatched', existingId: null }
        }
        if (claimedNames.has(name)) {
            return { source, action: 'conflict', existingId: byName.get(name)?.id ?? null }
        }

        const existing = byName.get(name)
        claimedNames.add(name)

        if (!existing) {
            return { source, action: 'create', existingId: null }
        }
        if (linkMatches(existing.starterKitLink, source)) {
            return { source, action: 'relink', existingId: existing.id }
        }
        if (!existing.starterKitLink) {
            return { source, action: 'adopt', existingId: existing.id }
        }
        return { source, action: 'conflict', existingId: existing.id }
    })
}

/**
 * Apply a plan to a definition list, returning a new list.
 *
 * Conflicts and unmatched sources are skipped: they need a human decision, and
 * silently rebinding a definition to a different note type's property would be
 * the most destructive thing this integration could do.
 */
export function applyImportPlan(
    definitions: PropertyDefinition[],
    plan: ImportPlanEntry[],
    generateId: () => string
): PropertyDefinition[] {
    const result = definitions.map((definition) => definition)
    const indexById = new Map(result.map((definition, index) => [definition.id, index]))
    // Past the highest existing order, not the list length: deletions leave gaps,
    // and reusing an order would sort the import in among existing properties
    let nextOrder = result.reduce((highest, d) => Math.max(highest, d.order), -1) + 1

    for (const entry of plan) {
        if (entry.action === 'conflict' || entry.action === 'unmatched') continue

        if (entry.action === 'create') {
            result.push(createLinkedDefinition(entry.source, generateId(), nextOrder))
            nextOrder++
            continue
        }

        const index = entry.existingId === null ? undefined : indexById.get(entry.existingId)
        const existing = index === undefined ? undefined : result[index]
        if (index === undefined || !existing) continue

        result[index] = applyStarterKitStructure(existing, entry.source)
    }

    return result
}

/**
 * Refresh every linked definition against Starter Kit, in place.
 *
 * Definitions whose source has disappeared are **kept as-is**: Starter Kit may
 * simply be mid-edit, and deleting a user's tracked property because a note type
 * was renamed would be indefensible. They keep working with their last-synced
 * structure; the settings UI flags them.
 *
 * Returns null when nothing changed, so callers can skip persisting.
 */
export function syncLinkedDefinitions(
    definitions: PropertyDefinition[],
    sources: StarterKitSource[]
): PropertyDefinition[] | null {
    let changed = false

    const next = definitions.map((definition) => {
        const link = definition.starterKitLink
        if (!link) return definition

        const source = sources.find((candidate) => linkMatches(link, candidate))
        if (!source) return definition
        // A note type that lost its last enabled mapping would otherwise widen
        // this property's scope from "its notes" to "every note"
        if (!isImportableSource(source)) return definition

        if (isStructureInSync(definition, source)) return definition

        changed = true
        return applyStarterKitStructure(definition, source)
    })

    return changed ? next : null
}

/**
 * Linked definitions whose Starter Kit source no longer exists (renamed note
 * type, deleted property, or Starter Kit uninstalled).
 */
export function findOrphanedLinks(
    definitions: PropertyDefinition[],
    sources: StarterKitSource[]
): PropertyDefinition[] {
    return definitions.filter(
        (definition) =>
            definition.starterKitLink !== null &&
            definition.starterKitLink !== undefined &&
            !sources.some((source) => linkMatches(definition.starterKitLink, source))
    )
}
