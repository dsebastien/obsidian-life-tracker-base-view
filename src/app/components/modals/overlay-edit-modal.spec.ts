import { describe, expect, test } from 'bun:test'
import type { BasesPropertyId } from 'obsidian'
import { overlayUpdateFromEditResult, type OverlayEditResult } from './overlay-edit-modal'
import { VisualizationType } from '../../types'

describe('overlayUpdateFromEditResult', () => {
    test('writes every field the modal edits, value format and outliers included', () => {
        const result: OverlayEditResult = {
            displayName: 'Sleep vs pace',
            visualizationType: VisualizationType.LineChart,
            propertyIds: ['note.sleep', 'note.pace'] as BasesPropertyId[],
            referenceLines: undefined,
            hideIndividualVisualizations: true,
            aggregationMethod: 'sum',
            valueFormat: 'duration-mm-ss',
            outliers: 'show-all'
        }
        expect(overlayUpdateFromEditResult(result)).toEqual({ ...result })
    })

    test('defaults are written as cleared, not left stale', () => {
        const update = overlayUpdateFromEditResult({
            displayName: 'Overlay',
            visualizationType: VisualizationType.BarChart,
            propertyIds: ['note.a', 'note.b'] as BasesPropertyId[],
            hideIndividualVisualizations: false,
            aggregationMethod: undefined,
            valueFormat: undefined,
            outliers: undefined
        })
        expect('valueFormat' in update).toBe(true)
        expect(update.valueFormat).toBeUndefined()
        expect('outliers' in update).toBe(true)
        expect(update.outliers).toBeUndefined()
    })
})
