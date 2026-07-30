import { describe, expect, test } from 'bun:test'
import {
    applyImportPlan,
    applyStarterKitStructure,
    buildLink,
    collectSources,
    createLinkedDefinition,
    findOrphanedLinks,
    isStructureInSync,
    linkMatches,
    isImportableSource,
    normalizeStarterKitType,
    planImport,
    syncLinkedDefinitions,
    type StarterKitSource
} from './starter-kit.utils'
import {
    createDefaultPropertyDefinition,
    type PropertyDefinition,
    type StarterKitNoteType,
    type StarterKitProperty
} from '../types'

function skProperty(overrides: Partial<StarterKitProperty> = {}): StarterKitProperty {
    return {
        name: 'mood',
        displayName: 'Mood',
        type: 'number',
        allowedValues: [],
        numberRange: { min: 1, max: 5 },
        defaultValue: null,
        required: false,
        description: 'Daily mood',
        ...overrides
    }
}

function noteType(overrides: Partial<StarterKitNoteType> = {}): StarterKitNoteType {
    return {
        id: 'nt-1',
        name: 'Daily Note',
        description: '',
        icon: null,
        mappings: [{ type: 'folder', value: 'Journal', enabled: true }],
        properties: [skProperty()],
        ...overrides
    }
}

function source(overrides: Partial<StarterKitSource> = {}): StarterKitSource {
    return { property: skProperty(), noteType: noteType(), ...overrides }
}

/** A local definition with Life-Tracker-owned fields filled in */
function localDefinition(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
    return {
        ...createDefaultPropertyDefinition('def-1', 3),
        name: 'mood',
        displayName: 'My mood',
        type: 'text',
        polarity: 'higher-is-better',
        valueEmojis: { '1': '😞', '5': '😄' },
        valueMapping: { great: 5 },
        ...overrides
    }
}

describe('applyStarterKitStructure — ownership split', () => {
    test('takes structure from Starter Kit', () => {
        const result = applyStarterKitStructure(localDefinition(), source())

        expect(result.name).toBe('mood')
        expect(result.type).toBe('number')
        expect(result.numberRange).toEqual({ min: 1, max: 5 })
        expect(result.description).toBe('Daily mood')
        expect(result.required).toBe(false)
    })

    test('keeps every Life-Tracker-owned field', () => {
        const definition = localDefinition()
        const result = applyStarterKitStructure(definition, source())

        // The whole point of linking rather than copying: chart semantics survive
        expect(result.id).toBe(definition.id)
        expect(result.order).toBe(definition.order)
        expect(result.polarity).toBe('higher-is-better')
        expect(result.valueEmojis).toEqual({ '1': '😞', '5': '😄' })
        expect(result.valueMapping).toEqual({ great: 5 })
    })

    test('copies the note type mappings so the property is scoped to its notes', () => {
        const result = applyStarterKitStructure(localDefinition(), source())

        expect(result.mappings).toEqual([{ type: 'folder', value: 'Journal', enabled: true }])
    })

    test('does not alias Starter Kit data', () => {
        const skSource = source()
        const result = applyStarterKitStructure(localDefinition(), skSource)

        result.mappings[0]!.value = 'changed'
        expect(skSource.noteType!.mappings[0]!.value).toBe('Journal')

        result.numberRange!.max = 99
        expect(skSource.property.numberRange!.max).toBe(5)
    })

    test('a global property gets no mappings, so it applies everywhere', () => {
        const result = applyStarterKitStructure(localDefinition(), source({ noteType: null }))

        expect(result.mappings).toEqual([])
        expect(result.starterKitLink).toEqual({
            noteTypeId: null,
            noteTypeName: '',
            propertyName: 'mood'
        })
    })

    test('deep-copies array defaults and allowed values', () => {
        const property = skProperty({
            type: 'list',
            allowedValues: ['a', 'b'],
            defaultValue: ['a']
        })
        const skSource = source({ property })
        const result = applyStarterKitStructure(localDefinition(), skSource)

        expect(result.allowedValues).toEqual(['a', 'b'])
        expect(result.defaultValue).toEqual(['a'])
        expect(result.allowedValues).not.toBe(property.allowedValues)
        expect(result.defaultValue).not.toBe(property.defaultValue)
    })
})

describe('isStructureInSync', () => {
    test('true once the structure has been applied', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        expect(isStructureInSync(synced, source())).toBe(true)
    })

    test('false when Starter Kit changed something', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        const changed = source({ property: skProperty({ numberRange: { min: 0, max: 10 } }) })

        expect(isStructureInSync(synced, changed)).toBe(false)
    })

    test('unaffected by Life-Tracker-owned edits', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        const edited: PropertyDefinition = { ...synced, polarity: 'lower-is-better' }

        expect(isStructureInSync(edited, source())).toBe(true)
    })
})

describe('linkMatches', () => {
    test('matches on property name and note type', () => {
        expect(linkMatches(buildLink(source()), source())).toBe(true)
    })

    test('does not match a same-named property of another note type', () => {
        const other = source({ noteType: noteType({ id: 'nt-2', name: 'Weekly Note' }) })
        expect(linkMatches(buildLink(source()), other)).toBe(false)
    })

    test('does not match a global property against a note type property', () => {
        expect(linkMatches(buildLink(source({ noteType: null })), source())).toBe(false)
    })

    test('an unlinked definition matches nothing', () => {
        expect(linkMatches(null, source())).toBe(false)
        expect(linkMatches(undefined, source())).toBe(false)
    })
})

describe('collectSources', () => {
    test('flattens note types first, then global properties', () => {
        const sources = collectSources(
            [noteType({ properties: [skProperty(), skProperty({ name: 'energy' })] })],
            [skProperty({ name: 'weight' })]
        )

        expect(sources.map((s) => s.property.name)).toEqual(['mood', 'energy', 'weight'])
        expect(sources[2]!.noteType).toBeNull()
    })
})

describe('planImport', () => {
    test('create when no definition uses that name', () => {
        const plan = planImport([source()], [])
        expect(plan[0]!.action).toBe('create')
        expect(plan[0]!.existingId).toBeNull()
    })

    test('relink when a definition already points at this exact source', () => {
        const linked = applyStarterKitStructure(localDefinition(), source())
        const plan = planImport([source()], [linked])

        expect(plan[0]!.action).toBe('relink')
        expect(plan[0]!.existingId).toBe(linked.id)
    })

    test('adopt when an unlinked definition already uses that name', () => {
        const plan = planImport([source()], [localDefinition()])

        expect(plan[0]!.action).toBe('adopt')
        expect(plan[0]!.existingId).toBe('def-1')
    })

    test('conflict when the name belongs to a different source', () => {
        const otherType = noteType({ id: 'nt-2', name: 'Weekly Note' })
        const linkedElsewhere = applyStarterKitStructure(
            localDefinition(),
            source({ noteType: otherType })
        )
        const plan = planImport([source()], [linkedElsewhere])

        expect(plan[0]!.action).toBe('conflict')
    })

    test('definitions with no name never collide', () => {
        const blank = createDefaultPropertyDefinition('blank', 0)
        expect(planImport([source()], [blank])[0]!.action).toBe('create')
    })
})

describe('applyImportPlan', () => {
    let counter = 0
    const generateId = (): string => `generated-${++counter}`

    test('creates a linked definition, appended after the existing ones', () => {
        counter = 0
        const existing = [localDefinition({ id: 'other', name: 'weight', order: 3 })]
        const plan = planImport([source()], existing)
        const result = applyImportPlan(existing, plan, generateId)

        expect(result).toHaveLength(2)
        expect(result[1]!.name).toBe('mood')
        // Past the highest existing order, not the list length
        expect(result[1]!.order).toBe(4)
        expect(result[1]!.starterKitLink?.noteTypeId).toBe('nt-1')
    })

    test('adopting keeps the user’s polarity and emojis', () => {
        counter = 0
        const existing = [localDefinition()]
        const plan = planImport([source()], existing)
        const result = applyImportPlan(existing, plan, generateId)

        expect(result).toHaveLength(1)
        expect(result[0]!.type).toBe('number') // structure from Starter Kit
        expect(result[0]!.polarity).toBe('higher-is-better') // kept
        expect(result[0]!.valueEmojis).toEqual({ '1': '😞', '5': '😄' })
        expect(result[0]!.starterKitLink?.propertyName).toBe('mood')
    })

    test('conflicts are skipped, never silently rebound', () => {
        counter = 0
        const otherType = noteType({ id: 'nt-2', name: 'Weekly Note' })
        const linkedElsewhere = applyStarterKitStructure(
            localDefinition(),
            source({ noteType: otherType })
        )
        const plan = planImport([source()], [linkedElsewhere])
        const result = applyImportPlan([linkedElsewhere], plan, generateId)

        expect(result).toEqual([linkedElsewhere])
    })

    test('does not mutate the input list', () => {
        counter = 0
        const existing = [localDefinition()]
        const snapshot = JSON.stringify(existing)

        applyImportPlan(existing, planImport([source()], existing), generateId)

        expect(JSON.stringify(existing)).toBe(snapshot)
    })
})

describe('syncLinkedDefinitions', () => {
    test('returns null when nothing changed, so settings are not rewritten', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        expect(syncLinkedDefinitions([synced], [source()])).toBeNull()
    })

    test('picks up a Starter Kit structure change', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        const changed = source({ property: skProperty({ numberRange: { min: 0, max: 10 } }) })

        const result = syncLinkedDefinitions([synced], [changed])

        expect(result).not.toBeNull()
        expect(result![0]!.numberRange).toEqual({ min: 0, max: 10 })
        expect(result![0]!.polarity).toBe('higher-is-better')
    })

    test('leaves unlinked definitions completely alone', () => {
        const local = localDefinition()
        expect(syncLinkedDefinitions([local], [source()])).toBeNull()
    })

    test('keeps a linked definition whose source vanished', () => {
        // Starter Kit may be mid-edit or uninstalled; deleting the user's
        // tracked property would be indefensible
        const synced = applyStarterKitStructure(localDefinition(), source())

        expect(syncLinkedDefinitions([synced], [])).toBeNull()
    })
})

describe('findOrphanedLinks', () => {
    test('finds links whose source is gone', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        expect(findOrphanedLinks([synced], []).map((d) => d.id)).toEqual([synced.id])
    })

    test('ignores unlinked definitions', () => {
        expect(findOrphanedLinks([localDefinition()], [])).toEqual([])
    })

    test('finds nothing when every link resolves', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        expect(findOrphanedLinks([synced], [source()])).toEqual([])
    })
})

describe('createLinkedDefinition', () => {
    test('produces a complete definition with neutral Life Tracker defaults', () => {
        const created = createLinkedDefinition(source(), 'new-id', 7)

        expect(created.id).toBe('new-id')
        expect(created.order).toBe(7)
        expect(created.name).toBe('mood')
        expect(created.type).toBe('number')
        expect(created.polarity).toBe('neutral')
        expect(created.valueEmojis).toBeNull()
        expect(created.starterKitLink).toEqual({
            noteTypeId: 'nt-1',
            noteTypeName: 'Daily Note',
            propertyName: 'mood'
        })
    })
})

describe('normalizeStarterKitType', () => {
    test('passes through types Life Tracker supports', () => {
        expect(normalizeStarterKitType('number')).toBe('number')
        expect(normalizeStarterKitType('checkbox')).toBe('checkbox')
        expect(normalizeStarterKitType('tags')).toBe('tags')
    })

    test('maps Starter Kit legacy aliases onto their modern equivalents', () => {
        expect(normalizeStarterKitType('multitext')).toBe('list')
        expect(normalizeStarterKitType('boolean')).toBe('checkbox')
    })

    test('folds string-typed Starter Kit extras onto text', () => {
        // select/url/time exist in Starter Kit but not here; storing them
        // verbatim would leave the settings dropdown blank
        expect(normalizeStarterKitType('select')).toBe('text')
        expect(normalizeStarterKitType('url')).toBe('text')
        expect(normalizeStarterKitType('time')).toBe('text')
        expect(normalizeStarterKitType('something-new')).toBe('text')
    })
})

describe('isImportableSource — scope safety', () => {
    test('a note type with at least one enabled mapping is importable', () => {
        expect(isImportableSource(source())).toBe(true)
    })

    test('a note type whose mappings are all disabled is refused', () => {
        // Starter Kit recognizes nothing for it, but Life Tracker reads an empty
        // mapping list as "applies to every note" — importing would invert the
        // scope from nothing to everything
        const inert = noteType({
            mappings: [{ type: 'folder', value: 'Journal', enabled: false }]
        })
        expect(isImportableSource(source({ noteType: inert }))).toBe(false)
    })

    test('a note type with no mappings at all is refused', () => {
        expect(isImportableSource(source({ noteType: noteType({ mappings: [] }) }))).toBe(false)
    })

    test('global properties are importable — they really do apply everywhere', () => {
        expect(isImportableSource(source({ noteType: null }))).toBe(true)
    })

    test('a blank property name is refused', () => {
        expect(isImportableSource(source({ property: skProperty({ name: '  ' }) }))).toBe(false)
    })
})

describe('planImport — duplicate names within Starter Kit', () => {
    test('two note types defining the same name: the second is a conflict', () => {
        const a = noteType({ id: 'nt-a', name: 'A' })
        const b = noteType({ id: 'nt-b', name: 'B' })
        const plan = planImport([source({ noteType: a }), source({ noteType: b })], [])

        expect(plan.map((entry) => entry.action)).toEqual(['create', 'conflict'])
    })

    test('importing both never produces two definitions for one frontmatter key', () => {
        const a = noteType({ id: 'nt-a', name: 'A' })
        const b = noteType({ id: 'nt-b', name: 'B' })
        const sources = [source({ noteType: a }), source({ noteType: b })]
        const plan = planImport(sources, [])
        const result = applyImportPlan([], plan, () => crypto.randomUUID())

        expect(result).toHaveLength(1)
        expect(result[0]!.starterKitLink?.noteTypeId).toBe('nt-a')
    })

    test('the second never silently rebinds an adopted definition', () => {
        const a = noteType({ id: 'nt-a', name: 'A' })
        const b = noteType({ id: 'nt-b', name: 'B' })
        const existing = [localDefinition()]
        const plan = planImport([source({ noteType: a }), source({ noteType: b })], existing)
        const result = applyImportPlan(existing, plan, () => crypto.randomUUID())

        expect(result).toHaveLength(1)
        expect(result[0]!.starterKitLink?.noteTypeId).toBe('nt-a')
    })

    test('unimportable sources are planned as unmatched and never applied', () => {
        const inert = noteType({
            mappings: [{ type: 'folder', value: 'Journal', enabled: false }]
        })
        const plan = planImport([source({ noteType: inert })], [])

        expect(plan[0]!.action).toBe('unmatched')
        expect(applyImportPlan([], plan, () => crypto.randomUUID())).toEqual([])
    })
})

describe('applyImportPlan — ordering', () => {
    test('new definitions sort after existing ones even when orders have gaps', () => {
        // Deletions leave gaps: using the list length would reuse an order and
        // sort the import in among existing properties
        const existing = [
            localDefinition({ id: 'a', name: 'weight', order: 4 }),
            localDefinition({ id: 'b', name: 'steps', order: 9 })
        ]
        const plan = planImport([source()], existing)
        const result = applyImportPlan(existing, plan, () => 'new')

        expect(result[2]!.order).toBe(10)
    })
})

describe('syncLinkedDefinitions — scope safety', () => {
    test('a note type that lost its last enabled mapping does not widen the scope', () => {
        const synced = applyStarterKitStructure(localDefinition(), source())
        const inert = noteType({
            mappings: [{ type: 'folder', value: 'Journal', enabled: false }]
        })

        // Would otherwise rewrite mappings to [] — which Life Tracker reads as
        // "every note"
        expect(syncLinkedDefinitions([synced], [source({ noteType: inert })])).toBeNull()
    })
})

describe('stable property ids — surviving a rename', () => {
    /** Starter Kit now mints ids; a rename keeps them */
    function identified(overrides: Partial<StarterKitProperty> = {}): StarterKitProperty {
        return skProperty({ id: 'prop-123-abcdefg', ...overrides })
    }

    test('the link records the id when Starter Kit supplies one', () => {
        const link = buildLink(source({ property: identified() }))
        expect(link.propertyId).toBe('prop-123-abcdefg')
        expect(link.propertyName).toBe('mood')
    })

    test('the link omits the id when Starter Kit has none, keeping the name fallback', () => {
        const link = buildLink(source())
        expect(link.propertyId).toBeUndefined()
        expect(link.propertyName).toBe('mood')
    })

    test('a renamed property still matches its link', () => {
        const link = buildLink(source({ property: identified() }))
        const renamed = source({ property: identified({ name: 'feeling' }) })

        expect(linkMatches(link, renamed)).toBe(true)
    })

    test('a different property that took over the old name does not match', () => {
        // The classic rename trap: `mood` becomes `feeling`, then a *new*
        // property called `mood` appears. Name matching would bind to the wrong one.
        const link = buildLink(source({ property: identified() }))
        const impostor = source({ property: identified({ id: 'prop-999-zzzzzzz' }) })

        expect(linkMatches(link, impostor)).toBe(false)
    })

    test('the note type must still agree, whatever the id says', () => {
        const link = buildLink(source({ property: identified() }))
        const elsewhere = source({
            property: identified(),
            noteType: noteType({ id: 'nt-2', name: 'Weekly Note' })
        })

        expect(linkMatches(link, elsewhere)).toBe(false)
    })

    test('falls back to the name when only one side has an id', () => {
        // Mid-upgrade: the link predates ids, Starter Kit has backfilled them
        const legacyLink = buildLink(source())
        expect(linkMatches(legacyLink, source({ property: identified() }))).toBe(true)
    })

    test('sync follows a rename through to the definition name', () => {
        const synced = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        expect(synced.name).toBe('mood')

        const result = syncLinkedDefinitions(
            [synced],
            [source({ property: identified({ name: 'feeling', displayName: 'Feeling' }) })]
        )

        expect(result).not.toBeNull()
        expect(result![0]!.name).toBe('feeling')
        // Life-Tracker-owned settings ride through the rename untouched,
        // including the label the user chose
        expect(result![0]!.displayName).toBe('My mood')
        expect(result![0]!.polarity).toBe('higher-is-better')
        expect(result![0]!.valueEmojis).toEqual({ '1': '😞', '5': '😄' })
    })

    test('a renamed property is not orphaned', () => {
        const synced = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const renamed = [source({ property: identified({ name: 'feeling' }) })]

        expect(findOrphanedLinks([synced], renamed)).toEqual([])
    })

    test('re-importing after a rename refreshes, never duplicates', () => {
        // planImport must resolve by link, not by name: the definition still
        // carries the OLD name until a sync runs
        const synced = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const renamed = source({ property: identified({ name: 'feeling' }) })

        const plan = planImport([renamed], [synced])
        expect(plan[0]!.action).toBe('relink')

        const result = applyImportPlan([synced], plan, () => 'should-not-be-used')
        expect(result).toHaveLength(1)
        expect(result[0]!.name).toBe('feeling')
        expect(result[0]!.id).toBe(synced.id)
    })
})

describe('rename collisions — never two definitions for one key', () => {
    function identified(overrides: Partial<StarterKitProperty> = {}): StarterKitProperty {
        return skProperty({ id: 'prop-123-abcdefg', ...overrides })
    }

    test('a rename onto a name another definition holds is a conflict, not a relink', () => {
        const linked = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const other = localDefinition({ id: 'other', name: 'feeling' })
        const renamed = source({ property: identified({ name: 'feeling' }) })

        const plan = planImport([renamed], [linked, other])

        expect(plan[0]!.action).toBe('conflict')
    })

    test('applying that plan changes nothing', () => {
        const linked = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const other = localDefinition({ id: 'other', name: 'feeling' })
        const renamed = source({ property: identified({ name: 'feeling' }) })

        const before = [linked, other]
        const plan = planImport([renamed], before)
        const result = applyImportPlan(before, plan, () => 'unused')

        expect(result.map((d) => d.name).sort()).toEqual(['feeling', 'mood'])
    })

    test('sync refuses the same rename rather than duplicating the name', () => {
        const linked = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const other = localDefinition({ id: 'other', name: 'feeling' })
        const renamed = source({ property: identified({ name: 'feeling' }) })

        expect(syncLinkedDefinitions([linked, other], [renamed])).toBeNull()
    })

    test('sync still performs a rename when the new name is free', () => {
        const linked = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const other = localDefinition({ id: 'other', name: 'weight' })
        const renamed = source({ property: identified({ name: 'feeling' }) })

        const result = syncLinkedDefinitions([linked, other], [renamed])

        expect(result).not.toBeNull()
        expect(result![0]!.name).toBe('feeling')
    })

    test('a new Starter Kit property may take the name a linked one is vacating', () => {
        // `mood` → `feeling`, and a brand-new `mood` appears. The old name is
        // no longer held by anyone once the rename lands, so this must import.
        const linked = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified() })
        )
        const renamed = source({ property: identified({ name: 'feeling' }) })
        const fresh = source({ property: identified({ id: 'prop-999-zzzzzzz', name: 'mood' }) })

        const plan = planImport([renamed, fresh], [linked])

        expect(plan.map((entry) => entry.action)).toEqual(['relink', 'create'])
    })

    test('a conflicting entry does not claim the name and block a later valid one', () => {
        // The first source collides with a definition linked elsewhere; the
        // second legitimately owns that definition and must still resolve
        const otherType = noteType({ id: 'nt-2', name: 'Weekly Note' })
        const linkedToOther = applyStarterKitStructure(
            localDefinition(),
            source({ property: identified(), noteType: otherType })
        )
        const fromFirstType = source({
            property: identified({ id: 'prop-aaa-bbbbbbb' }),
            noteType: noteType({ id: 'nt-1' })
        })
        const genuine = source({ property: identified(), noteType: otherType })

        const plan = planImport([fromFirstType, genuine], [linkedToOther])

        expect(plan[0]!.action).toBe('conflict')
        expect(plan[1]!.action).toBe('relink')
    })
})

describe('display names — the label belongs to Life Tracker', () => {
    test('a customized label survives a sync', () => {
        // Found in a real vault: Starter Kit defaults displayName to the raw
        // property name, so letting it win renamed 90 labelled properties back
        // to "health_energy_level" and friends
        const definition = localDefinition({ displayName: 'Energy Level', name: 'health_energy' })
        const skSource = source({
            property: skProperty({ name: 'health_energy', displayName: 'health_energy' })
        })

        expect(applyStarterKitStructure(definition, skSource).displayName).toBe('Energy Level')
    })

    test("Starter Kit's label is taken when Life Tracker has none", () => {
        const definition = localDefinition({ displayName: '' })
        expect(applyStarterKitStructure(definition, source()).displayName).toBe('Mood')
    })

    test("Starter Kit's label is taken when Life Tracker's is just the raw name", () => {
        const definition = localDefinition({ name: 'mood', displayName: 'mood' })
        expect(applyStarterKitStructure(definition, source()).displayName).toBe('Mood')
    })

    test("a freshly created definition gets Starter Kit's label", () => {
        expect(createLinkedDefinition(source(), 'id', 0).displayName).toBe('Mood')
    })

    test('a whitespace-only label counts as unset', () => {
        const definition = localDefinition({ displayName: '   ' })
        expect(applyStarterKitStructure(definition, source()).displayName).toBe('Mood')
    })
})

describe('version skew — Starter Kit gaining ids later', () => {
    test('a legacy name-based link upgrades to an id on the next sync', () => {
        // User updates Life Tracker first (Starter Kit still has no ids), then
        // updates Starter Kit. The link must harden itself, not break.
        const legacy = applyStarterKitStructure(localDefinition(), source())
        expect(legacy.starterKitLink?.propertyId).toBeUndefined()

        const withIds = source({ property: skProperty({ id: 'prop-1-aaaaaaa' }) })
        const result = syncLinkedDefinitions([legacy], [withIds])

        expect(result).not.toBeNull()
        expect(result![0]!.starterKitLink?.propertyId).toBe('prop-1-aaaaaaa')
        expect(result![0]!.polarity).toBe('higher-is-better')
    })

    test('an older Starter Kit without ids keeps working against a hardened link', () => {
        // Downgrade or a partially-migrated vault: the link has an id, the
        // source does not. Name matching must still resolve it.
        const hardened = applyStarterKitStructure(
            localDefinition(),
            source({ property: skProperty({ id: 'prop-1-aaaaaaa' }) })
        )

        expect(linkMatches(hardened.starterKitLink, source())).toBe(true)
    })
})
