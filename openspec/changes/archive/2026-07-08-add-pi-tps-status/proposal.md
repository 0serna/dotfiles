## Why

Pi currently shows context, cache, quota, model, and elapsed work indicators, but it does not show how fast the active model is generating output. A compact output throughput indicator helps compare perceived model speed without conflating generation speed with request latency or tool execution time.

## What Changes

- Add a dedicated Pi extension that publishes assistant output throughput as a compact footer status.
- Show a medium-precision live throughput estimate while an assistant stream is actively generating.
- Replace the live estimate with a high-precision final throughput when the assistant stream closes and provider output usage is available.
- Keep the displayed format minimal as `<integer> tok/s` for both live and final values.
- Adjust the custom footer ordering so the throughput status appears immediately after the model/thinking section.
- No breaking changes.

## Capabilities

### New Capabilities

- `pi-assistant-throughput-footer`: Display live and final assistant output throughput in the Pi footer.

### Modified Capabilities

## Impact

- Affected code: Pi agent extensions under `dotfiles/pi/agent/extensions`, especially the custom footer extension.
- Affected UI: Pi TUI footer status ordering and one new compact status segment.
- Dependencies: no new runtime dependency is expected; the implementation can use Pi's existing streaming events, usage data, and token-estimation utilities.
- Tests: add or update Vitest coverage for throughput formatting, state transitions, and footer ordering.
