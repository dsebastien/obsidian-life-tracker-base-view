import type { App, TFile } from 'obsidian'
import type { PropertyDefinition, ValidationResult, PropertyIssue } from '../types'

/**
 * Service for reading and writing frontmatter properties
 */
export class FrontmatterService {
    constructor(private app: App) {}

    /**
     * Read all frontmatter properties from a file (synchronous - uses cache)
     */
    read(file: TFile): Record<string, unknown> {
        const cache = this.app.metadataCache.getFileCache(file)
        return cache?.frontmatter ?? {}
    }

    /**
     * Read specific properties from a file based on property definitions
     * Returns values matching the definition names (case-insensitive)
     * Synchronous - uses metadata cache
     */
    readDefinedProperties(file: TFile, definitions: PropertyDefinition[]): Record<string, unknown> {
        const frontmatter = this.read(file)
        const result: Record<string, unknown> = {}

        for (const def of definitions) {
            // Find the property in frontmatter (case-insensitive)
            const key = this.findFrontmatterKey(frontmatter, def.name)
            if (key) {
                result[def.name] = frontmatter[key]
            } else {
                result[def.name] = undefined
            }
        }

        return result
    }

    /**
     * Write properties to file frontmatter
     * Uses app.fileManager.processFrontMatter for safe updates
     */
    async write(file: TFile, values: Record<string, unknown>): Promise<void> {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
            for (const [key, value] of Object.entries(values)) {
                if (value === null || value === undefined || value === '') {
                    // Remove the property if value is empty
                    delete frontmatter[key]
                } else {
                    frontmatter[key] = value
                }
            }
        })
    }

    /**
     * Validate a value against a property definition
     */
    validate(value: unknown, definition: PropertyDefinition): ValidationResult {
        // Check required
        if (definition.required && (value === null || value === undefined || value === '')) {
            return { valid: false, error: 'This field is required' }
        }

        // Skip validation for empty optional values
        if (value === null || value === undefined || value === '') {
            return { valid: true }
        }

        switch (definition.type) {
            case 'text':
                return this.validateText(value, definition)
            case 'number':
                return this.validateNumber(value, definition)
            case 'checkbox':
                return this.validateBoolean(value)
            case 'date':
                return this.validateDate(value)
            case 'datetime':
                return this.validateDatetime(value)
            case 'list':
                return this.validateList(value, definition)
            case 'tags':
                return this.validateTags(value, definition)
            default:
                return { valid: true }
        }
    }

    /**
     * Check if a file has any property issues
     */
    hasIssues(frontmatter: Record<string, unknown>, definitions: PropertyDefinition[]): boolean {
        return this.getIssues(frontmatter, definitions).length > 0
    }

    /**
     * Get detailed issues for a file's properties
     */
    getIssues(
        frontmatter: Record<string, unknown>,
        definitions: PropertyDefinition[]
    ): PropertyIssue[] {
        const issues: PropertyIssue[] = []

        for (const def of definitions) {
            const key = this.findFrontmatterKey(frontmatter, def.name)
            const value = key ? frontmatter[key] : undefined

            // Check missing required
            if (def.required && (value === null || value === undefined || value === '')) {
                issues.push({
                    propertyName: def.name,
                    type: 'missing',
                    message: `Required property "${def.displayName || def.name}" is missing`
                })
                continue
            }

            // Skip validation for empty optional values
            if (value === null || value === undefined || value === '') {
                continue
            }

            // Validate value
            const validation = this.validate(value, def)
            if (!validation.valid) {
                issues.push({
                    propertyName: def.name,
                    type: 'invalid',
                    message:
                        validation.error ?? `Invalid value for "${def.displayName || def.name}"`
                })
            }
        }

        return issues
    }

    /**
     * Find a frontmatter key by name (case-insensitive)
     */
    private findFrontmatterKey(
        frontmatter: Record<string, unknown>,
        name: string
    ): string | undefined {
        const lowerName = name.toLowerCase()
        return Object.keys(frontmatter).find((key) => key.toLowerCase() === lowerName)
    }

    private validateText(value: unknown, definition: PropertyDefinition): ValidationResult {
        const strValue = String(value)

        if (definition.allowedValues.length > 0) {
            // Case-insensitive match against allowed values
            const lowerValue = strValue.toLowerCase()
            const isAllowed = definition.allowedValues.some(
                (allowed) => String(allowed).toLowerCase() === lowerValue
            )
            if (!isAllowed) {
                return {
                    valid: false,
                    error: `Value must be one of: ${definition.allowedValues.join(', ')}`
                }
            }
        }

        return { valid: true }
    }

    private validateNumber(value: unknown, definition: PropertyDefinition): ValidationResult {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value))

        if (isNaN(numValue)) {
            return { valid: false, error: 'Value must be a number' }
        }

        const numberRange = definition.numberRange
        if (numberRange) {
            if (numValue < numberRange.min) {
                return { valid: false, error: `Value must be at least ${numberRange.min}` }
            }
            if (numValue > numberRange.max) {
                return { valid: false, error: `Value must be at most ${numberRange.max}` }
            }
        }

        return { valid: true }
    }

    private validateBoolean(value: unknown): ValidationResult {
        if (typeof value === 'boolean') {
            return { valid: true }
        }

        const strValue = String(value).toLowerCase()
        if (['true', 'false', 'yes', 'no', '1', '0'].includes(strValue)) {
            return { valid: true }
        }

        return { valid: false, error: 'Value must be true or false' }
    }

    private validateDate(value: unknown): ValidationResult {
        const strValue = String(value)

        // Check ISO date format YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(strValue)) {
            return { valid: false, error: 'Date must be in YYYY-MM-DD format' }
        }

        // Check if it's a valid date
        const date = new Date(strValue)
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Invalid date' }
        }

        return { valid: true }
    }

    private validateDatetime(value: unknown): ValidationResult {
        const strValue = String(value)

        // Check ISO datetime format
        const date = new Date(strValue)
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Invalid datetime' }
        }

        return { valid: true }
    }

    private validateList(value: unknown, definition: PropertyDefinition): ValidationResult {
        let listValue: string[]

        if (Array.isArray(value)) {
            listValue = value.map(String)
        } else {
            // Try to parse as comma-separated
            listValue = String(value)
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
        }

        if (definition.allowedValues.length > 0) {
            const allowedLower = definition.allowedValues.map((v) => String(v).toLowerCase())
            for (const item of listValue) {
                if (!allowedLower.includes(item.toLowerCase())) {
                    return {
                        valid: false,
                        error: `"${item}" is not an allowed value. Allowed: ${definition.allowedValues.join(', ')}`
                    }
                }
            }
        }

        return { valid: true }
    }

    private validateTags(value: unknown, definition: PropertyDefinition): ValidationResult {
        let tagValues: string[]

        if (Array.isArray(value)) {
            tagValues = value.map(String)
        } else {
            tagValues = String(value)
                .split(/[,\s]+/)
                .filter(Boolean)
        }

        // Check that each tag starts with # (or add it)
        for (const tag of tagValues) {
            if (!tag.startsWith('#') && !tag.match(/^[a-zA-Z0-9_-]+$/)) {
                return { valid: false, error: `Invalid tag format: "${tag}"` }
            }
        }

        if (definition.allowedValues.length > 0) {
            const allowedLower = definition.allowedValues.map((v) =>
                String(v).toLowerCase().replace(/^#/, '')
            )
            for (const tag of tagValues) {
                const normalizedTag = tag.toLowerCase().replace(/^#/, '')
                if (!allowedLower.includes(normalizedTag)) {
                    return {
                        valid: false,
                        error: `"${tag}" is not an allowed tag. Allowed: ${definition.allowedValues.join(', ')}`
                    }
                }
            }
        }

        return { valid: true }
    }
}
