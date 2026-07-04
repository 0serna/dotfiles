## Context

Context pruning is implemented around `pruneMessages(messages, options)`, called from the Pi context extension hook. The current implementation already has good behavioral coverage, but the pruning flow is hard to navigate because candidate collection, pruning decisions, metrics, saved-output handling, and message replacement are interleaved in `prune.ts` and neighboring helpers.

The existing capability requirements in `pi-dcp-lite-context-pruning` must remain unchanged: explicit policy allowlist, token threshold checks, DCP age behavior, saved-path handling, metrics, and ignored tools all continue to behave as today.

## Goals / Non-Goals

**Goals:**

- Keep `pruneMessages(messages, options)` as the only public context pruning interface.
- Move implementation detail behind internal seams for candidate collection, decision policy, stub application, and metrics.
- Preserve fail-open behavior: pruning errors return the original messages with empty metrics.
- Preserve the existing tests as the primary verification surface.
- Improve locality so future pruning-rule changes concentrate in one internal seam.

**Non-Goals:**

- Add new pruning reasons, tool policies, thresholds, or DCP age rules.
- Change hook integration in `context/index.ts` beyond import compatibility if needed.
- Export internal seams as public caller-facing interfaces.
- Rewrite unrelated context status or formatting modules.

## Decisions

### Keep the external seam at `pruneMessages`

`pruneMessages` remains the module interface because callers and tests already exercise all required behavior through it. Exposing policy, metadata, or metrics calculators separately would make the module shallower by increasing the interface without adding caller leverage.

Alternative considered: export policy and metadata helpers for direct tests. Rejected because it would make internal implementation choices part of the test surface.

### Create private internal seams under `context/pruning/`

The implementation will be organized under `dotfiles/pi/agent/extensions/context/pruning/` around four internal seams:

- candidate collection: turns raw messages plus tool-call metadata into eligible pruning candidates.
- decision policy: applies duplicate, resolved, superseded, and stale-large rules.
- stub application: chooses saved paths, externalizes content when needed, and replaces message text.
- metrics: computes reported pruning metrics from candidates and applied decisions.

Alternative considered: keep everything in `prune.ts`. Rejected because it preserves poor locality and makes future rule changes require reading the whole flow.

### Keep policy declarative

The tool-to-pruning-reason policy stays as a declarative table. This keeps leverage high: adding or changing a tool policy remains separate from the decision algorithm.

Alternative considered: implement one branch per tool. Rejected because it would spread policy across algorithmic control flow.

### Keep fail-open semantics at the public interface

All unexpected errors inside pruning continue to return original messages and zeroed metrics. Context pruning must not break the agent context pipeline.

Alternative considered: propagate pruning errors to the hook. Rejected because pruning is an optimization and safety mechanism, not a mandatory transformation.

## Risks / Trade-offs

- Internal file split could hide flow instead of improving locality → keep `prune.ts` as a readable orchestration facade and preserve behavior-focused tests.
- Type exports may look public even when only used internally → keep caller imports limited to `pruneMessages`/result types and avoid documenting internal seams as public.
- Refactor could accidentally change age or metric behavior → run the existing context pruning test suite and full repository checks.
