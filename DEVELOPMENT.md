# Development Guide

This guide explains how to build, run, and test the plugin locally.

## Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Git](https://git-scm.com/)
- An Obsidian vault for testing

## Setup

### Clone the Repository

```bash
git clone https://github.com/dsebastien/obsidian-life-tracker-base-view.git
cd obsidian-life-tracker-base-view
```

### Install Dependencies

```bash
bun install
```

### Configure Vault Location

Set the `OBSIDIAN_VAULT_LOCATION` environment variable to your vault path. The build script uses this to copy the plugin files directly to your vault for testing.

#### Windows (PowerShell)

```powershell
# Set temporarily for current session
$env:OBSIDIAN_VAULT_LOCATION="C:\Users\YourName\Documents\ObsidianVault"

# Set permanently for your user
[System.Environment]::SetEnvironmentVariable('OBSIDIAN_VAULT_LOCATION', 'C:\Users\YourName\Documents\ObsidianVault', 'User')
```

#### Linux

```bash
# Set temporarily for current session
export OBSIDIAN_VAULT_LOCATION="/home/yourname/Documents/ObsidianVault"

# Set permanently (add to ~/.bashrc or ~/.zshrc)
echo 'export OBSIDIAN_VAULT_LOCATION="/home/yourname/Documents/ObsidianVault"' >> ~/.bashrc
source ~/.bashrc
```

#### macOS

```bash
# Set temporarily for current session
export OBSIDIAN_VAULT_LOCATION="/Users/yourname/Documents/ObsidianVault"

# Set permanently (add to ~/.zshrc or ~/.bash_profile)
echo 'export OBSIDIAN_VAULT_LOCATION="/Users/yourname/Documents/ObsidianVault"' >> ~/.zshrc
source ~/.zshrc
```

## Development Workflow

### Start Development Mode

Run the development build with file watching:

```bash
bun run dev
```

This will:

- Compile TypeScript
- Bundle the plugin
- Build Tailwind CSS
- Copy files to your vault's plugin directory
- Watch for changes and rebuild automatically

### Type Checking

Run TypeScript type checking in watch mode:

```bash
bun run tsc:watch
```

Keep this running in a separate terminal to catch type errors as you code.

### Run Tests

```bash
bun test
```

Run tests in watch mode:

```bash
bun test --watch
```

### Linting and Formatting

```bash
bun run lint        # Check for lint errors
bun run lint:fix    # Auto-fix lint errors
bun run format      # Format code with Prettier
bun run format:check # Check formatting without changes
```

## Building for Production

```bash
bun run build
```

This creates optimized production files in the `dist/` directory:

- `main.js` - Bundled plugin code
- `manifest.json` - Plugin manifest
- `styles.css` - Compiled styles

## Testing in Obsidian

1. Ensure `OBSIDIAN_VAULT_LOCATION` is set correctly
2. Run `bun run dev` to build and copy files to your vault
3. Open Obsidian
4. Go to **Settings → Community plugins**
5. Disable Safe Mode if prompted
6. Find and enable the plugin
7. After making changes, Obsidian will automatically reload the plugin (or use **Ctrl/Cmd + R** to reload)

### Manual Installation

If you prefer not to use the environment variable, manually copy these files to `<YourVault>/.obsidian/plugins/obsidian-life-tracker-base-view-plugin/`:

- `dist/main.js`
- `dist/manifest.json`
- `dist/styles.css`

## Available Scripts

| Script                 | Description                       |
| ---------------------- | --------------------------------- |
| `bun run dev`          | Development build with watch mode |
| `bun run build`        | Production build                  |
| `bun run tsc`          | Type check                        |
| `bun run tsc:watch`    | Type check in watch mode          |
| `bun run lint`         | Run ESLint                        |
| `bun run lint:fix`     | Fix ESLint errors                 |
| `bun run format`       | Format with Prettier              |
| `bun run format:check` | Check formatting                  |
| `bun test`             | Run tests                         |
| `bun run commit`       | Create a commit with Commitizen   |

## Troubleshooting

### Plugin not appearing in Obsidian

- Verify `OBSIDIAN_VAULT_LOCATION` points to the correct vault
- Check that files exist in `<vault>/.obsidian/plugins/obsidian-life-tracker-base-view-plugin/`
- Restart Obsidian
- Ensure Community plugins are enabled

### Build errors

- Run `bun install` to ensure dependencies are up to date
- Check `bun run tsc` for TypeScript errors
- Check `bun run lint` for linting issues

### Changes not reflecting

- Use **Ctrl/Cmd + R** in Obsidian to reload
- Check the developer console (**Ctrl/Cmd + Shift + I**) for errors
