#!/usr/bin/env bash
# check.sh — Quality gate for dotfiles repo, designed for agent consumption.
#
# Runs all tools regardless of individual failures. On success the tool
# block is suppressed; only failures emit their delimited output. The
# summary always shows all results and the exit code is 0 only when every
# tool passes.

PATH="$(cd "$(dirname "$0")/.." && pwd)/node_modules/.bin:$PATH"

run_tool() {
  local name=$1
  shift
  local output exit_code
  output=$("$@" 2>&1)
  exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "---CHECK:${name}---"
    echo "$output"
    echo ""
  fi
  return $exit_code
}

status() { [ $1 -eq 0 ] && echo PASS || echo FAIL; }

run_tool vitest vitest run
VITEST_EXIT=$?
run_tool eslint eslint . --format json
ESLINT_EXIT=$?
run_tool tsc tsc --noEmit
TSC_EXIT=$?
run_tool openspec openspec validate --all --json
OPENSPEC_EXIT=$?

echo "---CHECK:SUMMARY---"
echo "vitest: $(status $VITEST_EXIT)"
echo "eslint: $(status $ESLINT_EXIT)"
echo "tsc: $(status $TSC_EXIT)"
echo "openspec: $(status $OPENSPEC_EXIT)"

exit $((VITEST_EXIT || ESLINT_EXIT || TSC_EXIT || OPENSPEC_EXIT))
