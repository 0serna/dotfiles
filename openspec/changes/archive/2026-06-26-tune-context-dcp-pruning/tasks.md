## 1. Pruning Constants

- [x] 1.1 Change the protected recent-message count from 20 to 15.
- [x] 1.2 Change the large-output token threshold from 2000 to 1500.

## 2. Large Output Rule

- [x] 2.1 Update `old_large_output` pruning to apply to any non-recent textual `toolResult` over the threshold.
- [x] 2.2 Preserve the existing `question` exclusion.
- [x] 2.3 Preserve existing duplicate, resolved-error, and superseded file-operation behavior.

## 3. Tests and Validation

- [x] 3.1 Update tests that assert the protected recent-message window.
- [x] 3.2 Add or update coverage for tool-agnostic large textual result pruning.
- [x] 3.3 Run the relevant test suite.
- [x] 3.4 Run the project quality gate.
