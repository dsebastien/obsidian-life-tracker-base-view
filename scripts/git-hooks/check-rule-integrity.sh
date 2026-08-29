#!/usr/bin/env bash
# Pre-commit hook: refuse a commit that loosens the rules instead of fixing the
# finding. Invoked by Git 2.54+ config-based hooks via `.gitconfig`.
#
# Two checks, because they fail in different ways:
#
#  1. Added lines in staged sources may not introduce a suppression (an
#     `eslint-disable`, a `@ts-*` escape, an `any`). Only ADDED lines are
#     scanned, so existing debt does not block unrelated work.
#  2. If a config file is staged, the RESOLVED config is compared against the
#     committed baseline. Grep cannot see a weakening buried in a preset swap
#     or an override block; `eslint --print-config` can.
#
# There is deliberately no flag to skip this. An exemption belongs in
# `eslint.config.ts`, scoped to the files that need it and carrying a written
# reason — that is reviewable, and the community catalog's own reviewer runs
# its ruleset over the archive regardless of what we switch off locally.

set -euo pipefail

fail() {
    echo "" >&2
    echo "  ✖ $1" >&2
    shift
    for line in "$@"; do
        echo "    $line" >&2
    done
    echo "" >&2
    exit 1
}

mapfile -d '' -t staged < <(git diff --cached --name-only --diff-filter=ACMR -z)
((${#staged[@]} == 0)) && exit 0

# ---------------------------------------------------------------------------
# 1. No new suppressions in staged sources.
# ---------------------------------------------------------------------------

sources=()
for f in "${staged[@]}"; do
    case "$f" in
        src/*.ts | src/*.tsx | scripts/*.ts) sources+=("$f") ;;
        *) ;;
    esac
done

if ((${#sources[@]} > 0)); then
    # `-U0` so only the changed lines are in the diff; `^+` minus `^+++` gives
    # the added lines.
    added=$(git diff --cached -U0 -- "${sources[@]}" | grep -E '^\+' | grep -Ev '^\+\+\+' || true)

    offences=$(printf '%s\n' "$added" | grep -nE \
        'eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error|\bas +any\b|\bas +unknown +as\b|:\s*any\b' \
        || true)

    if [[ -n "$offences" ]]; then
        fail "This commit adds a rule suppression." \
            "$offences" \
            "" \
            "Fix the finding instead. If the rule genuinely does not apply here," \
            "add a file-scoped override in eslint.config.ts with a written reason —" \
            "an inline disable of an obsidianmd rule is a hard FAILURE in the" \
            "community catalog review, not a warning."
    fi
fi

# ---------------------------------------------------------------------------
# 2. Config files may not weaken the resolved config.
# ---------------------------------------------------------------------------

config_staged=false
for f in "${staged[@]}"; do
    case "$f" in
        eslint.config.ts | tsconfig.json | package.json | .gitattributes | commitlint.config.ts)
            config_staged=true
            ;;
        *) ;;
    esac
done

if [[ "$config_staged" == true ]]; then
    echo "Config change staged — comparing the resolved rules against the baseline..."
    if ! bun scripts/rules-baseline.ts --check; then
        fail "The resolved lint/type configuration got weaker." \
            "" \
            "If the change is intended, regenerate the baseline in its own commit:" \
            "  bun run rules:baseline" \
            "so the loosening is visible in review rather than buried in a preset."
    fi
fi
