## Why

The Pi footer now exposes token and cache metrics that are easy to misread without an explicit contract. We need durable specs so future changes preserve the agreed meaning of context-window usage and cache-hit reporting.

## What Changes

- Add a new spec for Pi footer token metrics.
- Define that footer context usage represents current context-window occupancy for the active session state, not cumulative session token totals.
- Define that footer cache percentage represents cumulative prompt-side cache reuse from assistant usage records.
- Document when context usage or cache percentage may be unknown.

## Capabilities

### New Capabilities

- `pi-footer-token-metrics`: Specifies the meaning and display contract for Pi footer context-window and cache metrics.

### Modified Capabilities

- None.

## Impact

- Affects the managed Pi footer extension under `dotfiles/pi/agent/extensions/footer.ts`.
- Aligns repository behavior with Pi's documented `contextUsage` semantics.
- Adds OpenSpec coverage for future footer changes without changing runtime behavior now.
