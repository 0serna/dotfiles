## 1. Remove DCP-owned file creation

- [x] 1.1 Remove `externalizeOutput()` function from `pruning/stub.ts`
- [x] 1.2 Remove `writeTempOutputSync` import from `pruning/stub.ts`
- [x] 1.3 Simplify `savedPathFor()` to only detect existing bash logs (remove DCP fallback)
- [x] 1.4 Update `applyStubs()` to only include `saved=` when bash log exists

## 2. Remove size threshold from stale_large

- [x] 2.1 Remove `PRUNE_TOKEN_THRESHOLD` constant from `types.ts`
- [x] 2.2 Remove token threshold check in `decideStubs()` from `pruning/policy.ts`
- [x] 2.3 Remove `staleLargeProtectedCount` from `PruneMetrics` type in `types.ts`
- [x] 2.4 Remove `staleLargeProtectedCount` calculation from `metricsFor()` in `pruning/metrics.ts`

## 3. Clean up unused exports

- [x] 3.1 Remove `writeTempOutputSync` export from `shared/temp-output.ts`
- [x] 3.2 Update `pruning-matrix.md` to reflect age-only stale_large behavior

## 4. Update tests

- [x] 4.1 Update DCP pruning tests to reflect new behavior
- [x] 4.2 Remove tests for size threshold behavior
- [x] 4.3 Add tests for bash log detection without DCP fallback

## 5. Verify

- [x] 5.1 Run `npm run check` to verify linting and type checking
- [x] 5.2 Run `npm test` to verify all tests pass
- [x] 5.3 Verify no references to removed code remain
