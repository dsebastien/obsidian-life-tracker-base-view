import type { BasesPropertyId } from 'obsidian'

/**
 * Callback type for maximize toggle events
 */
export type MaximizeCallback = (propertyId: BasesPropertyId, maximize: boolean) => void
