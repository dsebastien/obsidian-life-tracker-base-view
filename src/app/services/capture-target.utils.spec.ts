import { describe, expect, test } from 'bun:test'
import {
    DAILY_NOTE_TARGET_ID,
    createCaptureTarget,
    sanitizeCaptureTargets,
    type CaptureTarget,
    type PropertyDefinition,
    type StarterKitNoteType
} from '../types'
import { createDefaultPropertyDefinition } from '../types/property/property-definition.types'
import {
    buildCreationFrontmatter,
    completeFilters,
    definitionsForDestination,
    describeLayoutError,
    describeTargetIssues,
    describeTargetLayout,
    groupByDestination,
    isOfTargetType,
    isTargetLayout,
    matchesFilters,
    needsDiscoverabilityWarning,
    pickTargetNote,
    parseDateValue,
    readFrontmatterTags,
    readTargetNoteDate,
    resolveDefinitionTarget,
    resolveFreeTargetPath,
    type TargetLayout,
    type TargetNoteCandidate
} from './capture-target.utils'

const STRENGTH_TYPE_ID = 'nt-1793122063547-rrrhxc2'

/** The real Strength Sessions type from the reference vault */
const STRENGTH_TYPE: StarterKitNoteType = {
    id: STRENGTH_TYPE_ID,
    name: 'Strength Sessions',
    description: 'One strength workout',
    icon: null,
    mappings: [{ type: 'tag', value: 'type/session/sport/strength', enabled: true }],
    properties: [],
    associatedFolder: '40 Journal/46 Sessions/Sport/Strength/{{year}}',
    templatePath: '50 Resources/54 Templates/Templater/TPL Strength Session.md',
    noteNamePrefix: null,
    noteNameSuffix: ' (Strength Session)',
    tags: ['zone/journal', 'type/session/sport/strength']
}

const NOV_3 = new Date(2026, 10, 3)

function throughTheDay(overrides: Partial<CaptureTarget> = {}): CaptureTarget {
    return {
        ...createCaptureTarget('t-through', 'Through the day'),
        noteTypeId: STRENGTH_TYPE_ID,
        filters: [{ property: 'workout_kind', value: 'Through the day' }],
        ...overrides
    }
}

function definition(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
    return { ...createDefaultPropertyDefinition('d-1', 0), name: 'push_ups', ...overrides }
}

function linkedTo(noteTypeId: string): Partial<PropertyDefinition> {
    return {
        starterKitLink: { noteTypeId, noteTypeName: 'Type', propertyName: 'push_ups' }
    }
}

function candidate(overrides: Partial<TargetNoteCandidate> = {}): TargetNoteCandidate {
    return {
        path: '40 Journal/46 Sessions/Sport/Strength/2026/2026-11-03 (Strength Session).md',
        basename: '2026-11-03 (Strength Session)',
        folder: '40 Journal/46 Sessions/Sport/Strength/2026',
        tags: ['zone/journal', 'type/session/sport/strength'],
        frontmatter: { date: '2026-11-03', workout_kind: 'Through the day' },
        mtime: 1,
        ...overrides
    }
}

describe('resolveDefinitionTarget', () => {
    const target = throughTheDay()

    test('a definition with no target and no link goes to the daily note', () => {
        expect(resolveDefinitionTarget(definition(), [target])).toBeNull()
    })

    test('no targets configured: every definition goes to the daily note', () => {
        expect(resolveDefinitionTarget(definition(linkedTo(STRENGTH_TYPE_ID)), [])).toBeNull()
    })

    test('an explicit target wins', () => {
        const other = { ...throughTheDay(), id: 't-other', noteTypeId: '' }
        expect(
            resolveDefinitionTarget(
                definition({ ...linkedTo(STRENGTH_TYPE_ID), captureTargetId: 't-other' }),
                [target, other]
            )
        ).toBe(other)
    })

    test('daily-note forces the daily note even when a target matches the link', () => {
        expect(
            resolveDefinitionTarget(
                definition({
                    ...linkedTo(STRENGTH_TYPE_ID),
                    captureTargetId: DAILY_NOTE_TARGET_ID
                }),
                [target]
            )
        ).toBeNull()
    })

    test('a linked definition derives the one target of its note type', () => {
        expect(resolveDefinitionTarget(definition(linkedTo(STRENGTH_TYPE_ID)), [target])).toBe(
            target
        )
    })

    test('two targets of the same type are ambiguous: daily note', () => {
        const second = { ...throughTheDay(), id: 't-gym' }
        expect(
            resolveDefinitionTarget(definition(linkedTo(STRENGTH_TYPE_ID)), [target, second])
        ).toBeNull()
    })

    test('a deleted explicit target falls back to the automatic rule', () => {
        expect(
            resolveDefinitionTarget(
                definition({ ...linkedTo(STRENGTH_TYPE_ID), captureTargetId: 'gone' }),
                [target]
            )
        ).toBe(target)
        expect(
            resolveDefinitionTarget(definition({ captureTargetId: 'gone' }), [target])
        ).toBeNull()
    })

    test('a global Starter Kit property (null note type) derives nothing', () => {
        expect(
            resolveDefinitionTarget(
                definition({
                    starterKitLink: { noteTypeId: null, noteTypeName: '', propertyName: 'x' }
                }),
                [{ ...target, noteTypeId: '' }]
            )
        ).toBeNull()
    })
})

describe('groupByDestination', () => {
    test('daily first, then targets in settings order, empty groups dropped', () => {
        const a = throughTheDay({ id: 'a', noteTypeId: '' })
        const b = throughTheDay({ id: 'b', noteTypeId: '' })
        const unused = throughTheDay({ id: 'c', noteTypeId: '' })
        const water = definition({ id: 'w', name: 'water' })
        const pushUps = definition({ id: 'p', captureTargetId: 'b' })
        const squats = definition({ id: 's', captureTargetId: 'a' })

        const groups = groupByDestination([pushUps, water, squats], [a, b, unused])

        expect(groups.map((group) => group.target?.id ?? 'daily')).toEqual(['daily', 'a', 'b'])
        expect(groups[0]?.definitions).toEqual([water])
        expect(definitionsForDestination([pushUps, water, squats], [a, b], null)).toEqual([water])
    })

    test('with no targets there is a single daily group holding everything', () => {
        const all = [definition({ id: '1' }), definition({ id: '2' })]
        expect(groupByDestination(all, [])).toEqual([{ target: null, definitions: all }])
    })
})

describe('matchesFilters', () => {
    const filters = [{ property: 'workout_kind', value: 'Through the day' }]

    test('trimmed, case-insensitive match', () => {
        expect(matchesFilters({ workout_kind: '  through THE day ' }, filters)).toBe(true)
        expect(matchesFilters({ workout_kind: 'Full body' }, filters)).toBe(false)
        expect(matchesFilters({}, filters)).toBe(false)
    })

    test('a list matches when one item matches', () => {
        expect(matchesFilters({ workout_kind: ['Core', 'Through the day'] }, filters)).toBe(true)
    })

    test('numbers and booleans compare as text; an empty property name is ignored', () => {
        expect(matchesFilters({ n: 3 }, [{ property: 'n', value: '3' }])).toBe(true)
        expect(matchesFilters({ b: true }, [{ property: 'b', value: 'TRUE' }])).toBe(true)
        expect(matchesFilters({}, [{ property: ' ', value: 'x' }])).toBe(true)
    })

    test('an incomplete row is ignored, never matching notes without the property (review #10)', () => {
        expect(matchesFilters({}, [{ property: 'kind', value: '' }])).toBe(true)
        expect(
            matchesFilters({ workout_kind: 'Full body' }, [
                { property: 'workout_kind', value: 'Full body' },
                { property: 'kind', value: ' ' }
            ])
        ).toBe(true)
        expect(
            completeFilters([
                { property: ' a ', value: ' b ' },
                { property: 'c', value: '' }
            ])
        ).toEqual([{ property: 'a', value: 'b' }])
    })
})

describe('readTargetNoteDate', () => {
    test('reads the date property, also from a datetime', () => {
        expect(readTargetNoteDate(candidate(), 'date')).toEqual(NOV_3)
        expect(
            readTargetNoteDate(candidate({ frontmatter: { when: '2026-11-03T07:30' } }), 'when')
        ).toEqual(NOV_3)
    })

    test('the property wins over the file name', () => {
        expect(
            readTargetNoteDate(candidate({ frontmatter: { date: '2026-11-04' } }), 'date')
        ).toEqual(new Date(2026, 10, 4))
    })

    test('falls back to a leading ISO date in the file name', () => {
        expect(
            readTargetNoteDate(
                candidate({ frontmatter: {}, basename: '2026-11-03 2 (Strength Session)' }),
                'date'
            )
        ).toEqual(NOV_3)
    })

    test('a property value that names no day falls back to the file name (review #8)', () => {
        expect(readTargetNoteDate(candidate({ frontmatter: { date: 'soon' } }), 'date')).toEqual(
            NOV_3
        )
        expect(
            readTargetNoteDate(candidate({ frontmatter: { date: '2026-02-31' } }), 'date')
        ).toEqual(NOV_3)
        expect(
            readTargetNoteDate(
                candidate({ frontmatter: { date: '[[2026-11-03]]' }, basename: 'x', path: 'x.md' }),
                'date'
            )
        ).toEqual(NOV_3)
    })

    test('a date parsed by YAML as a Date keeps its calendar day', () => {
        expect(
            readTargetNoteDate(
                candidate({
                    frontmatter: { date: new Date('2026-11-03T00:00:00Z') },
                    basename: 'x'
                }),
                'date'
            )
        ).toEqual(NOV_3)
    })

    test('no date anywhere', () => {
        expect(
            readTargetNoteDate(candidate({ frontmatter: {}, basename: 'Gym', path: 'Gym.md' }), '')
        ).toBeNull()
    })
})

describe('isOfTargetType', () => {
    test('a Starter Kit target uses the note type mappings', () => {
        expect(isOfTargetType(candidate(), throughTheDay(), STRENGTH_TYPE)).toBe(true)
        expect(isOfTargetType(candidate({ tags: ['other'] }), throughTheDay(), STRENGTH_TYPE)).toBe(
            false
        )
    })

    test('a Starter Kit target whose type is unavailable matches nothing', () => {
        expect(isOfTargetType(candidate(), throughTheDay(), null)).toBe(false)
    })

    test('a type with only disabled mappings matches nothing', () => {
        const disabled = {
            ...STRENGTH_TYPE,
            mappings: [
                { type: 'tag' as const, value: 'type/session/sport/strength', enabled: false }
            ]
        }
        expect(isOfTargetType(candidate(), throughTheDay(), disabled)).toBe(false)
    })

    test('a standalone target needs every tag; none means the folder decides', () => {
        const standalone = throughTheDay({ noteTypeId: '', tags: ['#workout', 'daily-moves'] })
        expect(
            isOfTargetType(candidate({ tags: ['workout', 'Daily-Moves'] }), standalone, null)
        ).toBe(true)
        expect(isOfTargetType(candidate({ tags: ['workout'] }), standalone, null)).toBe(false)
        expect(isOfTargetType(candidate({ tags: [] }), { ...standalone, tags: [] }, null)).toBe(
            true
        )
    })
})

describe('pickTargetNote', () => {
    const target = throughTheDay()

    test('the Garmin gym session of the same day is not the through-the-day note', () => {
        const gym = candidate({
            path: 'S/2026-11-03 (Strength Session).md',
            frontmatter: { date: '2026-11-03', workout_kind: 'Full body' },
            mtime: 9
        })
        const through = candidate({
            path: 'S/2026-11-03 2 (Strength Session).md',
            basename: '2026-11-03 2 (Strength Session)',
            mtime: 2
        })
        expect(pickTargetNote([gym, through], target, STRENGTH_TYPE, NOV_3)).toBe(through)
    })

    test('another day does not match; several matches pick the newest', () => {
        const other = candidate({
            frontmatter: { date: '2026-11-02', workout_kind: 'Through the day' }
        })
        const older = candidate({ path: 'a.md', mtime: 1 })
        const newer = candidate({ path: 'b.md', mtime: 5 })
        expect(pickTargetNote([other], target, STRENGTH_TYPE, NOV_3)).toBeNull()
        expect(pickTargetNote([older, newer], target, STRENGTH_TYPE, NOV_3)).toBe(newer)
    })
})

describe('describeTargetLayout', () => {
    test('a Starter Kit target takes the type folder, affixes, template and tags', () => {
        expect(describeTargetLayout(throughTheDay(), STRENGTH_TYPE)).toEqual({
            folder: '40 Journal/46 Sessions/Sport/Strength/{{year}}',
            head: '{{date}}',
            tail: ' (Strength Session)',
            templatePath: '50 Resources/54 Templates/Templater/TPL Strength Session.md',
            tags: ['zone/journal', 'type/session/sport/strength'],
            ownText: null
        })
    })

    test('the target template overrides the type template', () => {
        const layout = describeTargetLayout(
            throughTheDay({ templatePath: ' Templates/Quick.md ' }),
            STRENGTH_TYPE
        )
        expect(isTargetLayout(layout) && layout.templatePath).toBe('Templates/Quick.md')
    })

    test('errors: missing type, missing folder, missing file name', () => {
        expect(describeTargetLayout(throughTheDay(), null)).toBe('missing-note-type')
        expect(
            describeTargetLayout(throughTheDay(), { ...STRENGTH_TYPE, associatedFolder: null })
        ).toBe('missing-folder')
        expect(describeTargetLayout(throughTheDay({ noteTypeId: '' }), null)).toBe('missing-folder')
        expect(
            describeTargetLayout(
                throughTheDay({ noteTypeId: '', folder: 'Workouts', fileNamePattern: ' ' }),
                null
            )
        ).toBe('missing-file-name')
    })

    test('the counter goes right after {{date}}, not after the last token (review #11)', () => {
        const layout = describeTargetLayout(
            throughTheDay({
                noteTypeId: '',
                folder: 'W',
                fileNamePattern: '{{date}} Workout {{year}}'
            }),
            null
        ) as TargetLayout
        expect(
            resolveFreeTargetPath(layout, NOV_3, (path) => path === 'W/2026-11-03 Workout 2026.md')
                ?.path
        ).toBe('W/2026-11-03 2 Workout 2026.md')
    })

    test('a standalone pattern without {{date}} is refused (review #11)', () => {
        const target = throughTheDay({
            noteTypeId: '',
            folder: 'W',
            fileNamePattern: '{{year}} Workout'
        })
        expect(describeTargetLayout(target, null)).toBe('missing-date-token')
        expect(describeLayoutError('missing-date-token', target)).toContain('{{date}}')
    })

    test('a standalone pattern is split after its date token', () => {
        const layout = describeTargetLayout(
            throughTheDay({
                noteTypeId: '',
                folder: 'Workouts/{{year}}',
                fileNamePattern: 'Moves {{date}} (quick)',
                tags: ['#workout', ' ']
            }),
            null
        )
        expect(layout).toEqual({
            folder: 'Workouts/{{year}}',
            head: 'Moves {{date}}',
            tail: ' (quick)',
            templatePath: null,
            tags: ['workout'],
            ownText: null
        })
    })
})

describe('file name pattern with a note type', () => {
    const folder = '40 Journal/46 Sessions/Sport/Strength/2026'

    /** The basename a target note gets on Nov 3 when the name is free */
    function nameFor(target: CaptureTarget, noteType: StarterKitNoteType = STRENGTH_TYPE): string {
        const layout = describeTargetLayout(target, noteType)
        if (!isTargetLayout(layout)) throw new Error(layout)
        const path = resolveFreeTargetPath(layout, NOV_3, () => false)?.path ?? ''
        return path.slice(path.lastIndexOf('/') + 1)
    }

    test('an empty pattern keeps the type name', () => {
        expect(nameFor(throughTheDay({ noteTypeFileName: '' }))).toBe(
            '2026-11-03 (Strength Session).md'
        )
        expect(nameFor(throughTheDay({ noteTypeFileName: '   ' }))).toBe(
            '2026-11-03 (Strength Session).md'
        )
    })

    test('the old default {{date}} keeps the type name', () => {
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{date}}' }))).toBe(
            '2026-11-03 (Strength Session).md'
        )
        expect(nameFor(throughTheDay({ noteTypeFileName: ' {{date}} ' }))).toBe(
            '2026-11-03 (Strength Session).md'
        )
    })

    test('text after the date goes before the type suffix', () => {
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{date}} Through the day' }))).toBe(
            '2026-11-03 Through the day (Strength Session).md'
        )
    })

    test('text before the date goes after the type prefix', () => {
        const prefixed: StarterKitNoteType = { ...STRENGTH_TYPE, noteNamePrefix: 'S ' }
        expect(nameFor(throughTheDay({ noteTypeFileName: 'Gym {{date}} AM' }), prefixed)).toBe(
            'S Gym 2026-11-03 AM (Strength Session).md'
        )
    })

    test('a suffix typed in the pattern is not added twice', () => {
        expect(
            nameFor(
                throughTheDay({ noteTypeFileName: '{{date}} Through the day (Strength Session)' })
            )
        ).toBe('2026-11-03 Through the day (Strength Session).md')
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{date}} (strength session)' }))).toBe(
            '2026-11-03 (Strength Session).md'
        )
    })

    test('the counter goes right after the date', () => {
        const layout = describeTargetLayout(
            throughTheDay({ noteTypeFileName: '{{date}} Through the day' }),
            STRENGTH_TYPE
        ) as TargetLayout
        expect(layout.head).toBe('{{date}}')
        expect(layout.tail).toBe(' Through the day (Strength Session)')
        expect(
            resolveFreeTargetPath(
                layout,
                NOV_3,
                (path) => path === `${folder}/2026-11-03 Through the day (Strength Session).md`
            )?.path
        ).toBe(`${folder}/2026-11-03 2 Through the day (Strength Session).md`)
    })

    test('a pattern without {{date}} keeps the type name and is flagged', () => {
        const target = throughTheDay({ noteTypeFileName: 'Through the day' })
        expect(nameFor(target)).toBe('2026-11-03 (Strength Session).md')
        const issues = describeTargetIssues(target, STRENGTH_TYPE)
        expect(issues).toHaveLength(1)
        expect(issues[0]).toContain('{{date}}')
        expect(
            describeTargetIssues(throughTheDay({ noteTypeFileName: '' }), STRENGTH_TYPE)
        ).toEqual([])
    })

    test('the type keeps its folder, template and tags', () => {
        const layout = describeTargetLayout(
            throughTheDay({ noteTypeFileName: '{{date}} Through the day', folder: 'Ignored' }),
            STRENGTH_TYPE
        ) as TargetLayout
        expect(layout.folder).toBe(STRENGTH_TYPE.associatedFolder ?? '')
        expect(layout.templatePath).toBe(STRENGTH_TYPE.templatePath ?? null)
        expect(layout.tags).toEqual(['zone/journal', 'type/session/sport/strength'])
    })

    test('finding the note does not depend on its name', () => {
        const named = candidate({
            path: `${folder}/2026-11-03 (Strength Session).md`,
            basename: '2026-11-03 (Strength Session)'
        })
        expect(
            pickTargetNote(
                [named],
                throughTheDay({ noteTypeFileName: '{{date}} Through the day' }),
                STRENGTH_TYPE,
                NOV_3
            )
        ).toBe(named)
    })

    test('{{DATE}} in upper case is the date token, like when rendering', () => {
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{DATE}} Gym' }))).toBe(
            '2026-11-03 Gym (Strength Session).md'
        )
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{ Date }} Gym' }))).toBe(
            '2026-11-03 Gym (Strength Session).md'
        )
        expect(
            describeTargetIssues(throughTheDay({ noteTypeFileName: '{{DATE}} Gym' }), STRENGTH_TYPE)
        ).toEqual([])
        const standalone = throughTheDay({
            noteTypeId: '',
            folder: 'Sessions',
            fileNamePattern: '{{DATE}} (Workout)'
        })
        expect(nameFor(standalone, STRENGTH_TYPE)).toBe('2026-11-03 (Workout).md')
    })
})

describe('typed prefix and suffix', () => {
    /** The basename on Nov 3 for a type with these affixes */
    function nameWith(pattern: string, prefix: string | null, suffix: string | null): string {
        const noteType: StarterKitNoteType = {
            ...STRENGTH_TYPE,
            noteNamePrefix: prefix,
            noteNameSuffix: suffix
        }
        const layout = describeTargetLayout(throughTheDay({ noteTypeFileName: pattern }), noteType)
        if (!isTargetLayout(layout)) throw new Error(layout)
        const path = resolveFreeTargetPath(layout, NOV_3, () => false)?.path ?? ''
        return path.slice(path.lastIndexOf('/') + 1, -'.md'.length)
    }

    test('a suffix is dropped only at a word boundary', () => {
        expect(nameWith('{{date}} Backlog', null, ' Log')).toBe('2026-11-03 Backlog Log')
        expect(nameWith('{{date}} Gym log', null, ' Log')).toBe('2026-11-03 Gym Log')
        expect(nameWith('{{date}} Gym-Log', null, ' Log')).toBe('2026-11-03 Gym- Log')
        expect(nameWith('{{date}}Log', null, ' Log')).toBe('2026-11-03 Log')
        expect(nameWith('{{date}} Gym(Strength Session)', null, ' (Strength Session)')).toBe(
            '2026-11-03 Gym (Strength Session)'
        )
    })

    test('spaces before a dropped suffix are trimmed only when the suffix starts with one', () => {
        expect(nameWith('{{date}} Gym _S', null, '_S')).toBe('2026-11-03 Gym _S')
        expect(nameWith('{{date}} Gym_S', null, '_S')).toBe('2026-11-03 Gym_S')
        expect(nameWith('{{date}} Gym   (Strength Session)', null, ' (Strength Session)')).toBe(
            '2026-11-03 Gym (Strength Session)'
        )
    })

    test('a typed prefix is not added twice', () => {
        expect(nameWith('S {{date}}', 'S ', null)).toBe('S 2026-11-03')
        expect(nameWith('s Gym {{date}}', 'S ', null)).toBe('S Gym 2026-11-03')
        expect(nameWith('S{{date}}', 'S ', null)).toBe('S 2026-11-03')
        expect(nameWith('S - {{date}}', 'S - ', ' (S)')).toBe('S - 2026-11-03 (S)')
    })

    test('a prefix is dropped only at a word boundary', () => {
        expect(nameWith('Sauna {{date}}', 'S ', null)).toBe('S Sauna 2026-11-03')
        expect(nameWith('Gym {{date}}', 'S ', null)).toBe('S Gym 2026-11-03')
    })

    test('spaces after a dropped prefix are trimmed only when the prefix ends with one', () => {
        expect(nameWith('S_ Gym {{date}}', 'S_', null)).toBe('S_ Gym 2026-11-03')
        expect(nameWith('S    {{date}}', 'S ', null)).toBe('S 2026-11-03')
    })
})

describe('noteTypeFileName and the legacy fileNamePattern', () => {
    function nameFor(target: CaptureTarget, noteType: StarterKitNoteType = STRENGTH_TYPE): string {
        const layout = describeTargetLayout(target, noteType)
        if (!isTargetLayout(layout)) throw new Error(layout)
        const path = resolveFreeTargetPath(layout, NOV_3, () => false)?.path ?? ''
        return path.slice(path.lastIndexOf('/') + 1)
    }

    test('a fileNamePattern left from a standalone setup is ignored with a note type', () => {
        for (const legacy of ['{{date}} (Workout)', '{{year}}/{{date}}', '{{date}} #1', 'Gym']) {
            const target = throughTheDay({ fileNamePattern: legacy })
            expect(nameFor(target)).toBe('2026-11-03 (Strength Session).md')
            expect(describeTargetIssues(target, STRENGTH_TYPE, NOV_3)).toEqual([])
        }
    })

    test('noteTypeFileName drives the name, whatever fileNamePattern holds', () => {
        const target = throughTheDay({
            fileNamePattern: '{{date}} (Workout)',
            noteTypeFileName: '{{date}} Gym'
        })
        expect(nameFor(target)).toBe('2026-11-03 Gym (Strength Session).md')
    })

    test('a standalone target ignores noteTypeFileName', () => {
        const target = throughTheDay({
            noteTypeId: '',
            folder: 'Sessions',
            fileNamePattern: '{{date}} (Workout)',
            noteTypeFileName: '{{date}} Gym'
        })
        expect(nameFor(target, STRENGTH_TYPE)).toBe('2026-11-03 (Workout).md')
    })

    test('a note type affix with # or a trailing dot still works with an empty field', () => {
        const hashed: StarterKitNoteType = {
            ...STRENGTH_TYPE,
            noteNamePrefix: '#S ',
            noteNameSuffix: ' (Gym).'
        }
        const target = throughTheDay()
        expect(nameFor(target, hashed)).toBe('#S 2026-11-03 (Gym)..md')
        expect(describeTargetIssues(target, hashed, NOV_3)).toEqual([])
        // Own text is checked, the affixes are not
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{date}} AM' }), hashed)).toBe(
            '#S 2026-11-03 AM (Gym)..md'
        )
        expect(nameFor(throughTheDay({ noteTypeFileName: '{{date}} #1' }), hashed)).toBe('')
    })
})

describe('typed affixes: Unicode', () => {
    function nameWith(pattern: string, suffix: string): string {
        const noteType: StarterKitNoteType = { ...STRENGTH_TYPE, noteNameSuffix: suffix }
        const layout = describeTargetLayout(throughTheDay({ noteTypeFileName: pattern }), noteType)
        if (!isTargetLayout(layout)) throw new Error(layout)
        const path = resolveFreeTargetPath(layout, NOV_3, () => false)?.path ?? ''
        return path.slice(path.lastIndexOf('/') + 1, -'.md'.length)
    }

    test('a combining mark continues a word: no boundary before the suffix', () => {
        expect(nameWith('{{date}} Cafe\u0301Log', ' Log')).toBe('2026-11-03 Cafe\u0301Log Log')
    })

    test('a character whose length changes when lower-cased never makes a wrong cut', () => {
        // 'İ'.toLowerCase() is two code units: slicing by that length cut "Gym"
        const name = nameWith('{{date}} Gym İ', ' i\u0307')
        expect(name.startsWith('2026-11-03 Gym İ')).toBe(true)
    })

    test('a suffix copy in another case is dropped where it actually starts', () => {
        expect(nameWith('{{date}} Gym ÉTÉ', ' Été')).toBe('2026-11-03 Gym Été')
    })
})

describe('file name patterns capture would refuse', () => {
    const standalone = (fileNamePattern: string): CaptureTarget =>
        throughTheDay({ noteTypeId: '', folder: 'Sessions', fileNamePattern })

    /** The path a standalone target creates on Nov 3, or null when refused */
    const standalonePath = (pattern: string): string | null => {
        const layout = describeTargetLayout(standalone(pattern), null)
        if (!isTargetLayout(layout)) throw new Error(layout)
        return resolveFreeTargetPath(layout, NOV_3, () => false)?.path ?? null
    }

    const NOTE_TYPE_INVALID = `Capture target "Through the day" does not give a valid note path. Check the file name pattern (and the folder) for unknown {{tokens}}, characters such as : ? | # * " < > [ ] ^, or a trailing dot.`
    const STANDALONE_INVALID = `Capture target "Through the day" does not give a valid note path. Check the file name pattern (and the folder) for unknown {{tokens}} or characters such as : ? | * " < > \\.`

    test.each([
        ['a colon', '{{date}} 10:00'],
        ['a question mark', '{{date}} Gym?'],
        ['a pipe', '{{date}} Gym | AM'],
        ['a hash', '{{date}} Gym #1'],
        ['a star', '{{date}} Gym*'],
        ['a caret', '{{date}} Gym ^1'],
        ['brackets', '{{date}} [Gym]'],
        ['a trailing dot', '{{date}}.'],
        ['an unknown token', '{{date}} {{time}}'],
        ['a date format', '{{date:YYYY}} {{date}}']
    ])(
        'with a note type, %s is listed under Problems and refused at capture',
        (_label, pattern) => {
            const target = throughTheDay({ noteTypeFileName: pattern })
            const noteType: StarterKitNoteType = { ...STRENGTH_TYPE, noteNameSuffix: null }
            expect(describeTargetIssues(target, noteType, NOV_3)).toEqual([NOTE_TYPE_INVALID])
            const layout = describeTargetLayout(target, noteType)
            if (!isTargetLayout(layout)) throw new Error(layout)
            expect(resolveFreeTargetPath(layout, NOV_3, () => false)).toBeNull()
        }
    )

    test.each([
        ['a colon', '{{date}} 10:00'],
        ['a question mark', '{{date}} Gym?'],
        ['a pipe', '{{date}} Gym | AM'],
        ['a star', '{{date}} Gym*'],
        ['an unknown token', '{{date}} {{time}}'],
        ['a date format', '{{date:YYYY}} {{date}}']
    ])('standalone: %s is refused at capture as in 3.5.0, and listed', (_label, pattern) => {
        expect(standalonePath(pattern)).toBeNull()
        expect(describeTargetIssues(standalone(pattern), null, NOV_3)).toEqual([STANDALONE_INVALID])
    })

    test.each([
        ['a hash', '{{date}} Gym #1', 'Sessions/2026-11-03 Gym #1.md'],
        ['a caret', '{{date}} Gym ^1', 'Sessions/2026-11-03 Gym ^1.md'],
        ['brackets', '{{date}} [Gym]', 'Sessions/2026-11-03 [Gym].md'],
        ['a trailing dot', '{{date}} Gym.', 'Sessions/2026-11-03 Gym..md']
    ])('standalone: %s is still accepted, as in 3.5.0', (_label, pattern, path) => {
        expect(standalonePath(pattern)).toBe(path)
        expect(describeTargetIssues(standalone(pattern), null, NOV_3)).toEqual([])
    })

    test('a pattern capture accepts has no problem', () => {
        expect(describeTargetIssues(standalone('{{date}} (Workout)'), null, NOV_3)).toEqual([])
        expect(
            describeTargetIssues(
                throughTheDay({ noteTypeFileName: '{{date}} AM' }),
                STRENGTH_TYPE,
                NOV_3
            )
        ).toEqual([])
    })

    test.each(['{{year}}/{{date}}', '{{date}}/Gym', '{{date}}\\Gym'])(
        'with a note type, a folder separator in %s is its own problem',
        (pattern) => {
            const typed = throughTheDay({ noteTypeFileName: pattern })
            expect(describeTargetLayout(typed, STRENGTH_TYPE)).toBe('folder-in-file-name')
            expect(describeTargetIssues(typed, STRENGTH_TYPE, NOV_3)).toEqual([
                'The file name pattern of capture target "Through the day" contains / or \\. A file name cannot hold folders: the note type gives the folder.'
            ])
        }
    )

    test('standalone: / still makes subfolders, as in 3.5.0', () => {
        expect(standalonePath('{{year}}/{{date}}')).toBe('Sessions/2026/2026-11-03.md')
        expect(standalonePath('{{date}}/Gym')).toBe('Sessions/2026-11-03/Gym.md')
        expect(describeTargetIssues(standalone('{{year}}/{{date}}'), null, NOV_3)).toEqual([])
    })
})

describe('resolveFreeTargetPath', () => {
    const layout = describeTargetLayout(throughTheDay(), STRENGTH_TYPE) as TargetLayout
    const folder = '40 Journal/46 Sessions/Sport/Strength/2026'

    test('the plain name when free', () => {
        expect(resolveFreeTargetPath(layout, NOV_3, () => false)).toEqual({
            path: `${folder}/2026-11-03 (Strength Session).md`,
            folder
        })
    })

    test('a taken name is never reused: the counter goes after the date', () => {
        const taken = new Set([
            `${folder}/2026-11-03 (Strength Session).md`,
            `${folder}/2026-11-03 2 (Strength Session).md`
        ])
        expect(resolveFreeTargetPath(layout, NOV_3, (path) => taken.has(path))?.path).toBe(
            `${folder}/2026-11-03 3 (Strength Session).md`
        )
    })

    test('a pattern without tokens gets the counter at the end', () => {
        const plain: TargetLayout = { ...layout, folder: 'W', head: 'Workout', tail: '' }
        expect(resolveFreeTargetPath(plain, NOV_3, (path) => path === 'W/Workout.md')?.path).toBe(
            'W/Workout 2.md'
        )
    })

    test('unrenderable or unsafe layouts and exhausted counters give null', () => {
        expect(resolveFreeTargetPath({ ...layout, folder: 'A/*' }, NOV_3, () => false)).toBeNull()
        expect(
            resolveFreeTargetPath({ ...layout, tail: ' {{nope}}' }, NOV_3, () => false)
        ).toBeNull()
        expect(resolveFreeTargetPath({ ...layout, folder: '../x' }, NOV_3, () => false)).toBeNull()
        expect(resolveFreeTargetPath(layout, NOV_3, () => true)).toBeNull()
    })
})

describe('buildCreationFrontmatter', () => {
    const layout = describeTargetLayout(throughTheDay(), STRENGTH_TYPE) as TargetLayout
    const ALL_TAGS = ['zone/journal', 'type/session/sport/strength']

    test('writes the date, the filters and merges the mandatory tags', () => {
        expect(
            buildCreationFrontmatter(throughTheDay(), layout, NOV_3, { tags: ['zone/journal'] })
        ).toEqual({
            date: '2026-11-03',
            workout_kind: 'Through the day',
            tags: ALL_TAGS
        })
    })

    test('a one-string tags value is split, not kept as one tag (review #9)', () => {
        expect(
            buildCreationFrontmatter(throughTheDay(), layout, NOV_3, { tags: 'journal, daily' })[
                'tags'
            ]
        ).toEqual(['journal', 'daily', ...ALL_TAGS])
        expect(buildCreationFrontmatter(throughTheDay(), layout, NOV_3, {})['tags']).toEqual(
            ALL_TAGS
        )
    })

    test('tags already present (also under the singular tag key) are not added again', () => {
        const values = buildCreationFrontmatter(throughTheDay(), layout, NOV_3, {
            tags: ['#zone/journal'],
            tag: 'type/session/sport/strength'
        })
        expect(values['tags']).toBeUndefined()
    })

    test('a date the template wrote for that day is kept as written (review #8)', () => {
        for (const date of ['2026-11-03T08:15', '[[2026-11-03]]', '[[Journal/2026-11-03|Tue]]']) {
            expect(
                buildCreationFrontmatter(throughTheDay(), layout, NOV_3, { date })['date']
            ).toBeUndefined()
        }
        // A different day or something unreadable is replaced
        expect(
            buildCreationFrontmatter(throughTheDay(), layout, NOV_3, { date: '2026-11-04' })['date']
        ).toBe('2026-11-03')
        expect(
            buildCreationFrontmatter(throughTheDay(), layout, NOV_3, { date: '<% tp.date %>' })[
                'date'
            ]
        ).toBe('2026-11-03')
    })

    test('incomplete filter rows are never written (review #10)', () => {
        const values = buildCreationFrontmatter(
            throughTheDay({
                filters: [
                    { property: 'workout_kind', value: '' },
                    { property: '', value: 'x' },
                    { property: ' location ', value: ' Home ' }
                ]
            }),
            layout,
            NOV_3,
            {}
        )
        expect(values).toEqual({ date: '2026-11-03', location: 'Home', tags: ALL_TAGS })
    })

    test('no tags to add, no date property: neither is written', () => {
        const values = buildCreationFrontmatter(
            throughTheDay({ dateProperty: ' ', filters: [] }),
            { ...layout, tags: [] },
            NOV_3,
            {}
        )
        expect(values).toEqual({})
    })
})

describe('readFrontmatterTags (review #17)', () => {
    test('reads tags and the singular tag key, lists or strings', () => {
        expect(readFrontmatterTags({ tags: ['a', ' ', 3], tag: 'b, #c d' })).toEqual([
            'a',
            'b',
            '#c',
            'd'
        ])
        expect(readFrontmatterTags({})).toEqual([])
    })
})

describe('parseDateValue (review #8)', () => {
    test('ISO dates, datetimes, wikilinks and Dates', () => {
        for (const value of [
            '2026-11-03',
            '2026-11-03T08:15',
            ' [[2026-11-03]] ',
            '[[Journal/2026-11-03|Tuesday]]',
            new Date('2026-11-03T00:00:00Z')
        ]) {
            expect(parseDateValue(value)).toEqual(NOV_3)
        }
    })

    test('anything else names no day', () => {
        for (const value of ['soon', '[[Some note]]', '2026-02-31', 42, null, new Date('x')]) {
            expect(parseDateValue(value)).toBeNull()
        }
    })
})

describe('needsDiscoverabilityWarning', () => {
    const resolved = { path: 'S/2026-11-03 (Strength Session).md', folder: 'S' }

    test('never with a date property, even for an unparseable file name', () => {
        expect(needsDiscoverabilityWarning(throughTheDay(), resolved, NOV_3)).toBe(false)
    })

    test('without a date property the file name decides', () => {
        const noDate = throughTheDay({ dateProperty: '' })
        expect(needsDiscoverabilityWarning(noDate, resolved, NOV_3)).toBe(true)
        expect(
            needsDiscoverabilityWarning(noDate, { path: 'S/2026-11-03.md', folder: 'S' }, NOV_3)
        ).toBe(false)
    })
})

describe('sanitizeCaptureTargets', () => {
    let counter = 0
    const generateId = (): string => `gen-${++counter}`

    test('defaults every missing or malformed field', () => {
        const [target] = sanitizeCaptureTargets(
            [
                {
                    id: 'x',
                    name: 3,
                    filters: [{ property: 'a', value: 'b' }, { property: 1 }, null],
                    tags: ['t', 2]
                }
            ],
            generateId
        )
        expect(target).toEqual({
            id: 'x',
            name: '',
            noteTypeId: '',
            folder: '',
            fileNamePattern: '{{date}}',
            noteTypeFileName: '',
            templatePath: '',
            tags: ['t'],
            filters: [{ property: 'a', value: 'b' }],
            dateProperty: 'date'
        })
    })

    test('a non-list is empty; non-objects dropped; missing and duplicate ids re-minted', () => {
        expect(sanitizeCaptureTargets('nope', generateId)).toEqual([])
        const targets = sanitizeCaptureTargets(
            [null, 'x', [], { id: 'a' }, { id: 'a' }, {}],
            generateId
        )
        expect(targets).toHaveLength(3)
        expect(new Set(targets.map((target) => target.id)).size).toBe(3)
        expect(targets[0]?.id).toBe('a')
    })
})

describe('describeTargetIssues (review #10, #11)', () => {
    test('a usable target has no issues', () => {
        expect(describeTargetIssues(throughTheDay(), STRENGTH_TYPE)).toEqual([])
    })

    test('lists incomplete filter rows and an unusable setup', () => {
        const issues = describeTargetIssues(
            throughTheDay({
                noteTypeId: '',
                folder: 'W',
                fileNamePattern: 'Workout',
                filters: [
                    { property: 'workout_kind', value: '' },
                    { property: 'kind', value: 'x' }
                ]
            }),
            null
        )
        expect(issues).toEqual([
            'The file name pattern of capture target "Through the day" needs {{date}}.',
            'Match filter row 1 needs both a property and a value; it is ignored.'
        ])
    })
})
