## Context

The `question` extension (`dotfiles/pi/agent/extensions/question/`) lets the agent ask the user one question per tool call, rendered as a full-screen options list in the TUI. A single call blocks the agent run until the user answers (or cancels, which aborts the run). When the agent needs several independent decisions, it must issue several calls back-to-back.

The Pi SDK ships an example `questionnaire.ts` ("Multi-question input with tab bar navigation between questions") that demonstrates the exact UI pattern we want: a tab bar above the options, `Tab`/`←`/`→` navigation, an answered/unanswered indicator per tab, and a gated "Submit" tab. We reuse that pattern rather than inventing a new one.

Existing `question` behavior we must preserve per question:

- First option in `options` is visually marked as recommended (★).
- An "Other" option is auto-appended at the end.
- `Space` on a regular option opens a comment field; `Enter` on "Other" opens free-text input.
- `Esc` cancels the whole interaction and aborts the run (`terminate: true` + `ctx.abort()`).
- Non-interactive mode returns an error.

## Goals / Non-Goals

**Goals:**

- Accept `questions: [{ question, options }]` in a single tool call.
- Present multiple questions as tabs; keep single-question behavior unchanged.
- Return an aggregated `answers` array.
- Preserve all existing per-question interactions and the cancel/abort contract.

**Non-Goals:**

- No partial/optional questions, no skip, no per-question `allowOther` toggle (Other is always appended, as today).
- No new TUI primitives; the tab bar is hand-rendered lines, not a new `pi-tui` component.
- No change to how the agent is expected to phrase the question (just an array now).

## Decisions

**D1. Parameter shape is a single required `questions` array (breaking).**
Replaces top-level `question`/`options`. Per-question shape keeps today's `{ question, options: [{ label }] }`. Rationale: smallest surface that expresses "N questions", and the user explicitly chose to break the old shape. Alternatives considered: keep both `question` and `questions` for back-compat (rejected — adds schema branching and ambiguous result shape for no external callers besides the agent itself); wrap in an object with optional fields (rejected — unnecessary indirection).

**D2. Tab bar only when `questions.length > 1`.**
A single question renders exactly as today (no tab chrome, no Submit tab). Rationale: zero UX regression for the common case and least code divergence. This mirrors `questionnaire.ts`, which special-cases `isMulti`.

**D3. Tab model: one tab per question + a trailing "Submit" tab.**
State holds `currentTab` (0..N, where N = questions.length is the Submit tab). `Tab`/`→` advances, `Shift+Tab`/`←` goes back, wrapping around. Answered questions render `■`, unanswered `□`. The Submit tab is only actionable when every question is answered; otherwise it shows the missing list. Rationale: direct lift from the reference example, proven and familiar.

**D4. Submit requires all questions answered.**
Enter on the Submit tab submits only when `allAnswered()`; otherwise it shows which are missing. Rationale: prevents silently dropping answers and keeps the contract total (the LLM always gets a complete set). Alternative (allow partial + flag missing) was rejected by the user.

**D5. Result `details` shape.**
`{ answers: [{ question, options, answer, wasCustom, comment? }], cancelled: boolean }`.

- Normal: one entry per question, fields mirroring today's single-question `details`.
- Cancel: `answers: []`, `cancelled: true`, plus `terminate: true` and `ctx.abort()` (unchanged from today).
  Rationale: keeps today's field names so downstream consumers (and `renderResult`) change minimally; each answer is self-describing (carries its question + options). The separate `questions` array is intentionally omitted because each answer already references its question.

**D6. `renderResult` shows one `✓` line per question.**
`✓ <question>: <answer>`, with `(wrote)` prefix for custom answers and ` — "<comment>"` suffix for comments. Single-question calls render exactly as today. The Submit-tab review screen inside the tool previews the same mapping before confirming.

**D7. Module layout unchanged.**
`schema.ts` (TypeBox), `types.ts` (interfaces), `interaction.ts` (UI state + `ctx.ui.custom`), `results.ts` (build `details`/`content`), `rendering.ts` (`renderFrame` + `renderCall`/`renderResult`), `index.ts` (registration + prompt guidelines). Multi-question logic lives inside `interaction.ts` (tab state) and `rendering.ts` (tab bar). Pure logic in `results.ts`/`schema.ts` stays unit-testable without a TUI.

## Risks / Trade-offs

- [Wide tab bars with many long question labels] → Truncate labels to viewport width; the review/Submit screen shows the full mapping. Mitigation: `truncateToWidth` already used elsewhere.
- [Breaking parameter change] → Update `promptGuidelines` in `index.ts` and the `question-tool` spec simultaneously; no external callers beyond the agent.
- [Long option lists + tabs + comment input exceed viewport] → Only the active tab renders its options; comment/Other input replaces the list with the editor, so height stays bounded.

## Migration Plan

1. Implement schema + types + interaction + results + rendering + index changes.
2. Add Vitest coverage for: schema validation (single vs multi), result building (normal/custom/comment/cancel/multi-aggregate), rendering (tab bar + result lines), and the submit-gating rule.
3. Update `openspec/specs/question-tool/spec.md` via this change's delta.
4. Run `npm run check` (lint + typecheck + test) and `npm run openspec`.
5. Rollback: revert the change directory and the six extension files; the contract reverts to single `question`/`options`.

## Open Questions

_(None — design resolved during the grilling session.)_
