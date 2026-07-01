#!/usr/bin/env bash
# Agent-readable quality check template.
# Replace the example tool runs with the repository's confirmed commands.

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

run_tool example-tool example-command --example-flag
EXAMPLE_TOOL_EXIT=$?

echo "---CHECK:SUMMARY---"
echo "example-tool: $(status $EXAMPLE_TOOL_EXIT)"
echo "---CHECK:DONE---"

exit $((EXAMPLE_TOOL_EXIT))
