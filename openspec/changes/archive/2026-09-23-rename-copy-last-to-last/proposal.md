# Proposal

## Why

Typing `/copy` shows two similar entries: the built-in `/copy` (full session transcript) and our `/copy-last` (latest assistant response). The prefix overlap causes friction and misfires. A short distinct name removes the collision without changing behavior.

## What Changes

- Rename the global TUI slash command from `/copy-last` to `/last`.
- Keep the same behavior: copy the latest completed, user-visible assistant response as plain text, with the same success/error toasts.
- **BREAKING**: `/copy-last` stops working; `/last` is the only name.
- Update the `copy-last-command` spec requirements and scenarios to reference `/last`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `copy-last-command`: requirement changes from exposing `/copy-last` to exposing `/last`; scenarios updated accordingly. No behavior change beyond the slash name.

## Impact

- Affected code: `dotfiles/opencode/plugins/copy-last/tui.tsx` (slash registration), command id/title if renamed for consistency.
- Tests: `src/opencode/copy-last-*.test.ts` cover answer/plain-text/clipboard logic, unaffected by the slash name; no new logic expected.
- Docs/specs: `openspec/specs/copy-last-command/spec.md` synced with the delta after archive.
- No ADR: rename only, no architecture decision. No glossary file exists in the repo.
