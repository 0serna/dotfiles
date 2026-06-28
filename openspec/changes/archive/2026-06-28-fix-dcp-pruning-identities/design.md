## Context

The context extension prunes transient tool results before model context construction. Current pruning decisions use display-oriented targets for operation matching. For file tools this makes distinct operations look identical, such as two `read` calls to the same path with different `offset`/`limit` values.

The existing mechanisms have different semantics:

- `duplicate`: text identity, independent of operation identity.
- `resolved`: an earlier error is obsolete only when a later success is for the same semantic operation.
- `superseded`: an earlier result is obsolete only when a later operation truly replaces it.
- `stale_large`: size and age based pruning, independent of operation identity.

## Goals / Non-Goals

**Goals:**

- Separate internal pruning identity from display targets used in stubs and logs.
- Make `read` identity include path, offset, and limit.
- Make `resolved` use strict semantic operation identity.
- Keep `write` superseded by later writes to the same path.
- Remove `superseded` pruning for `edit` results.
- Preserve global `duplicate` pruning by normalized text.

**Non-Goals:**

- Changing token thresholds, age gates, or logging destinations.
- Adding new pruning mechanisms.
- Persistently rewriting session JSONL files.
- Expanding pruning to unlisted tools.

## Decisions

1. **Use non-truncated semantic identities for pruning decisions.**
   - Decision: keep display targets for logs/stubs, but compute pruning keys from full argument values.
   - Rationale: display targets are intentionally truncated and can collide; pruning identity must not.
   - Alternative considered: continue using `target`. Rejected because it can erase distinct context.

2. **Define tool-specific semantic operation keys.**
   - `read`: normalized path plus explicit `offset` and `limit` values, including absent values.
   - `edit`: normalized path plus exact edit payload for `resolved` matching only.
   - `write`: normalized path.
   - command/query/url tools: retain their existing full target argument identity where applicable.
   - Rationale: each tool's arguments define different replacement semantics.

3. **Remove `superseded` from `edit`.**
   - Decision: edits to the same file do not supersede each other merely by sharing a path.
   - Rationale: independent edits can modify different hunks and both outputs can matter.
   - Alternative considered: supersede only identical edit payloads. Rejected because identical successful output is already covered by `duplicate`, and identical failed-to-successful retries are covered by `resolved`.

4. **Keep `write` superseded by path.**
   - Decision: a later `write` to the same path supersedes an earlier `write` to that path.
   - Rationale: the write tool overwrites the full file content.

5. **Keep `duplicate` global by normalized text.**
   - Decision: do not restrict duplicate pruning by tool or semantic identity.
   - Rationale: duplicate removes repeated output content while preserving an earlier kept copy. It covers repetition that operation-based mechanisms cannot cover.

## Risks / Trade-offs

- Stricter identities reduce pruning savings → acceptable because correctness of context is more important than maximal savings.
- Exact edit identity may be sensitive to argument serialization differences → use stable serialization or equivalent deterministic normalization.
- Global duplicate can still hide identical output from distinct operations → mitigated because an earlier kept copy of the same normalized text remains in context and the stub preserves tool/target metadata.
