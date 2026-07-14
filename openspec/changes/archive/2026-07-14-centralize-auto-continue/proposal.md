## Why

Automatic recovery from transient assistant failures is currently embedded in the quota extension and restricted to OpenCode Go, so Codex transport and server failures can terminate a session without recovery. Quota exhaustion rotation and provider-agnostic continuation recovery are separate responsibilities and need distinct policies and retry budgets.

## What Changes

- Add an `auto-continue` Pi extension as the sole owner of automatic `continue` messages.
- Classify terminal transient failures conservatively across all providers and issue at most one recovery continuation per recovery episode.
- Delay transient recovery by one second after `agent_settled`, then cancel it if the runtime is no longer quiet.
- Accept typed continuation requests from other extensions, coalesce concurrent requests, and dispatch quota-rotation requests immediately.
- Change the quota extension to rotate accounts and request continuation without directly sending user messages or handling transient failures.
- Keep transient recovery state session-runtime-local and add structured, non-notifying recovery logs.
- Record the ownership boundary and the deliberate best-effort delay in an ADR.

## Capabilities

### New Capabilities

- `pi-auto-continue`: Provider-agnostic transient failure classification, bounded recovery episodes, typed continuation requests, dispatch policy, cancellation, and observability.

### Modified Capabilities

- `quota-rotation-guard`: Remove transient stream recovery from the quota domain and delegate post-rotation continuation dispatch to `auto-continue`.

## Impact

- Adds `dotfiles/pi/agent/extensions/auto-continue/` and focused Vitest coverage.
- Changes `dotfiles/pi/agent/extensions/quota/` message-end orchestration and tests while preserving account rotation and notifications.
- Introduces an internal typed event contract between Pi extensions; no external dependency or persistent state is added.
- Updates `CONTEXT.md`, living OpenSpec requirements, and adds an ADR under `docs/adr/`.
