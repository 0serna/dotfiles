## 1. Full-output path detection

- [x] 1.1 Add a helper in the context pruning module to extract `Full output:` paths from textual tool results.
- [x] 1.2 Verify extracted paths exist before reuse and ignore missing or unreadable paths.

## 2. Pruning externalization behavior

- [x] 2.1 Update DCP externalization to prefer an existing full-output path for applied pruning decisions.
- [x] 2.2 Preserve DCP-owned `/tmp/pi-dcp/<sessionId>/NNNN.txt` creation as the fallback path.
- [x] 2.3 Ensure DCP does not chmod or otherwise mutate reused full-output files.

## 3. Tests and validation

- [x] 3.1 Add tests proving a pruned result with an existing `Full output:` path uses that path in `saved=` and does not create a DCP-owned copy for that result.
- [x] 3.2 Add tests proving a missing `Full output:` path falls back to a DCP-owned file.
- [x] 3.3 Add tests proving DCP-owned fallback files keep private permissions.
- [x] 3.4 Run the context test suite and repository quality gate.
