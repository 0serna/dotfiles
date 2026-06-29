## 1. DCP Thresholds and Decision Filtering

- [x] 1.1 Update DCP constants/types so the global pruning token threshold is 1000 and the `stale_large` age gate is 30.
- [x] 1.2 Apply the 1000-token threshold to `duplicate`, `resolved`, `superseded`, and `stale_large` decisions.
- [x] 1.3 Filter out pruning decisions whose replacement stub would not reduce estimated token count.
- [x] 1.4 Update pruning metrics so only applied pruning decisions contribute to `stubbedCount`, reason counts, targets, and estimated saved tokens.

## 2. Recoverable Externalized Outputs

- [x] 2.1 Add a small DCP output writer that stores pruned original text under a per-session temporary directory.
- [x] 2.2 Pass the session id or a stable fallback identifier into pruning options so file paths are grouped per session.
- [x] 2.3 Replace applied pruned content with a minimal stub containing the pruning reason and saved file path.
- [x] 2.4 Ensure externalization failures fail open by preserving the original tool result or otherwise avoiding context-breaking errors.

## 3. Cache Status Logging

- [x] 3.1 Change context extension lifecycle handling so `cache_status` is logged on `turn_end` only.
- [x] 3.2 Preserve status-bar publishing on lifecycle events where needed without writing duplicate `cache_status` entries on `agent_end`.

## 4. Tests and Documentation

- [x] 4.1 Update pruning tests for the 1000-token global threshold and 30-result `stale_large` age gate.
- [x] 4.2 Add tests that externalized stubs include a saved path and that the saved file contains the original output.
- [x] 4.3 Add tests that below-threshold duplicate/resolved/superseded candidates are preserved.
- [x] 4.4 Add tests that non-saving stubs are not applied or counted.
- [x] 4.5 Update cache status tests to verify `turn_end` logging without duplicate `agent_end` logging.
- [x] 4.6 Update `dotfiles/pi/agent/extensions/context/pruning-matrix.md` to reflect the global threshold and `stale_large` age gate.

## 5. Validation

- [x] 5.1 Run the targeted Vitest tests for the context extension.
- [x] 5.2 Run `npm run check` and fix any reported issues.
- [x] 5.3 Run OpenSpec validation for `improve-context-dcp-externalization`.
