import { describe, expect, test } from 'bun:test'
import { createCaptureTarget } from '../types'
import {
    fileNameFieldDescription,
    fileNameFieldValue,
    parseTagField,
    setFileNameFieldValue
} from './capture-target-section'

describe('parseTagField', () => {
    test('splits on commas and spaces, drops # and empties', () => {
        expect(parseTagField('#workout, daily-moves  ,, zone/journal')).toEqual([
            'workout',
            'daily-moves',
            'zone/journal'
        ])
        expect(parseTagField('  ')).toEqual([])
    })
})

describe('fileNameFieldDescription', () => {
    test('with a note type, empty gives the note type name, not the date only', () => {
        const desc = fileNameFieldDescription({ noteTypeId: 'nt-strength' })
        expect(desc).toContain("Empty: the note type's usual name.")
        expect(desc).not.toContain('the date only')
    })

    test('standalone keeps the {{date}} wording', () => {
        const desc = fileNameFieldDescription({ noteTypeId: '' })
        expect(desc).toContain('Use {{date}} for the date.')
        expect(desc).not.toContain('Empty:')
    })

    test('both say date formats are not supported', () => {
        for (const noteTypeId of ['', 'nt-strength']) {
            expect(fileNameFieldDescription({ noteTypeId })).toContain(
                'Date formats such as {{date:YYYY}} are not supported.'
            )
        }
    })
})

describe('File name field binding', () => {
    const base = {
        ...createCaptureTarget('t1', 'Through the day'),
        fileNamePattern: '{{date}} (Workout)'
    }

    test('standalone edits fileNamePattern, note type edits noteTypeFileName', () => {
        const standalone = structuredClone(base)
        setFileNameFieldValue(standalone, '{{date}} Moves')
        expect(standalone.fileNamePattern).toBe('{{date}} Moves')
        expect(standalone.noteTypeFileName).toBe('')

        const typed = { ...structuredClone(base), noteTypeId: 'nt-strength' }
        expect(fileNameFieldValue(typed)).toBe('')
        setFileNameFieldValue(typed, '{{date}} Gym')
        expect(typed.noteTypeFileName).toBe('{{date}} Gym')
        expect(typed.fileNamePattern).toBe('{{date}} (Workout)')
    })

    test('switching the mode keeps the two patterns apart', () => {
        const target = structuredClone(base)
        target.noteTypeId = 'nt-strength'
        expect(fileNameFieldValue(target)).toBe('')
        setFileNameFieldValue(target, '{{date}} Gym')

        target.noteTypeId = ''
        expect(fileNameFieldValue(target)).toBe('{{date}} (Workout)')
        target.noteTypeId = 'nt-strength'
        expect(fileNameFieldValue(target)).toBe('{{date}} Gym')
    })
})
