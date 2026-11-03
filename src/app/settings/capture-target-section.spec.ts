import { describe, expect, test } from 'bun:test'
import { parseTagField } from './capture-target-section'

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
