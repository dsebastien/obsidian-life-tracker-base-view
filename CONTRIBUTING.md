# Contributing

Thank you for your interest in contributing to this project!

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Git](https://git-scm.com/)

### Fork and Clone

1. Fork this repository by clicking the "Fork" button on GitHub
2. Clone your fork locally:
    ```bash
    git clone https://github.com/YOUR_USERNAME/obsidian-life-tracker-base-view.git
    cd obsidian-life-tracker-base-view
    ```
3. Add the upstream repository as a remote:
    ```bash
    git remote add upstream https://github.com/dsebastien/obsidian-life-tracker-base-view.git
    ```

### Install Dependencies

```bash
bun install
```

## Git hooks (Git 2.54+)

This repo uses [Git's built-in config-based hooks](https://github.blog/open-source/git/highlights-from-git-2-54/) (introduced in **Git 2.54**) instead of Husky + `lint-staged`. The hook definitions live in a tracked `.gitconfig` file at the repo root and are committed to source control.

### Enable the hooks once per clone

After the first `bun install`, run:

```bash
bun run setup
```

That script runs `git config --local --replace-all include.path ../.gitconfig` — the path is relative to `.git/`, so `../.gitconfig` resolves to the repo root. Git then reads the tracked `.gitconfig`, picking up:

- **`pre-commit` → `scripts/git-hooks/format-staged.sh`** — runs Prettier over the staged files and re-stages them.
- **`commit-msg` → `bunx commitlint --edit`** — validates the commit message against `commitlint.config.ts`.

Confirm the hooks are wired up:

```bash
git hook list pre-commit
git hook list commit-msg
```

### Requirements

- Git **≥ 2.54** is required for config-based hooks. Older Git versions silently ignore them, so the hooks won't run (but nothing will break).

### Why not Husky?

Husky + `lint-staged` together pull in ~80 transitive deps and require a `prepare` post-install script to inject shims into `.git/hooks/`. Git 2.54 provides the same functionality natively, the hook config is plain text in version control, and there's no install-time magic.

## Development Workflow

### Create a Branch

Create a new branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:

- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `refactor/` for code refactoring

### Development

Start the TypeScript watch process:

```bash
bun run tsc:watch
```

Optionally, run tests in watch mode:

```bash
bun test --watch
```

### Code Quality

Before committing, ensure your code passes all checks:

```bash
bun run format      # Format code
bun run lint        # Check for lint errors
bun run tsc         # Type check
bun test            # Run tests
```

### Commit Your Changes

Write clear, concise commit messages following [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git add .
git commit -m "feat: add new feature description"
```

Common prefixes:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

### Keep Your Fork Updated

Before creating a pull request, sync your fork with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

Resolve any conflicts if necessary.

### Push Your Changes

```bash
git push origin feature/your-feature-name
```

## Creating a Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Ensure the base repository is `dsebastien/obsidian-life-tracker-base-view` and base branch is `main`
4. Fill in the PR template:
    - Provide a clear title
    - Describe what changes you made and why
    - Reference any related issues (e.g., "Fixes #123")
5. Submit the pull request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Ensure all CI checks pass
- Update documentation if needed
- Add tests for new functionality
- Be responsive to feedback and review comments

## Code Style

This project uses:

- **ESLint** for linting
- **Prettier** for formatting
- **TypeScript** with strict mode enabled

The CI pipeline enforces these standards. Run `bun run format` and `bun run lint` before committing.

## Questions?

If you have questions, feel free to open an issue for discussion.
