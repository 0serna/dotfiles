## Context

The shared logger at `dotfiles/pi/agent/extensions/shared/logger.ts` exposes a single `log(extension, event, data?)` function. Five extensions use it with ~40 call sites, each repeating the extension name manually. There is no session correlation — entries across extensions for the same conversation are disconnected.

The logger sits inside a dotfiles repo that's installed via a TypeScript-based installer; the logger is imported at runtime by pi extensions running inside the agent process.

## Goals / Non-Goals

**Goals:**

- Eliminate repeated `extension` argument by providing a factory-bound logger
- Auto-inject `sessionId` (snapshot at creation) into every log entry for session correlation
- Auto-inject `model` (live reference) into every log entry for model-aware debugging
- Preserve all existing behavior: per-extension files, 2000-line truncation, silent error handling, JSON line format
- Keep the existing bare `log(extension, event, data)` export for any external code that imports it

**Non-Goals:**

- Not adding log levels (info/warn/error/debug)
- Not changing file structure (still per-extension logs)
- Not unifying log files
- Not adding configurable output paths
- Not adding async logging or buffering

## Decisions

### Decision 1: Factory pattern over global registry

**Choice:** `createExtensionLogger(ctx, extension)` returns a logger object with bound extension.

**Rationale:**

- Explicit binding: the caller controls both context and extension at creation point
- No global state: logger state lives on the returned object, not in module scope
- Simple migration: `log("codex-quota", "event", data)` → `logger.log("event", data)`
- Alternative rejected: global registry (auto-detect extension via stack trace) — fragile, slower, magic behavior

### Decision 2: Session ID as snapshot, model as live reference

**Decision:** `sessionId` is read once from `ctx.sessionManager.getSessionId()` at factory creation time. `model` is read from `ctx.model?.id ?? null` on every `log()` call.

**Rationale:**

- `sessionId` is stable for the lifetime of a session — snapshotting avoids repeated calls
- `model` can change between turns (user switches model) — live reference ensures accuracy
- The returned logger stores a reference to `ctx` to access `ctx.model` on each call
- The `ctx` reference may need to be refreshed on `turn_start` events (see Risks)

### Decision 3: Context fields merge into data with precedence

**Decision:** `sessionId` and `model` are set on the data object before user-supplied data is merged, and take precedence on collision.

**Rationale:**

- User data can still include any fields without risk of corrupting automatic context
- Avoids silent overwrites of sessionId/model — the logger always wins
- Implementation: destructure user data, set auto fields, spread user data → auto fields win by position in object literal

### Decision 4: Keep bare `log(extension, event, data)` exported

**Decision:** The existing function signature is preserved, unmodified.

**Rationale:**

- Zero breakage for any code outside the 5 known extensions that might import it
- The factory is the recommended path, but the old API remains available
- Internal implementation: both `log` and `logger.log` share the same core writer

## Risks / Trade-offs

- **[Stale ctx reference]** The bound logger stores a reference to `ExtensionContext`. If pi creates a new context object each event, `ctx.model` would be stale after `turn_start`. **Mitigation:** The logger creation should happen in `session_start`; if model accuracy across turns is critical, the extension must reassign the logger or the logger supports a `refresh(ctx)` call. Given that model changes between turns are infrequent, stale references are low risk.
- **[Session ID at creation]** Session ID is captured once at logger creation. If a session forks mid-conversation, the logger would still report the original session ID. **Mitigation:** Session forking creates a new session entirely, so a new `session_start` fires and a new logger would be created — this is not a practical risk.
- **[Factory overhead]** Each extension creates one logger per session. At ~5 extensions, this is negligible.
- **[Migration surface]** 5 files, ~40 call sites need updating. **Mitigation:** mechanized find-and-replace is straightforward since each file calls `log` with its own extension — clear grep targets.

## Open Questions

_(none — all design decisions resolved in exploration)_
