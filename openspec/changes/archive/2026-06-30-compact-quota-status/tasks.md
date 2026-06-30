## 1. Formatter Structure

- [x] 1.1 Add a labeled window segment formatter that emits `<label>(<remaining>% <reset>)` with existing threshold coloring behavior.
- [x] 1.2 Model provider windows with normalized labels `R`, `W`, and `M` in Codex and OpenCode formatting paths.
- [x] 1.3 Add compact window selection logic that keeps the primary window, includes longer windows below the threshold, and falls back to the first available window when the primary is missing.

## 2. Provider Formatting

- [x] 2.1 Update Codex status formatting to emit `R(...)` for the short window and conditional `W(...)` for the seven-day window.
- [x] 2.2 Update Codex credits formatting so `C<n>` appears only when a Codex quota window is exhausted and credits are available.
- [x] 2.3 Update Codex banked reset credit formatting so `R<n>` appears only when a Codex window is below threshold, including explicit `R0`.
- [x] 2.4 Update OpenCode status formatting to emit `R(...)`, conditional `W(...)`, conditional `M(...)`, and partial available windows.
- [x] 2.5 Update OpenCode balance formatting so the dollar balance appears only when an OpenCode quota window is exhausted and balance is available.

## 3. Combined Status

- [x] 3.1 Change combined provider order to Codex first and OpenCode second.
- [x] 3.2 Change provider labels and errors to `Codex`, `OpenCode`, `Codex error`, and `OpenCode error`.
- [x] 3.3 Preserve existing provider isolation when one provider fails and the other has usable current or cached data.

## 4. Tests and Validation

- [x] 4.1 Update quota formatter tests for the new labeled window segment format.
- [x] 4.2 Add Codex tests for healthy long-window omission, below-threshold long-window display, consumed credits, and conditional banked reset credits.
- [x] 4.3 Add OpenCode tests for healthy long-window omission, below-threshold `W/M` display, partial windows, and consumed balance.
- [x] 4.4 Add combined status tests or assertions for provider order and provider error labels.
- [x] 4.5 Run the repository quality gate and fix any reported issues.
