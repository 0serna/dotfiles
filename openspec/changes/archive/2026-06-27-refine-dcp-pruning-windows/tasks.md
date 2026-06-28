## 1. DCP Age and Constants

- [x] 1.1 Replace global recent-message protection constants with stale_large age and token threshold constants.
- [x] 1.2 Track DCP age using only eligible non-ignored `toolResult` candidates.
- [x] 1.3 Ensure ignored tools such as `question` are excluded from pruning, metrics, and age calculations.

## 2. Pruning Rule Semantics

- [x] 2.1 Allow `duplicate` to apply without a global recent-message gate.
- [x] 2.2 Allow `resolved` to apply without a global recent-message gate when a later successful same operation exists.
- [x] 2.3 Restrict `superseded` to later file operations with the same normalized tool and same normalized target.
- [x] 2.4 Apply `stale_large` only when the candidate is older than 20 DCP-ageable tool results and exceeds 2500 estimated tokens.
- [x] 2.5 Keep `SKILL.md` reads excluded from `stale_large` while allowing semantic pruning rules to apply.

## 3. Metrics and Status Data

- [x] 3.1 Replace `protectedRecentCount` with an `staleLargeProtectedCount` metric in prune metrics.
- [x] 3.2 Update latest DCP status metric plumbing to use the renamed metric shape where needed.
- [x] 3.3 Ensure logs do not count ignored tools or global recent protection.

## 4. Tests and Validation

- [x] 4.1 Update pruning tests for immediate duplicate, resolved, and same-tool superseded pruning.
- [x] 4.2 Add tests showing different-tool file operations do not trigger `superseded`.
- [x] 4.3 Add tests showing `question` does not affect DCP age or metrics.
- [x] 4.4 Add tests for the `stale_large` age gate boundary: not older than 20 preserved, older than 20 pruned.
- [x] 4.5 Update metrics assertions for `staleLargeProtectedCount`.
- [x] 4.6 Run the repository quality gate and OpenSpec validation.
