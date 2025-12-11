## Project Documentation

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Agent Workflow

### Files to ignore

\*\*NEVER read or modify

- `TODO.md`\*\* at the project root.
- Files under `documentation/archived` unless instructed otherwise.

### Documentation

**IMPORTANT**:

- At the start of each new session, read the history files in `documentation/history` and plans in `documentation/plans` to understand the project, its current state and what should come next
- Whenever making plans, DO NOT include timing information (e.g., 1-3 weeks, etc) UNLESS asked explicitly
- Whenever making plans, store or update those in `documentation/plans`
- Whenever making plans, focus on actionable information

History is maintained in `documentation/history/yyyy-mm-dd.md` files, organized chronologically. Each file documents:

- What was accomplished that day
- Key decisions made
- Domain model changes
- Implementation progress
- Open questions or blockers

These files are optimized for conciseness and clarity to quickly onboard agents in new sessions.

### Business Rules Compliance

**CRITICAL**: Business rules documented in `documentation/Business Rules.md` MUST ALWAYS be respected unless explicit user approval is given to change or bypass them.

- **Mandatory compliance**: All implementations must respect documented business rules
- **No exceptions without approval**: Changing or bypassing any business rule requires explicit user approval
- **Highest priority**: When making changes, business rule compliance is of the utmost importance
- **Documentation requirement**: When a new business rule is mentioned, it must be immediately documented in `documentation/Business Rules.md` using a concise format (single line or paragraph) without losing precision

Read the Business Rules document at the start of each session to understand the constraints and requirements.

**MUST READ** before working on this codebase: `documentation/**/*.md` — system overview, architecture, components, directory structure, configuration, settings, ...

**MUST UPDATE** documentation when making changes. Keep it terse, accurate, no fluff.

### Core Coding Rules

**MUST READ** TypeScript type definitions you can find in the Obsidian dependency now.

## Environment & tooling

- **[Bun](https://bun.com/)**: a fast all-in-one JavaScript runtime.
- **Package manager: Bun** (required for this sample - `package.json` defines scripts and dependencies).
- **Bundler: Bun** (required for this sample - `build.ts` depends on it).
- **Types**: `obsidian` type definitions.

### Install

```bash
bun install
```

### Dev (watch)

```bash
bun run dev
```

### Production build

```bash
bun run build
```

## Development Workflow

**CRITICAL**: Before making ANY code changes, start the TypeScript watch process in the background:

```bash
bun run tsc:watch
```

This is MANDATORY. The watch process catches type errors immediately as you edit. Check the output after each edit to catch errors early. If you see TypeScript errors, fix them before moving on.

Optionally, also run tests in watch mode:

```bash
bun test --watch
```

After editing code, always run the formatter and linter:

```bash
bun run format
bun run lint
```

Both commands are **MANDATORY** after code changes. Fix any lint errors before proceeding.

## Bun Runtime

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Use `bun test` to run tests.

**MANDATORY**: All test files MUST use the `.spec.ts` extension (not `.test.ts`).

```ts#example.spec.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

Test files should be placed next to the files they test:

```
scripts/
  build.ts
  build.spec.ts        # Tests for build.ts
  update-version.ts
  update-version.spec.ts
```

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
    ```
    <Vault>/.obsidian/plugins/<plugin-id>/
    ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## File & folder conventions

### Base organization

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- All CSS lives in `src/styles.src.css` (Tailwind source file)
- **CSS/Styles**: ALWAYS edit styles in `src/styles.src.css` (Tailwind source file), NEVER edit `styles.css` at the root (this is a generated file that gets overwritten during build).
- Organize CSS with clear section headers (see existing file structure)
- Generated `styles.css` at root is auto-generated - never edit directly
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

### Example file structure

```
  src/
    main.ts           # Plugin entry point, lifecycle management
    settings.ts       # Settings interface and defaults
    commands/         # Command implementations
      command1.ts
      command2.ts
    ui/              # UI components, modals, views
      modal.ts
      view.ts
    utils/           # Utility functions, helpers
      helpers.ts
      constants.ts
    types.ts         # TypeScript interfaces and types
    styles.src.css
```

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):
    - `id` (plugin ID; for local dev it should match the folder name)
    - `name`
    - `version` (Semantic Versioning `x.y.z`)
    - `minAppVersion`
    - `description`
    - `isDesktopOnly` (boolean)
    - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

### TypeScript Configuration

This project uses **super strict TypeScript configuration**. All code MUST respect the strict settings defined in `tsconfig.json`:

- ✅ `"strict": true` - All strict type checking options enabled
- ✅ `"noUnusedLocals": true` - No unused variables allowed
- ✅ `"noUnusedParameters": true` - No unused function parameters allowed
- ✅ `"noImplicitReturns": true` - All code paths must return a value
- ✅ `"noFallthroughCasesInSwitch": true` - No fallthrough in switch statements
- ✅ `"noUncheckedIndexedAccess": true` - Array/object access returns `T | undefined`
- ✅ `"noImplicitOverride": true` - Must use `override` keyword when overriding
- ✅ `"allowUnreachableCode": false` - No unreachable/dead code
- ✅ `"allowJs": false` - TypeScript only, no JavaScript files

**Always:**

- Check for null/undefined before accessing properties (use `if (!value) return` or optional chaining `value?.property`)
- Verify array/object access returns non-undefined before use (with `noUncheckedIndexedAccess`, `array[0]` returns `T | undefined`)
- Specify explicit return types for all functions
- Remove unused variables or prefix with `_` if intentionally unused
- Use `override` keyword when overriding parent class methods
- Ensure all switch statement cases are handled (no missing returns)
- Use `const` by default, `let` only when reassignment is needed, never `var`

**Common strict mode errors and fixes:**

```typescript
// 1. Missing override modifier (TS4114)
override async onload() { }  // ✓ Must use 'override' keyword

// 2. Uninitialized properties (TS2564)
settings!: PluginSettings;  // ✓ Use definite assignment if initialized in onload
settings: PluginSettings = DEFAULT_SETTINGS;  // ✓ Or initialize inline

// 3. Unchecked array access (noUncheckedIndexedAccess)
const first = array[0];
if (first) { /* use first */ }  // ✓ Must check, array[0] returns T | undefined

// 4. Missing return paths (TS7030)
function getValue(): string {
    if (condition) return 'yes';
    return 'no';  // ✓ All paths must return
}

// 5. Null checks (TS2531)
const file = this.app.workspace.getActiveFile();
if (!file) return;  // ✓ Check before use
```

### Tailwind CSS Guidelines

This project uses **Tailwind CSS v4** for styling. Follow these guidelines when working with styles:

**Always prefer Tailwind utilities over custom CSS:**

- Use Tailwind utility classes whenever possible instead of writing custom CSS
- Only use custom CSS when Obsidian CSS variables are required (e.g., `var(--text-accent)`, `var(--background-primary)`)
- Tailwind utilities can be applied via `@apply` directive in CSS files or directly as class names in TypeScript

**When to use @apply (in src/styles.src.css):**

- For component classes that will be reused across multiple elements
- When combining Tailwind utilities with Obsidian CSS variables
- For pseudo-selectors (`:hover`, `::after`, etc.) that need Tailwind utilities

**When to use inline classes (in TypeScript):**

- For one-off styling or element-specific layouts
- When building dynamic UI elements in TypeScript code
- For simple utility combinations that don't need a custom class

**Common Tailwind utilities to use:**

- **Layout**: `flex`, `grid`, `block`, `inline-flex`, `items-center`, `justify-center`, `gap-2`
- **Spacing**: `p-4`, `px-2`, `py-3`, `m-0`, `mt-2`, `mb-4`, `gap-2.5`
- **Sizing**: `w-full`, `h-4`, `min-w-[150px]`, `max-h-[400px]`
- **Typography**: `text-sm`, `text-[0.85em]`, `font-medium`, `italic`, `leading-tight`
- **Borders**: `border`, `rounded`, `border-b`
- **Colors**: Only use Obsidian CSS variables (Tailwind color utilities won't match theme)
- **Effects**: `opacity-80`, `transition-all`, `duration-150`, `cursor-pointer`
- **Display**: `hidden`, `block`, `invisible`

**Obsidian CSS variables (must use custom CSS, not Tailwind):**

- Colors: `var(--text-normal)`, `var(--text-muted)`, `var(--text-accent)`, `var(--text-error)`, `var(--text-on-accent)`
- Backgrounds: `var(--background-primary)`, `var(--background-secondary)`, `var(--background-primary-alt)`, `var(--background-modifier-hover)`, `var(--background-modifier-border)`
- Interactive: `var(--interactive-normal)`, `var(--interactive-hover)`, `var(--interactive-accent)`
- Sizing: `var(--input-height)`, `var(--icon-size)`, `var(--radius-s)`
- Typography: `var(--font-monospace)`

**Example: Good Tailwind usage**

```css
/* In src/styles.src.css - component with Tailwind + Obsidian vars */
.my-button {
    @apply flex items-center gap-2 px-3 py-2 rounded cursor-pointer;
    @apply transition-all duration-150 border;
    background-color: var(--interactive-normal);
    border-color: var(--background-modifier-border);
}

.my-button:hover {
    @apply opacity-100;
    background-color: var(--interactive-hover);
}
```

```typescript
// In TypeScript - inline Tailwind classes for simple layout
const container = contentEl.createDiv({ cls: 'flex flex-col gap-4 p-5' })
const button = container.createEl('button', {
    cls: 'px-4 py-2 rounded font-medium',
    text: 'Click me'
})
```

**Example: Bad practice**

```css
/* Don't use custom CSS for things Tailwind can do */
.my-container {
    display: flex; /* Use @apply flex instead */
    padding: 20px; /* Use @apply p-5 instead */
    margin-bottom: 10px; /* Use @apply mb-2.5 instead */
    border-radius: 4px; /* Use @apply rounded instead */
}
```

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**

- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**

- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):

```ts
import { Plugin } from 'obsidian'
import { MySettings, DEFAULT_SETTINGS } from './settings'
import { registerCommands } from './commands'

export default class MyPlugin extends Plugin {
    settings: MySettings

    async onload() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
        registerCommands(this)
    }
}
```

**settings.ts**:

```ts
export interface MySettings {
    enabled: boolean
    apiKey: string
}

export const DEFAULT_SETTINGS: MySettings = {
    enabled: true,
    apiKey: ''
}
```

**commands/index.ts**:

```ts
import { Plugin } from 'obsidian'
import { doSomething } from './my-command'

export function registerCommands(plugin: Plugin) {
    plugin.addCommand({
        id: 'do-something',
        name: 'Do something',
        callback: () => doSomething(plugin)
    })
}
```

### Add a command

```ts
this.addCommand({
    id: 'your-command-id',
    name: 'Do the thing',
    callback: () => this.doTheThing()
})
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(
    this.app.workspace.on('file-open', (f) => {
        /* ... */
    })
)
this.registerDomEvent(window, 'resize', () => {
    /* ... */
})
this.registerInterval(
    window.setInterval(() => {
        /* ... */
    }, 1000)
)
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Build issues: if `main.js` is missing, run `bun run build` or `bun run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin using Bun: https://github.com/rzbin/obsidian-plugin-template-bun
- API documentation: https://docs.obsidian.md
- Bun documentation: https://bun.com/docs
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
