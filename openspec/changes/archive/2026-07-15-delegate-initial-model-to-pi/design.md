## Context

The extension currently uses one `ManualPreferences` object for two different concerns: the in-memory route restoration target and durable per-model thinking memory. Its persisted `selection` is loaded and actively applied on every `session_start`, overriding the model and thinking level already chosen by Pi. Pi emits `session_start` for startup, reload, new, resume, and fork flows, so the override also replaces Pi's choices at every session-runtime boundary.

## Goals / Non-Goals

**Goals:**

- Make Pi authoritative for the model and thinking level present at every session start.
- Preserve deterministic restoration after routed work through a session-owned baseline.
- Keep per-model thinking memory across sessions without treating startup as a manual preference change.
- Migrate existing preference files without startup writes or loss of useful thinking memory.

**Non-Goals:**

- Change route activation, compaction routing, or settled-idle boundaries.
- Make thinking-memory writes safe across concurrent Pi processes.
- Change Pi's own model selection or session restoration behavior.

## Decisions

### Separate the session baseline from persisted thinking memory

The route session will own a nullable `ManualSelection`-shaped baseline independently from the persisted preferences object. At `session_start`, it captures `ctx.model` and `pi.getThinkingLevel()` without calling either Pi setter and without updating thinking memory. Explicit model or thinking selections replace the baseline and update durable thinking memory.

Keeping the current unified object was rejected because startup capture would either publish a non-manual choice or silently mutate the remembered thinking level.

### Capture a late baseline before the first route

If `ctx.model` is absent during `session_start`, route activation will capture the then-current Pi model and thinking level before changing either. If Pi still has no model, the route may proceed without a restoration target and settled handling retains the routed model under the existing unavailable-selection behavior.

Rejecting route activation was unnecessary because routing can still be useful even when no baseline is available.

### Persist only thinking memory

The canonical preferences file will contain only `thinkingMemory`. The loader will accept legacy files containing `selection`, project only valid thinking memory, and avoid writing during startup. The next explicit manual selection writes the canonical shape, providing lazy migration.

Retaining `selection` was rejected because no future session consumes it and it would imply a second startup authority.

### Apply the policy uniformly to session-start reasons

Startup, reload, new, resume, and fork all capture the state supplied by Pi. The extension does not special-case replacement flows because doing so would make startup authority depend on lifecycle reason and reintroduce unexpected overrides.

## Risks / Trade-offs

- [Pi supplies an unexpected model after a session replacement] → The extension intentionally trusts Pi; diagnostics and correction belong to Pi rather than model routing.
- [Legacy `selection` remains on disk until a manual preference change] → The loader ignores it immediately, and the next write canonicalizes the file.
- [No model exists before the first route] → Settled routing closes without restoration and retains the active model, matching the existing unavailable-baseline fallback.
- [Concurrent sessions overwrite thinking-memory snapshots] → This pre-existing cross-process race remains explicitly out of scope.
