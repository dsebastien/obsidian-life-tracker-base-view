/**
 * Serialize a table to CSV with RFC 4180 quoting.
 * Null values become empty fields.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
    const escapeField = (value: string | number | null): string => {
        if (value === null) return ''
        const str = String(value)
        return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    return [headers, ...rows].map((row) => row.map(escapeField).join(',')).join('\n')
}

/**
 * Strip characters that are invalid in file names across platforms.
 * Collapses runs of whitespace; falls back to 'export' for empty results.
 */
export function sanitizeFilename(name: string): string {
    const cleaned = name
        .replace(/[\\/:*?"<>|#^[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    return cleaned || 'export'
}
