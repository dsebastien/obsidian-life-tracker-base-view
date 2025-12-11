import type { BasesPropertyId } from 'obsidian'

/**
 * Source for date anchor extraction
 */
export type DateAnchorSource =
    | { type: 'filename'; pattern: string }
    | { type: 'property'; propertyId: BasesPropertyId }
    | { type: 'file-metadata'; field: 'ctime' | 'mtime' }

/**
 * Configuration for date anchor resolution
 */
export interface DateAnchorConfig {
    source: DateAnchorSource
    priority: number
}

/**
 * Resolved date anchor with confidence level
 */
export interface ResolvedDateAnchor {
    date: Date
    source: DateAnchorSource
    confidence: 'high' | 'medium' | 'low'
}

/**
 * Date pattern for filename matching
 */
export interface DatePattern {
    regex: RegExp
    granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    parser: (match: RegExpMatchArray) => Date | null
}
