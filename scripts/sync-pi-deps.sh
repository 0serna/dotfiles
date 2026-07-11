#!/usr/bin/env bash
# Sync repo pi dependencies to match the running pi version.
#
# Usage:
#   bash scripts/sync-pi-deps.sh
#
# Detects the system pi version from the globally installed pi-coding-agent
# and updates package.json + runs npm install when versions differ.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)" 2>/dev/null || {
  echo "Error: not inside a git repository" >&2
  exit 1
}

# ── helpers ──────────────────────────────────────────────────────────────────

find_pi_pkg_dir() {
  local pi_exe
  pi_exe="$(command -v pi 2>/dev/null)" || return 1
  local resolved
  resolved="$(readlink -f "$pi_exe" 2>/dev/null || realpath "$pi_exe" 2>/dev/null || echo "$pi_exe")"

  # pi is usually <fnm_multishell>/bin/pi → symlink to
  # <fnm_dir>/node-versions/<ver>/installation/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js
  if [[ "$resolved" == */dist/cli.js ]]; then
    echo "${resolved%/dist/cli.js}"
    return 0
  fi

  # Fallback: search fnm node versions
  local fnm_dir="${FNM_DIR:-$HOME/.local/share/fnm}"
  for d in "$fnm_dir"/node-versions/*/installation/lib/node_modules/@earendil-works/pi-coding-agent; do
    if [ -f "$d/package.json" ]; then
      echo "$d"
      return 0
    fi
  done
  return 1
}

system_pi_version() {
  local pkg_dir
  pkg_dir="$(find_pi_pkg_dir)" || {
    echo "Error: could not locate the running pi installation" >&2
    exit 1
  }
  node -p "require('$pkg_dir/package.json').version"
}

repo_pi_version() {
  node -p "require('./node_modules/@earendil-works/pi-coding-agent/package.json').version" 2>/dev/null || echo "none"
}

# ── main ─────────────────────────────────────────────────────────────────────

SYSTEM_VERSION="$(system_pi_version)"
REPO_VERSION="$(repo_pi_version)"

if [ "$SYSTEM_VERSION" = "$REPO_VERSION" ]; then
  echo "✅ Pi dependencies are up to date (v$REPO_VERSION)."
  exit 0
fi

echo "⬆️  Updating pi dependencies from v$REPO_VERSION → v$SYSTEM_VERSION ..."
npm install --save-dev \
  "@earendil-works/pi-ai@^$SYSTEM_VERSION" \
  "@earendil-works/pi-coding-agent@^$SYSTEM_VERSION" \
  "@earendil-works/pi-tui@^$SYSTEM_VERSION"

echo "✅ Pi dependencies synced to v$SYSTEM_VERSION."
