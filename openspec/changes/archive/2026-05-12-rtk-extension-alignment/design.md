## Context

The RTK extension intercepts bash commands and rewrites them using `rtk rewrite` to produce safer, more context-efficient alternatives. The current implementation at `dotfiles/pi/agent/extensions/rtk-rewrite.ts` was written independently of the reference implementation at `sherif-fanous/pi-rtk`, leading to architectural divergence and unnecessary complexity.

The extension runs inside Pi's extension system and needs to handle two execution paths:

1. **Agent-initiated**: The LLM calls the `bash` tool — intercepted via tool registration
2. **User-initiated**: The user types `!command` or `!!command` — intercepted via the `user_bash` event

## Goals / Non-Goals

**Goals:**

- Align the extension with `createBashTool` + `spawnHook` architecture (reference pattern)
- Remove the custom compound command parser — `rtk` handles it natively
- Fix the missing `!!` bypass (`excludeFromContext` check)
- Fix the closure-based `user_bash` exec pattern
- Reduce code from ~260 lines to ~60 lines
- Keep exit code 0 and 3 as valid rewrites (don't use pure try/catch)

**Non-Goals:**

- Changing user-visible behavior (rewritten commands should be identical)
- Adding new capabilities beyond what exists today
- Changing how `rtk` itself works or its configuration

## Decisions

### Decision 1: Use `createBashTool` + `spawnHook` for agent bash calls

**Chosen:** `createBashTool(cwd, { spawnHook })` + `pi.registerTool(tool)`

**Alternatives considered:**

- **Current approach** (event hook on `tool_call`): Works but couples to internal event ordering and can't compose with other tool options like `commandPrefix`.

**Rationale:** The SDK's canonical API for tool registration. `spawnHook` is a pure transform `(command, cwd, env) → (command, cwd, env)` that runs right before execution. It composes cleanly with other `BashToolOptions` and doesn't depend on event dispatch ordering.

### Decision 2: Use `spawnSync` instead of `execFileSync` for rtk invocation

**Chosen:** `spawnSync` with manual exit code inspection

**Alternatives considered:**

- **`execFileSync` + try/catch** (reference approach): Throws on non-zero exit, losing exit-3 (ask rule) rewrites which are the most common valuable rewrites.
- **`execFileSync` + catch inspection**: Possible but awkward — `execFileSync` throws on non-zero exit but the error object carries `stdout`. Using `spawnSync` is cleaner since it doesn't throw.

**Rationale:** `spawnSync` returns `{ status, stdout, stderr }` without throwing on non-zero exit. We check `status === 0 || status === 3` with non-empty, different stdout to accept a rewrite. This preserves the valuable exit-3 rewrites that a pure try/catch approach would discard.

### Decision 3: Drop compound command parsing

**Chosen:** Pass full command string to `rtk rewrite` as-is

**Alternatives considered:**

- **Current approach** (custom parser): 60+ lines parsing `&&`, `||`, checking for unsupported syntax.

**Rationale:** Tested with `rtk 0.39.0` — `rtk rewrite "cat foo.txt && ls -la"` returns `rtk read foo.txt && rtk ls -la` (exit 3). Pipes also work: `rtk rewrite "ls -la | grep foo"` returns `rtk ls -la | grep foo` (exit 3). The custom parser is dead code.

### Decision 4: Rewrite per `exec` call in `user_bash`

**Chosen:** Call `rtkRewriteCommand(command)` inside the `exec` function for every invocation

**Alternatives considered:**

- **Current approach** (capture in closure): Captures the rewritten command once and reuses it for all `exec` calls, ignoring the `command` argument.

**Rationale:** Correct by construction. If Pi ever calls `exec` with a different command (unlikely but possible), the per-call approach handles it correctly. Also naturally emerges from the simplified architecture.

### Decision 5: Check `excludeFromContext` in `user_bash`

**Chosen:** Guard the `user_bash` handler with `if (event.excludeFromContext) return`

**Rationale:** `!!` commands are explicitly meant to bypass LLM context. The extension should not intercept them. This was a gap in the current implementation.

### Decision 6: Timeout of 3000ms

**Chosen:** 3000ms

**Rationale:** Compromise between the current 1000ms (too tight — rewrites may time out on slow connections) and the reference's 5000ms (too slow — delays feel sluggish when no rewrite exists). 3000ms gives `rtk` reasonable time to contact its cloud endpoint.

## Risks / Trade-offs

- **[Low] `spawnSync` blocks the event loop** → The rewrite happens synchronously before execution, so the event loop is blocked for at most 3000ms. Acceptable for a CLI tool. If this becomes an issue, we can switch to async invocation.
- **[Low] `rtk` native compound handling could change** → If a future `rtk` version stops handling `&&`/`||` natively, we'd need to re-add the parser. Mitigation: tested with `rtk 0.39.0`, the current deployed version.
- **[Low] Fire-and-forget: no user feedback when rewrite happens** → The extension silently replaces commands. Users won't know a rewrite occurred unless they inspect the LLM's context. This matches the reference behavior.
