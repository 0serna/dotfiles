## Why

DCP now externalizes pruned tool outputs, but when Pi has already truncated a `bash` output and saved the full content to a temp file, DCP currently creates a second file that only contains the truncated context text. This adds an unnecessary recovery hop and can point the agent at less useful content than Pi's original full output.

## What Changes

- Detect existing Pi bash `Full output: <path>` markers before DCP externalizes a pruned bash result.
- When the referenced `/tmp/pi-bash-*.log` path exists and is readable, use that path directly in the DCP stub's `saved=` field instead of creating a new DCP copy.
- Keep DCP-owned externalized files as `.txt` with private permissions when no reusable full-output path is available.
- Do not change permissions on files created by Pi or other tools.
- Treat `saved=` as the best available recovery path, not necessarily a byte-for-byte copy of the exact text replaced by DCP.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-dcp-lite-context-pruning`: DCP pruning should prefer an existing Pi bash full-output recovery path from a pruned bash result when one is available.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/context/prune.ts` and related context pruning tests.
- Affected behavior: DCP stubs may point directly to an existing Pi full-output file such as `/tmp/pi-bash-*.log`.
- No new runtime dependencies or user-facing commands.
