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
