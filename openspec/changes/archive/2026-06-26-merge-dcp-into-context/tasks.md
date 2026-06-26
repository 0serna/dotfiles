## 1. Context Baseline Tests

- [x] 1.1 Add pure-function tests for existing context formatting behavior, including context token formatting, cache hit formatting, cache unavailable reasons, and cache threshold handling.
- [x] 1.2 Run the context baseline tests before moving DCP runtime logic and confirm they pass.

## 2. Move DCP Code into Context

- [x] 2.1 Move DCP pure modules from `dotfiles/pi/agent/extensions/dcp/` into flat modules under `dotfiles/pi/agent/extensions/context/`.
- [x] 2.2 Update DCP module imports and pruning tests to use the new context module paths.
- [x] 2.3 Remove the standalone `dotfiles/pi/agent/extensions/dcp/` runtime extension after its behavior is registered by `context`.

## 3. Integrate Runtime Behavior

- [x] 3.1 Register the Pi `context` event handler from the `context` extension and run pruning automatically during context construction.
- [x] 3.2 Reset context sequence and latest DCP metrics on `session_start`.
- [x] 3.3 Keep pruning fail-open and log `context_prune_error` through the context logger when unexpected pruning errors occur.
- [x] 3.4 Keep DCP non-interactive by avoiding tools, commands, prompt additions, nudges, and model-facing affordances.

## 4. Status and Logging Correlation

- [x] 4.1 Add latest-DCP metrics state with context sequence, stubbed count, estimated saved tokens, and reason counts.
- [x] 4.2 Update context status rendering to use the order `ctx <tokens> saved <Xk> cache <percent>`.
- [x] 4.3 Format saved tokens as integer k-format values such as `0k`, `1k`, and `12k`, and render the saved segment with dim color.
- [x] 4.4 Emit `context_pruned` entries to `context.log` without full tool output content.
- [x] 4.5 Include `lastDcp` in `cache_status` log payloads, including zero metrics before the first pruning pass.

## 5. Verification

- [x] 5.1 Run the migrated DCP pruning tests and context formatting tests.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Run `npm run check` and fix any reported issues.
- [x] 5.4 Confirm OpenSpec validation passes for `merge-dcp-into-context`.
