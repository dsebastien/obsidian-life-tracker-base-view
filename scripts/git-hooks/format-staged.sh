#!/usr/bin/env bash
# Pre-commit hook: format staged files with Prettier and re-stage them.
# Invoked by Git 2.54+ config-based hooks via `.gitconfig` at the repo root.
# Replaces the previous husky + lint-staged setup.

set -euo pipefail

# Collect staged files (added, copied, modified, renamed), NUL-separated to
# survive whitespace in paths. Skip deletions.
mapfile -d '' -t staged_files < <(git diff --cached --name-only --diff-filter=ACMR -z)

if ((${#staged_files[@]} == 0)); then
    exit 0
fi

bunx prettier --write --ignore-unknown -- "${staged_files[@]}"
git add -- "${staged_files[@]}"
