import { describe, expect, test, spyOn, beforeEach, afterEach } from 'bun:test'
import type { LogLevel } from '../app/types'
import { log, LOG_PREFIX, LOG_SEPARATOR } from './log.utils'

describe('log', () => {
    let consoleDebugSpy: ReturnType<typeof spyOn>
    let consoleInfoSpy: ReturnType<typeof spyOn>
    let consoleWarnSpy: ReturnType<typeof spyOn>
    let consoleErrorSpy: ReturnType<typeof spyOn>
    let consoleLogSpy: ReturnType<typeof spyOn>

    beforeEach(() => {
        consoleDebugSpy = spyOn(console, 'debug').mockImplementation(() => {})
        consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {})
        consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {})
        consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
        consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        consoleDebugSpy.mockRestore()
        consoleInfoSpy.mockRestore()
        consoleWarnSpy.mockRestore()
        consoleErrorSpy.mockRestore()
        consoleLogSpy.mockRestore()
    })

    describe('LOG_PREFIX', () => {
        test('is defined', () => {
            expect(LOG_PREFIX).toBeDefined()
            expect(typeof LOG_PREFIX).toBe('string')
        })

        test('contains plugin name', () => {
            expect(LOG_PREFIX).toContain(':')
        })
    })

    describe('LOG_SEPARATOR', () => {
        test('is defined', () => {
            expect(LOG_SEPARATOR).toBeDefined()
            expect(typeof LOG_SEPARATOR).toBe('string')
        })

        test('contains dashes', () => {
            expect(LOG_SEPARATOR).toContain('-')
        })
    })

    describe('log function', () => {
        test('uses console.debug for debug level', () => {
            log('test message', 'debug')
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
            expect(consoleDebugSpy.mock.calls[0]![0]).toContain('test message')
        })

        test('uses console.debug for info level (Obsidian disallows console.info)', () => {
            log('test message', 'info')
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
            expect(consoleDebugSpy.mock.calls[0]![0]).toContain('test message')
        })

        test('uses console.warn for warn level', () => {
            log('test message', 'warn')
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
            expect(consoleWarnSpy.mock.calls[0]![0]).toContain('test message')
        })

        test('uses console.error for error level', () => {
            log('test message', 'error')
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1)
            expect(consoleErrorSpy.mock.calls[0]![0]).toContain('test message')
        })

        test('uses console.debug for undefined level', () => {
            log('test message')
            expect(consoleDebugSpy).toHaveBeenCalledTimes(1)
            expect(consoleDebugSpy.mock.calls[0]![0]).toContain('test message')
        })

        test('prefixes message with LOG_PREFIX', () => {
            log('test message', 'debug')
            expect(consoleDebugSpy.mock.calls[0]![0]).toContain(LOG_PREFIX)
        })

        test('passes additional data to console', () => {
            const extraData = { foo: 'bar' }
            log('test message', 'debug', extraData)
            expect(consoleDebugSpy.mock.calls[0]![1]).toContain(extraData)
        })

        test('passes multiple data arguments', () => {
            log('test message', 'debug', 'data1', 'data2', 'data3')
            expect(consoleDebugSpy.mock.calls[0]![1]).toContain('data1')
            expect(consoleDebugSpy.mock.calls[0]![1]).toContain('data2')
            expect(consoleDebugSpy.mock.calls[0]![1]).toContain('data3')
        })
    })

    describe('LogLevel type', () => {
        test('accepts valid log levels', () => {
            const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
            levels.forEach((level) => {
                expect(() => log('test', level)).not.toThrow()
            })
        })
    })
})
