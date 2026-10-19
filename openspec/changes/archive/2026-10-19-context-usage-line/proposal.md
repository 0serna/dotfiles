# Proposal

## Why

T3 Code renders assistant text only, so the native context meters in Pi and OpenCode are invisible there. The user needs the current context usage after each turn to decide when to compact. A fixed auto-compaction threshold hides that decision and adds no value on 1M-token windows.

## What Changes

- Add a shared instruction in `dotfiles/AGENTS.md`: when a request ends with a `status: <tokens>` note, end the final answer of the turn with a single `context: <n>k` line, rounded to thousands. The line appears only in the final answer, never in intermediate messages, tool-call turns, or failed turns.
- Add a Pi personal extension that appends the request-local `status: <tokens>` note to primary model requests, reading `ctx.getContextUsage()`, and skips the note during compaction.
- Add an OpenCode V2 plugin that appends the same note using the token total of the last completed assistant step in the session context.
- Link the Pi extension with a file-level manifest entry and the OpenCode plugin with its own directory entry, then update the installer tests that pin the current Pi target list.
- Leave the native automatic compaction settings of both agents unchanged.

## Capabilities

### New Capabilities

- `context-report`: a model-visible, per-turn context usage line produced by shared instructions plus request-local notes from each harness.

### Modified Capabilities

- `pi-config`: personal extensions may now be installed through explicit file-level links; the initial "no executable extension" constraint is replaced by a rule that only declared extensions are linked.

## Impact

- `dotfiles/AGENTS.md` (shared by Pi, OpenCode, and Codex).
- `dotfiles/pi/extensions/context-report.ts` and its `dotfiles.json` link.
- `dotfiles/opencode/plugins/context-report/` with its own `package.json`.
- `src/installer/dotfiles-installer.test.ts` (Pi manifest and extension-directory assertions).
- `src/opencode/` tests for the new plugin.
