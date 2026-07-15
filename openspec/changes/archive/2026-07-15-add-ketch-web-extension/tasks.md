## 1. Test Harness and Tool Contracts

- [x] 1.1 Create the `web/` extension test harness with fake `pi.exec`, logger, UI, and ExtensionAPI registration dependencies.
- [x] 1.2 Add failing tests for query normalization, default/custom limits, optional language/library arguments, mandatory `--multi`, mandatory `--no-llms-txt`, JSON flags, and execution from `HOME`.
- [x] 1.3 Implement `tools.ts` schemas and pure argument builders until the contract tests pass.

## 2. Ketch Runner

- [x] 2.1 Add failing runner tests for valid JSON passthrough, tolerant summary details, stderr-only diagnostics, exit-code classification, cancellation, invalid JSON, and concise precondition/internal notifications.
- [x] 2.2 Add failing runner tests for 50 KB and 2,000-line truncation, private full-output persistence, appended path notices, and details that exclude stdout, stderr, snippets, and page content.
- [x] 2.3 Implement `ketch.ts` with injected command execution, shared logging, JSON syntax validation, classified errors, truncation, temporary output, summary details, and UI notification behavior until runner tests pass.

## 3. Extension Registration and Lifecycle

- [x] 3.1 Add failing extension tests proving that a successful `ketch version` probe registers exactly `web_search`, `web_fetch`, `web_code`, and `web_docs` with curated schemas and prompt routing metadata.
- [x] 3.2 Add failing extension tests proving that a failed probe registers no tools, notifies only when UI is available, remains silent without UI, and can be reevaluated by extension reload.
- [x] 3.3 Implement async availability probing, lifecycle-bound `web` logger setup, tool registration, and execute adapters in `index.ts` and `tools.ts` until lifecycle tests pass.
- [x] 3.4 Verify all four tool definitions retain default parallel execution and pass Pi's abort signal without an extension timeout.

## 4. Compact Rendering

- [x] 4.1 Add failing renderer tests for compact call arguments, result counts or byte summaries, unknown JSON shapes, failures, and truncated-result indicators without rendering response content.
- [x] 4.2 Implement `rendering.ts` and connect each custom renderer until the focused tests pass.

## 5. Verification

- [x] 5.1 Run the focused `web/` Vitest suite and resolve all failures.
- [x] 5.2 Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run format`; fix all findings caused by the change.
- [x] 5.3 Run `npm run openspec` and verify the complete change artifacts and living specifications validate.
- [x] 5.4 Review the final diff to confirm no provider credentials, Ketch configuration values, runtime response content, or unrelated settings changes were introduced.
