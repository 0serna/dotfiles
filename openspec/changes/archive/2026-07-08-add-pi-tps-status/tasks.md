## 1. Throughput Core

- [x] 1.1 Create a dedicated Pi `tps` extension module under `dotfiles/pi/agent/extensions/tps`.
- [x] 1.2 Implement compact throughput formatting as `<integer> tok/s` with integer rounding.
- [x] 1.3 Implement live stream state that starts timing at the first text, thinking, or tool-call delta.
- [x] 1.4 Estimate live output tokens from accumulated streamed deltas and publish at most once per second after the first full second of generation.
- [x] 1.5 Implement final throughput calculation from `message.usage.output` and elapsed time from first output delta to `message_end`.
- [x] 1.6 Preserve the previous final precise status when a stream ends without precise output usage.
- [x] 1.7 Clear live update resources on stream completion and `session_shutdown`.

## 2. Footer Integration

- [x] 2.1 Update the custom footer extension to treat `tps` as an explicitly ordered status immediately after model/thinking.
- [x] 2.2 Exclude `tps` from generic remaining extension statuses to prevent duplicate display.
- [x] 2.3 Ensure footer rendering remains compact and compatible with existing truncation behavior.

## 3. Tests

- [x] 3.1 Add unit tests for throughput formatting and integer rounding.
- [x] 3.2 Add unit tests for live stream start, one-second gating, and one-second update cadence.
- [x] 3.3 Add unit tests for final precise throughput calculation using provider output usage.
- [x] 3.4 Add unit tests for missing-usage behavior preserving the last final precise value.
- [x] 3.5 Add unit tests for footer ordering so `tps` appears immediately after model/thinking and not in remaining statuses.

## 4. Validation

- [x] 4.1 Run targeted Vitest tests for the new extension and footer ordering.
- [x] 4.2 Run `npm run check` and fix any reported issues without suppressions.
- [x] 4.3 Run `openspec validate add-pi-tps-status --strict` or the repository's equivalent OpenSpec validation command.
