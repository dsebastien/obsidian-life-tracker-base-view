import { describe, expect, test } from 'bun:test'
import { CSS_CLASS, CSS_SELECTOR, DATA_ATTR, DATA_ATTR_FULL } from './dom.utils'

describe('dom-constants', () => {
    describe('CSS_CLASS', () => {
        test('contains expected class names', () => {
            expect(CSS_CLASS.CARD).toBe('lt-card')
            expect(CSS_CLASS.HIDDEN).toBe('lt-hidden')
            expect(CSS_CLASS.HEATMAP_CELL).toBe('lt-heatmap-cell')
            expect(CSS_CLASS.PROPERTY_DETAILS).toBe('lt-property-details')
        })

        test('class names use lt- prefix', () => {
            Object.values(CSS_CLASS).forEach((className) => {
                expect(className.startsWith('lt-')).toBe(true)
            })
        })
    })

    describe('CSS_SELECTOR', () => {
        test('selectors are derived from CSS_CLASS', () => {
            expect(CSS_SELECTOR.CARD).toBe(`.${CSS_CLASS.CARD}`)
            expect(CSS_SELECTOR.HEATMAP_CELL).toBe(`.${CSS_CLASS.HEATMAP_CELL}`)
            expect(CSS_SELECTOR.PROPERTY_DETAILS).toBe(`.${CSS_CLASS.PROPERTY_DETAILS}`)
        })

        test('selectors start with dot', () => {
            Object.values(CSS_SELECTOR).forEach((selector) => {
                expect(selector.startsWith('.')).toBe(true)
            })
        })
    })

    describe('DATA_ATTR', () => {
        test('contains camelCase attribute names for dataset API', () => {
            expect(DATA_ATTR.PROPERTY_ID).toBe('propertyId')
            expect(DATA_ATTR.FILE_PATH).toBe('filePath')
            expect(DATA_ATTR.ROW_INDEX).toBe('rowIndex')
        })
    })

    describe('DATA_ATTR_FULL', () => {
        test('contains data- prefixed attribute names', () => {
            expect(DATA_ATTR_FULL.PROPERTY_ID).toBe('data-property-id')
            expect(DATA_ATTR_FULL.FILE_PATH).toBe('data-file-path')
            expect(DATA_ATTR_FULL.ROW_INDEX).toBe('data-row-index')
        })

        test('all attribute names start with data-', () => {
            Object.values(DATA_ATTR_FULL).forEach((attr) => {
                expect(attr.startsWith('data-')).toBe(true)
            })
        })
    })
})
