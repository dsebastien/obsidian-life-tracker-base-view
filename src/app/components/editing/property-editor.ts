import type { PropertyEditor, PropertyEditorConfig } from '../../types'
import { TextEditor } from './text-editor'
import { NumberEditor } from './number-editor'
import { BooleanEditor } from './boolean-editor'
import { DateEditor } from './date-editor'
import { ListEditor } from './list-editor'
export { BasePropertyEditor } from './base-editor'

/**
 * Factory function to create the appropriate editor for a property type
 */
export function createPropertyEditor(config: PropertyEditorConfig): PropertyEditor {
    switch (config.definition.type) {
        case 'text':
            return new TextEditor(config)
        case 'number':
            return new NumberEditor(config)
        case 'checkbox':
            return new BooleanEditor(config)
        case 'date':
        case 'datetime':
            return new DateEditor(config)
        case 'list':
        case 'tags':
            return new ListEditor(config)
        default:
            // Fallback to text editor for unknown types
            return new TextEditor(config)
    }
}
