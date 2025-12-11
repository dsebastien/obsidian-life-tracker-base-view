## Project Documentation

**MUST READ** before working on this codebase: `documentation/**/*.md` — system overview, architecture, components, directory structure, configuration, settings, ...

**MUST UPDATE** documentation when making changes. Keep it terse, accurate, no fluff.

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

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```
