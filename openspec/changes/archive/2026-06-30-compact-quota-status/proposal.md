## Why

The combined quota footer has become too wide because it always shows every quota window and balance segment, even when longer windows are healthy and not actionable. A more compact format will keep the actionable quota signal visible while reducing footer noise.

## What Changes

- Display Codex before OpenCode in the combined quota status.
- Use provider labels `Codex` and `OpenCode` in normal and error states.
- Represent quota windows with normalized labels and explicit percent/reset grouping: `R(<percent>% <reset>)`, `W(<percent>% <reset>)`, and `M(<percent>% <reset>)`.
- Always show the primary rolling/short window when available.
- Show longer windows only when their remaining quota is below the low-quota threshold.
- If the primary window is unavailable, show the first available window instead of treating the provider as failed.
- Show Codex remaining credits and OpenCode dollar balance only when they are actively being consumed.
- Show Codex banked reset credits as `R<n>` only when a Codex window is below the low-quota threshold, including explicit `R0` when reported.
- Preserve provider isolation and compact error indicators as `Codex error` and `OpenCode error`.

## Capabilities

### New Capabilities

### Modified Capabilities

- `pi-codex-usage-footer`: Updates the combined quota footer formatting, ordering, window visibility rules, provider labels, and conditional balance/reset-credit display behavior.

## Impact

- Affects the Pi quota extension status formatter in `dotfiles/pi/agent/extensions/quota/`.
- Affects quota formatter tests in `dotfiles/pi/agent/extensions/quota/tests/`.
- No new external dependencies or API changes are expected.
