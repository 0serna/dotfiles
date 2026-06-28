## 1. Pruning Policy

- [x] 1.1 Add an explicit normalized tool/mechanism pruning policy for `read`, `edit`, `write`, `bash`, `web_fetch`, and `web_search`.
- [x] 1.2 Exclude tool results from DCP candidates when the normalized tool has no policy entry.
- [x] 1.3 Gate each pruning decision on the tool policy allowing that specific mechanism.
- [x] 1.4 Ensure `staleLargeProtectedCount` only counts candidates whose tool policy allows `stale_large`.

## 2. Documentation

- [x] 2.1 Update `pruning-matrix.md` to remove `Other textual tools`.
- [x] 2.2 Keep `question` and `multi_tool_use.parallel` documented as fully unpruned.

## 3. Tests

- [x] 3.1 Add coverage showing an unlisted textual tool is not pruned by `duplicate`.
- [x] 3.2 Add coverage showing an unlisted textual tool is not pruned by `resolved`.
- [x] 3.3 Add coverage showing an unlisted textual tool is not pruned by `superseded`.
- [x] 3.4 Add coverage showing an unlisted textual tool is not pruned or counted by `stale_large`.
- [x] 3.5 Keep existing coverage for the reviewed allowlisted tools passing.

## 4. Verification

- [x] 4.1 Run the context pruning tests.
- [x] 4.2 Run the full repository check suite.
- [x] 4.3 Search for `Other textual tools` and generic fallback pruning references to confirm they are removed.
