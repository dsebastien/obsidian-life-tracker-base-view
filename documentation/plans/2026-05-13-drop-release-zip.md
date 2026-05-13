# Drop the release zip from GitHub Releases

## Why

The Obsidian community scorecard flags the GitHub Release with a "release contains additional files" warning because the workflow attaches `dist/life-tracker.zip` alongside the three spec assets. The community catalog only consumes `main.js`, `manifest.json`, and `styles.css` — the zip adds no value and lowers the scorecard.

## What to change

### 1. `.github/workflows/release.yml`

Three small edits in this file.

- Delete the **"Create release zip"** step:

    ```yaml
    - name: Create release zip
      run: bun run release:zip
    ```

- Delete the **"Get package name"** step (only consumed by the zip line):

    ```yaml
    - name: Get package name
      id: package
      run: |
          NAME=$(jq -r .name package.json)
          echo "name=$NAME" >> $GITHUB_OUTPUT
    ```

- Remove the zip line from the `softprops/action-gh-release` `files:` block:

    ```yaml
    files: |
        dist/${{ steps.package.outputs.name }}.zip   # <- delete this line
        dist/main.js
        dist/manifest.json
        dist/styles.css
    ```

### 2. `package.json`

Remove the now-unused `release:zip` npm script:

```json
"release:zip": "bun scripts/create-release-zip.ts",
```

### 3. Source tree

Delete the now-dead Bun script and its test:

```bash
rm scripts/create-release-zip.ts scripts/create-release-zip.spec.ts
```

### 4. (Optional) `README.md` / `docs/`

The "Manual installation" section, if present, already references the three spec files individually — no edit needed unless it explicitly mentions the zip.

## Verification

- `bun run tsc` and `bun run lint` still green.
- Workflow YAML parses cleanly:
    ```bash
    bun -e 'import yaml from "yaml"; const p = yaml.parse(require("fs").readFileSync(".github/workflows/release.yml", "utf-8")); const step = p.jobs.release.steps.find(s => s.uses?.startsWith("softprops/action-gh-release")); console.log(step.with.files.trim());'
    ```
- Trigger the workflow (workflow_dispatch) and confirm the new GitHub Release lists exactly **three** assets.
- Re-check the [scorecard](https://community.obsidian.md/plugins/life-tracker) after publishing — the "release contains additional files" warning should be gone.

## Reference

This is the same change already applied to `obsidian-update-time`, `obsidian-dataview-serializer`, `obsidian-typefully`, and `obsidian-replicate` on 2026-05-13. See the `scorecard-cleanup` history entries in those repos for the exact diffs.
