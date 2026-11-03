import { describe, expect, test } from 'bun:test'
import { InFlight } from './in-flight.utils'

describe('InFlight', () => {
    test('a second request for a pending key joins the first', async () => {
        const inFlight = new InFlight<string>()
        let starts = 0
        let release: (value: string) => void = () => undefined
        const start = (): Promise<string> => {
            starts++
            return new Promise<string>((resolve) => {
                release = resolve
            })
        }

        const first = inFlight.run('t1|2030-01-02', start)
        const second = inFlight.run('t1|2030-01-02', start)
        expect(inFlight.get('t1|2030-01-02')).toBe(first)
        release('2030-01-02 2 (Strength Session)')

        expect(await second).toBe('2030-01-02 2 (Strength Session)')
        expect(starts).toBe(1)
    })

    test('a settled key is released, other keys are independent', async () => {
        const inFlight = new InFlight<number>()
        await inFlight.run('a', () => Promise.resolve(1))
        expect(inFlight.get('a')).toBeUndefined()
        expect(await inFlight.run('a', () => Promise.resolve(2))).toBe(2)
        expect(await inFlight.run('b', () => Promise.resolve(3))).toBe(3)
    })

    test('a failed operation releases its key too', async () => {
        const inFlight = new InFlight<number>()
        await inFlight.run('a', () => Promise.reject(new Error('x'))).catch(() => undefined)
        expect(inFlight.get('a')).toBeUndefined()
    })
})
