import { describe, expect, test } from 'bun:test'
import { fileNameFieldDescription, parseTagField } from './capture-target-section'

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
