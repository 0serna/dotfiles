## Why

Pi's interactive footer does not expose how long the last agent run took, making it harder to notice slow prompts or compare provider/model responsiveness during normal use.

## What Changes

- Add a standalone Pi extension named `duration` under the managed Pi extensions tree.
- Publish a compact footer status while the agent is running, updated once per second.
- Publish the last completed agent duration after `agent_end`.
- Infer the most recent duration from persisted session message timestamps when a session starts or the extension reloads.

## Capabilities

### New Capabilities

- `pi-agent-duration-footer`: Covers measuring, inferring, and publishing agent duration status for the Pi footer.

### Modified Capabilities

## Impact

- Affected code: `dotfiles/pi/agent/extensions/duration` and tests for the new extension behavior.
- Affected systems: Pi extension runtime events (`agent_start`, `agent_end`, `session_start`, `session_shutdown`) and footer status aggregation via `ctx.ui.setStatus`.
- No breaking changes, new dependencies, or changes to the existing footer extension's responsibility.
