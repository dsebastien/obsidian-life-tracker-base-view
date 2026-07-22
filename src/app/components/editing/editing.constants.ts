/**
 * Shared constants for inline property editing (grid view + capture modal).
 */

/** Debounce delay before an in-progress edit is auto-saved to disk, in milliseconds. */
export const AUTO_SAVE_DEBOUNCE_MS = 500

/**
 * HTML attributes shared by both number-input render paths in NumberEditor.
 *
 * - `inputmode: 'decimal'` shows the decimal keypad (with a `.` key) on mobile.
 * - `pattern` permits an optional sign and an optional decimal point so HTML5
 *   form validation accepts fractional values like `82.75` or `-1.5`. The
 *   previous `[0-9]*` matched integers only, so browsers rejected decimals on
 *   blur/submit even though the keystroke blocker and paste sanitizer already
 *   allowed them.
 */
export const NUMBER_INPUT_ATTRS = {
    inputmode: 'decimal',
    pattern: '-?[0-9]*\\.?[0-9]*'
} as const

/**
 * Number-editor slider granularity. `0.01` lets slider nudges land on
 * two-decimal values (e.g. weight = 82.75 kg) instead of snapping to integers
 * as `1` did, while still avoiding the noisy arbitrary-precision floats that
 * `any` would produce.
 */
export const NUMBER_SLIDER_STEP = '0.01'
