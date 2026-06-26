## Context

The repository currently has two Pi extensions that act on context-related data:

- `context` computes current context usage, cache-hit display text, status colors, and cache status logs.
- `dcp` listens to the Pi `context` event and prunes stale tool results from the transient message list before a model request.

Both extensions use the shared logger, but they write to separate log files. This makes it harder to inspect whether a specific pruning event affected the next cache-hit outcome. The agreed target is a single context extension that owns context pruning, context usage display, cache display, and their correlated logs.

## Goals / Non-Goals

**Goals:**

- Make `context` the only runtime extension for context usage, cache monitoring, and DCP pruning.
- Preserve DCP pruning behavior: automatic, non-destructive, fail-open, no model-facing tools or prompts.
- Move pruning implementation into flat modules under `dotfiles/pi/agent/extensions/context/`.
- Add `saved Xk` to the context status, using the latest DCP pruning metrics.
- Log pruning and cache status events to `context.log` and include `lastDcp` in cache status logs.
- Add pure-function baseline tests for existing context formatting/computation before migration.

**Non-Goals:**

- Changing the DCP pruning heuristics or thresholds.
- Adding user commands, tools, prompts, or user-facing notifications for DCP.
- Making `saved` cumulative across the session.
- Introducing new dependencies or a persistent metrics store.
- Keeping a standalone `dcp` extension wrapper after migration.

## Decisions

1. **Use one runtime extension named `context`.**

   DCP behavior will be registered by `context/index.ts` alongside existing status lifecycle handlers. This directly aligns log ownership with the domain being observed. The rejected alternative was to keep two extensions and only point DCP at `context.log`; that would improve logs but leave ownership split.

2. **Keep pruning code modular but flat under `context/`.**

   Files such as `prune.ts`, `metadata.ts`, `content.ts`, and `types.ts` keep parsing and pruning logic isolated from status UI code without preserving a nested DCP extension identity. The rejected alternative was to inline pruning into `index.ts` or `status.ts`, which would make tests and review harder.

3. **Track latest DCP metrics in memory.**

   The context extension will maintain the latest prune metrics for the active session. The status bar uses that latest event to render `saved Xk`, and cache logs include the same object as `lastDcp`. This avoids fragile timestamp joins while keeping scope process-local and simple.

4. **Display latest savings, not accumulated savings.**

   The status format is `ctx <tokens> saved <Xk> cache <percent>`. `saved` always appears, uses integer k-format (`0k`, `1k`, `12k`), and is dim-colored. A latest-event value better matches the next model request and cache result than a session total.

5. **Fail open and log pruning errors.**

   If pruning throws, the original messages are returned unchanged and `context_prune_error` is logged. This preserves model-request safety while surfacing defects that were previously silent.

6. **Test pure context computations before migration.**

   Baseline tests will cover pure formatting/computation behavior in the context extension before moving DCP runtime behavior. Runtime integration tests can be updated with the migration, but the pre-migration baseline remains intentionally limited.

## Risks / Trade-offs

- **External references to `dcp` break** → The standalone `dcp` extension is removed intentionally; no repo-local settings reference it today.
- **Status can show `saved 0k` often** → This is accepted to keep a stable `ctx saved cache` layout.
- **Estimated saved tokens are approximate** → The existing DCP token estimate remains sufficient for relative diagnostics and is not presented as provider-billed truth.
- **In-memory latest metrics reset on session start/process restart** → This matches status/log correlation needs and avoids unnecessary persistence.
- **Baseline tests do not cover handlers before migration** → This is accepted because the baseline scope is pure functions only.
