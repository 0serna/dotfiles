## 1. Semantic Pruning Identities

- [x] 1.1 Add non-truncated semantic operation identity metadata separate from display targets.
- [x] 1.2 Include `path`, `offset`, and `limit` in `read` semantic identity.
- [x] 1.3 Include exact edit payload in `edit` semantic identity for `resolved` matching.
- [x] 1.4 Keep `write` semantic identity based on normalized path.
- [x] 1.5 Preserve existing command/query/url identities for non-file tools without using truncated display targets.

## 2. Pruning Policy Behavior

- [x] 2.1 Change `resolved` matching to use semantic operation identity.
- [x] 2.2 Change `superseded` matching to use semantic supersede identity instead of display target.
- [x] 2.3 Remove `superseded` from the `edit` pruning policy.
- [x] 2.4 Keep global `duplicate` pruning by normalized text unchanged.
- [x] 2.5 Keep `write` superseded behavior for later writes to the same path.

## 3. Tests

- [x] 3.1 Add coverage that `read` calls to the same path with different `offset` or `limit` are not superseded.
- [x] 3.2 Add coverage that `read` errors are not resolved by later successful reads with different ranges.
- [x] 3.3 Add coverage that same-range `read` calls can still be superseded.
- [x] 3.4 Add coverage that `edit` results to the same path are not superseded.
- [x] 3.5 Add coverage that `edit` errors are resolved only by an identical edit payload.
- [x] 3.6 Add coverage that later `write` calls to the same path still supersede earlier writes.
- [x] 3.7 Keep existing duplicate, stale_large, ignored-tool, and unlisted-tool coverage passing.

## 4. Documentation and Verification

- [x] 4.1 Update `pruning-matrix.md` to describe semantic identity and note that `edit` does not use `superseded`.
- [x] 4.2 Run context pruning tests.
- [x] 4.3 Run the full repository check suite.
- [x] 4.4 Run OpenSpec validation for `fix-dcp-pruning-identities`.
