/**
 * Markdown files imported with `with { type: 'text' }` resolve to their raw
 * contents (supported natively by Bun's runtime and bundler).
 */
declare module '*.md' {
    const content: string
    export default content
}
