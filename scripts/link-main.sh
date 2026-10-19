#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
common_dir=$(git -C "$script_dir" rev-parse --path-format=absolute --git-common-dir)
main_dir=$(dirname -- "$common_dir")

cd "$main_dir"

if [ ! -x ./node_modules/.bin/tsx ]; then
  echo "Missing tsx in $main_dir. Run 'npm install' there first." >&2
  exit 1
fi

exec ./node_modules/.bin/tsx src/installer/dotfiles-installer.ts
