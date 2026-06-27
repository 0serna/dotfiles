## 1. Data Model and Parsing

- [x] 1.1 Add optional Codex usage response typing for `rate_limit_reset_credits.available_count`.
- [x] 1.2 Add a separate optional Codex quota data field for banked reset credits.
- [x] 1.3 Parse explicit numeric reset counts, including `0`, without treating missing or null data as zero.

## 2. Status Rendering

- [x] 2.1 Render banked reset credits as `R<n>` in the Codex quota status when the parsed count is available.
- [x] 2.2 Place `R<n>` before the existing `C<n>` remaining credits segment when both are displayed.
- [x] 2.3 Style `R<n>` with accent coloring when `n > 0`, dim coloring for `R0`, and avoid warning styling based on quota exhaustion.
- [x] 2.4 Omit the reset segment when reset-credit data is unavailable.

## 3. Verification

- [x] 3.1 Add or update tests for positive reset counts, explicit zero, missing data, and ordering before credits.
- [x] 3.2 Run the repository quality gate and fix any reported issues.
