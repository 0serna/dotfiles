#!/usr/bin/env bash
# Publishes the current local Pi agent settings to the repository.
#
# Since dotfiles/pi/agent/settings.json is marked with --skip-worktree
# to avoid git tracking day-to-day changes, this script:
#   1. Temporarily removes the skip-worktree flag
#   2. Stages and commits the current version
#   3. Re-applies skip-worktree so future changes stay invisible

set -euo pipefail

FILE="dotfiles/pi/agent/settings.json"
MESSAGE="chore(pi): update agent settings"

cd "$(git rev-parse --show-toplevel)"

# Remove skip-worktree flag (no-op if not set)
git update-index --no-skip-worktree "$FILE"

git add "$FILE"
git commit -m "$MESSAGE" -- "$FILE"

# Re-apply skip-worktree
git update-index --skip-worktree "$FILE"

echo "✅ Published $FILE"
