## Why

The profiles extension must keep multiple Pi instances synchronized to the same user-selected model. Keeping a restored user selection in memory can become stale when another instance changes the selection while a route is active.

## What Changes

- Treat the extension-owned user selection file as the only source of truth for restoration.
- Read the user selection file fresh whenever a route restoration or session-start restoration is needed.
- Stop using long-lived in-memory user snapshots as the restoration source.
- Keep route activation and restoration events from writing routed models into the user selection file.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-model-routing`: Restoration MUST read the latest persisted user selection from disk at restoration time so concurrent Pi instances converge on the same user-selected model.

## Impact

- Affects `dotfiles/pi/agent/extensions/profiles/index.ts` and related tests.
- Keeps the existing `user-selection.json` persistence format.
- Does not modify Pi upstream APIs or Pi global settings directly.
