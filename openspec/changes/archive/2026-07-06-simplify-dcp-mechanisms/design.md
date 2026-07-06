## Context

The `pi-dcp-lite-context-pruning` extension (`dotfiles/pi/agent/extensions/context`) is invoked on the `context` event by the Pi agent to compact stale tool results in transient context. It currently supports four pruning mechanisms — `duplicate`, `resolved`, `superseded`, `stale_large` — gated by a per-tool policy in `pruning/policy.ts`. Identity bookkeeping for `duplicate` (normalized content hashes) and `resolved` (semantic operation identity) sits in `decideStubs` and feeds the `laterContentHashesByIndex` / `laterSuccessOperationsByIndex` helpers. Metrics live in `pruning/metrics.ts` and the public surface is the `PruneReason` union, `PruneMetrics` shape, and `pruneMessages()` in `prune.ts`.

The four-mechanism policy was introduced in the original spec and tuned in subsequent changes (`2026-06-25-add-dcp-lite-extension`, `2026-06-26-tune-context-dcp-pruning`, `2026-06-28-fix-dcp-pruning-identities`, `2026-06-29-improve-context-dcp-externalization`, `2026-06-26-protect-skill-read-results`, `2026-06-29-reuse-pi-full-output-path`). Each tuning kept the full surface, but in practice `duplicate` produces high collision noise and `resolved` rarely fires outside of bash error-then-success patterns that are already short.

## Goals / Non-Goals

**Goals:**

- Drop the `duplicate` and `resolved` mechanisms and all their identity helpers.
- Lower the token gate to `500` to make `stale_large` more aggressive on medium outputs.
- Raise the DCP age gate to `25` so the recent window is wider before large results get stubbed.
- Rename the metric `staleLargeProtectedCount` to `ageGatedCount` to reflect that the metric now describes any candidate that cleared size but not age.
- Update the spec, matrix, and ADR to record the new policy.

**Non-Goals:**

- Fix the pre-existing drift between spec (`1000` / `30`) and code (`2000` / `20`); the new change supersedes both.
- Add new pruning mechanisms or per-tool configurable thresholds.
- Touch the `read` / `edit` / `write` file operation identity logic beyond removing `duplicate` from `bash`/`web_fetch`.

## Decisions

- **Mechanism removal is type-level, not just configuration.** We delete `"duplicate"` and `"resolved"` from `PruneReason` rather than leave them as vestigial union members. This forces all policy entries, `decideStubs` branches, `reasonCounts` keys, and tests to be updated together and prevents accidental reintroduction.
- **Metric rename at the field level.** `staleLargeProtectedCount` becomes `ageGatedCount` in `PruneMetrics`. The semantic is preserved: candidates that exceed the size gate but are inside the age gate and have a policy that allows `stale_large`. Only the test file is updated to match.
- **Threshold tuning paired.** `500` tokens and `25` age are presented together. The user asked for both; a 4× wider size gate and a slightly wider age gate are the same direction (more aggressive on big content, more lenient on recency). Splitting them across changes would overstate churn.
- **Spec updated in place.** `openspec/specs/pi-dcp-lite-context-pruning/spec.md` is edited directly by the `apply` step. There is no `proposal/`, `design/`, or `tasks/` archive for it because the change is owned here.
- **ADR file scoped to the decision, not the history.** `docs/adr/0001-dcp-simplify.md` records the why (covered mechanisms, simpler identity) and links to the proposal. It does not retell the four previous DCP changes.

### Alternatives considered

- **Keep `duplicate` and `resolved` as opt-in flags per tool.** Rejected: increases configuration surface and keeps the identity helpers in the codebase. The user explicitly asked to eliminate them.
- **Make thresholds configurable via Pi settings.** Rejected: violates the "smallest correct implementation" principle and adds a public API for a tuning knob.
- **Rename `staleLargeProtectedCount` to `staleNearMissCount` or `sizeThrottledCount`.** Rejected: the user chose `ageGatedCount` because the new behavior is dominated by the age gate, not the size threshold.

## Risks / Trade-offs

- **More aggressive pruning of medium outputs.** Outputs between 500 and 2000 tokens that previously survived the size gate will now be stubbed once they pass age 25. → Mitigation: keep the recent window at 25 (vs. 20) so the most recent medium outputs are still protected.
- **Loss of `duplicate` deduplication on `bash` and `web_fetch`.** Two consecutive identical bash outputs will both remain in context. → Mitigation: in practice, repeated bash outputs are short and the 500-token gate filters them; `web_fetch` typically returns unique URLs anyway.
- **Loss of `resolved` error replacement on `bash`.** A long error trace followed by a success will leave the error in context. → Mitigation: bash errors are usually short; the size gate limits damage; users can still scroll or compact manually.
- **Type-level breaking change for any external importer of `PruneReason`.** The extension does not export this type today, so the blast radius is internal. → Mitigation: no public re-export; tests catch any leftover reference.

## Migration Plan

1. `apply` the change: edit types, policy, metrics, matrix, tests, spec, and add ADR.
2. Run `npm run check` and `npm test` to confirm the gate is green.
3. No runtime migration: pruning is invoked per `context` event and re-evaluates from current state.
4. Rollback: revert the change directory and the `apply`ed spec; the previous spec text and code are recoverable from `git`.

## Open Questions

- None at apply time. The previous drift between spec and code is intentionally left for a separate change.
