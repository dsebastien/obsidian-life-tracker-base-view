import type { ViewOption } from 'obsidian'

/**
 * Get view options for Grid View configuration
 */
export function getGridViewOptions(): ViewOption[] {
    return [
        // Filtering options
        {
            type: 'group',
            displayName: 'Filtering',
            items: [
                {
                    type: 'dropdown',
                    key: 'hideNotesWhen',
                    displayName: 'Hide notes when',
                    default: 'required',
                    options: {
                        required: 'All required properties filled',
                        all: 'All properties filled',
                        never: 'Never'
                    }
                }
            ]
        }
    ]
}
