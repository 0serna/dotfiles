## Context

The current RTK Pi extension (`dotfiles/pi/agent/extensions/rtk/index.ts`) was built before the upstream RTK project published their official Pi hook (`rtk-ai/rtk hooks/pi/rtk.ts`). The local extension diverges in three architectural choices: (1) it overrides the built-in bash tool via `createBashTool`, (2) it handles `user_bash` events, and (3) it uses synchronous `spawnSync` instead of Pi's async `pi.exec`.

After analyzing both codebases alongside the third-party `pi-rtk` package, the decision was to align with the upstream's thin-delegate philosophy: hook `tool_call` only, mutate the command in-place, and let the built-in bash tool handle execution.

## Goals / Non-Goals

**Goals:**

- Match upstream RTK Pi extension architecture (hook-only, no tool override)
- Switch to async `pi.exec` with `ctx.signal` support
- Add availability gating, disable mechanism, recursion guard, input validation, and error handling
- Keep the extension as a single-file thin delegate — all rewrite logic lives in `rtk rewrite`

**Non-Goals:**

- `user_bash` event handling (removed — matches upstream's deliberate omission)
- Bash tool override with custom `BashOperations`
- CLI flags (`--rtk-disable`, `--rtk-binary`) — env var only
- Configurable binary path — only `rtk` from `PATH`
- Observable rewrite metrics or savings reporting
- Support for other Pi tools (`read`, `grep`, `find`, `ls`)

## Decisions

### Hook-only vs tool override

**Decision**: Hook `tool_call` and mutate `event.input.command` in-place. Do not register a replacement bash tool.

**Rationale**: The upstream extension proves this approach works and is simpler. The built-in bash tool owns execution, rendering, truncation, and error handling — the extension only changes the command text. Registering `createBashTool(cwd)` with no custom operations (as the local extension does) provides zero value over the built-in.

**Alternatives considered**:

- _Tool override with BashOperations_: Used by pi-rtk. Unifies `tool_call` and `user_bash` through shared ops, but adds complexity (custom spawn, timeout budget sharing, truncation responsibility). Not needed without `user_bash`.
- _spawnHook approach_: `createBashTool(cwd, { spawnHook })` would work but still requires tool override. Less minimal than hook-only.

### Async pi.exec vs spawnSync

**Decision**: Use `pi.exec("rtk", ["rewrite", cmd], { timeout, signal })`.

**Rationale**: `pi.exec` is Pi's native async subprocess API. It supports `AbortSignal` (via `ctx.signal`) for Esc-to-cancel propagation and has built-in timeout handling. `spawnSync` blocks the event loop and has no signal support.

**Alternatives considered**:

- _spawnSync_: Current approach. Simple but blocking and no signal support.
- _Custom spawn (pi-rtk style)_: Full control but duplicates Pi's process management. Overkill for a thin delegate.

### Remove user_bash

**Decision**: Remove the `user_bash` event handler entirely.

**Rationale**: The upstream extension deliberately omits `user_bash` — its design is "rewrite-only" for agent tool calls. User `!` commands go through a different execution path, and intercepting them requires claiming the event (first-handler-wins), which makes the extension responsible for all shell execution even when RTK can't rewrite. This expands scope beyond a thin delegate.

**Alternatives considered**:

- _Keep user_bash with fallthrough_: pi-rtk does this. But the `user_bash` API doesn't support "try and fall through" — claiming the event replaces Pi's default handling entirely.
- _Conditional claim_: Only claim when `rtk rewrite` succeeds. Adds latency (blocking the user's command on a rewrite probe) and complexity.

### Availability check at load time

**Decision**: Call `pi.exec("rtk", ["--version"])` in an async factory. If killed, non-zero exit, or spawn error, emit a warning (via `console.warn`) and return early (no-op extension).

**Rationale**: Checking at load time gives users immediate feedback and avoids per-command overhead. The extension becomes a no-op rather than failing silently on every command. No semver gating — all rtk versions with `rewrite` support are allowed.

### Env var disable only

**Decision**: Use only `RTK_DISABLED=1` (no CLI flags).

**Rationale**: Matches upstream. CLI flags (`--rtk-disable`, `--rtk-binary`) add registration complexity for marginal benefit. Users who need per-project disable can use `.env` or shell aliases.

## Risks / Trade-offs

- **[Risk] If Pi removes or changes `pi.exec` signature** → Extension fails to load. Mitigation: `pi.exec` is a documented, stable API with examples throughout the docs.
- **[Risk] `--no-builtin-tools` flag disables the built-in bash** → No bash tool exists to hook, so `tool_call` never fires for bash. Mitigation: Low — `--no-builtin-tools` is a niche flag, and the extension degrades gracefully (no-op).
- **[Risk] `rtk --version` hangs or times out** → Extension disables itself via `killed` check. Mitigation: benign — the extension becomes a no-op and the agent proceeds normally.
- **[Trade-off] No `user_bash` optimization** → User `!` commands don't get RTK rewrite. Mitigation: This matches upstream's deliberate scope boundary. Users can install a separate extension for `user_bash` if needed.
- **[Trade-off] Load-time version probe adds latency** → `rtk --version` runs at extension load. Mitigation: It's ~10ms and Pi awaits it during startup, so no user-visible delay.
