# Proposal

## Why

OpenCode has a keybinding for copying a message, but this project needs a direct slash command for copying the latest final assistant response from the active session. The command should make the answer reusable without sending another request to the model or manually selecting transcript text.

## What Changes

- Add a globally available local OpenCode CLI plugin that registers `/copy-last`.
- Copy the latest completed, user-visible assistant response from the active session, excluding reasoning, tool activity, intermediate messages, and child-session output.
- Normalize common Markdown into readable plain text and copy it through the terminal clipboard path, with feedback for success and failure cases.

## Capabilities

### New Capabilities
- `copy-last-command`: Copy the latest final assistant response from the active session to the clipboard.

### Modified Capabilities

## Impact

- `dotfiles/opencode/plugins/copy-last/`
- `tsconfig.json` includes the global plugins directory in type checking
- OpenCode V2 CLI plugin command registration, session-message lookup, and OSC 52 clipboard output
- No additional npm dependency is planned
