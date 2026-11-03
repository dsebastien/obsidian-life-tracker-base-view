import { describe, expect, test } from 'bun:test'
import { createCaptureTarget } from '../types'
import {
    captureTargetCommandId,
    captureTargetCommandName,
    planCommandSync
} from './capture-target-commands'

const strength = createCaptureTarget('t1', 'Strength')
const music = createCaptureTarget('t2', 'Music')

describe('per-target commands', () => {
    test('ids and names', () => {
        expect(captureTargetCommandId(strength)).toBe('capture-today-target-t1')
        expect(captureTargetCommandName(strength)).toBe('Capture today: Strength')
        expect(captureTargetCommandName({ ...strength, name: '' })).toBe(
            'Capture today: Unnamed target'
        )
    })

    test('a first sync adds one command per target', () => {
        expect(planCommandSync(new Map(), [strength, music])).toEqual({
            remove: [],
            add: [strength, music]
        })
    })

    test('nothing changed: nothing to do', () => {
        const registered = new Map([
            ['capture-today-target-t1', 'Capture today: Strength'],
            ['capture-today-target-t2', 'Capture today: Music']
        ])
        expect(planCommandSync(registered, [strength, music])).toEqual({ remove: [], add: [] })
    })

    test('a removed target loses its command; a renamed one is re-added', () => {
        const registered = new Map([
            ['capture-today-target-t1', 'Capture today: Strength'],
            ['capture-today-target-t2', 'Capture today: Music']
        ])
        const renamed = { ...strength, name: 'Through the day' }
        expect(planCommandSync(registered, [renamed])).toEqual({
            remove: ['capture-today-target-t1', 'capture-today-target-t2'],
            add: [renamed]
        })
    })
})
