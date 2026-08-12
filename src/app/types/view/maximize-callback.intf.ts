/**
 * Callback type for maximize toggle events.
 *
 * The visualization does not identify itself here: a single property can back
 * several visualizations, so identity is owned by the wiring code, which closes
 * over the visualization ID (issue #151).
 */
export type MaximizeCallback = (maximize: boolean) => void
