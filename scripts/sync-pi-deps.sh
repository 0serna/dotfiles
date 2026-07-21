#!/usr/bin/env bash
# Sync repo pi dependencies to match the running pi version.
#
# Usage:
#   bash scripts/sync-pi-deps.sh
#
# Detects the system pi version from the globally installed pi-coding-agent
# and updates package.json + runs npm install when versions differ.
#
# Synced packages are the core pi packages listed in pi's packages.md:
#   @earendil-works/pi-ai
#   @earendil-works/pi-agent-core
#   @earendil-works/pi-coding-agent
#   @earendil-works/pi-tui
#   typebox
#
# The first four share pi's version. typebox uses its own version, read from
# pi-coding-agent's dependency tree.

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

repo_pkg_version() {
  local pkg="$1"
  node -p "require('./node_modules/$pkg/package.json').version" 2>/dev/null || echo "none"
}

# ── main ─────────────────────────────────────────────────────────────────────

PI_PKG_DIR="$(find_pi_pkg_dir)" || exit 1

SYSTEM_VERSION="$(node -p "require('$PI_PKG_DIR/package.json').version")"

# Read typebox version from pi's own dependency tree.
TYPEBOX_VERSION="$(node -p "require('$PI_PKG_DIR/node_modules/typebox/package.json').version" 2>/dev/null || echo "")"

# Core pi packages that track pi's own version.
PI_VERSIONED_PACKAGES=(
  "@earendil-works/pi-ai"
  "@earendil-works/pi-agent-core"
  "@earendil-works/pi-coding-agent"
  "@earendil-works/pi-tui"
)

# Check if any package is missing or outdated.
NEEDS_SYNC=false
for pkg in "${PI_VERSIONED_PACKAGES[@]}"; do
  installed="$(repo_pkg_version "$pkg")"
  if [ "$installed" != "$SYSTEM_VERSION" ]; then
    NEEDS_SYNC=true
    break
  fi
done

if [ -n "$TYPEBOX_VERSION" ]; then
  installed_typebox="$(repo_pkg_version "typebox")"
  if [ "$installed_typebox" != "$TYPEBOX_VERSION" ]; then
    NEEDS_SYNC=true
  fi
fi

if [ "$NEEDS_SYNC" = false ]; then
  echo "✅ Pi dependencies are up to date (v$SYSTEM_VERSION)."
  exit 0
fi

echo "⬆️  Updating pi dependencies to v$SYSTEM_VERSION ..."

PACKAGES=()
for pkg in "${PI_VERSIONED_PACKAGES[@]}"; do
  PACKAGES+=("$pkg@^$SYSTEM_VERSION")
done

if [ -n "$TYPEBOX_VERSION" ]; then
  PACKAGES+=("typebox@$TYPEBOX_VERSION")
fi

npm install --save-dev "${PACKAGES[@]}"

echo "✅ Pi dependencies synced to v$SYSTEM_VERSION."
