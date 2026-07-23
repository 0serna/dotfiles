## 1. Schema and types

- [x] 1.1 Change `schema.ts` to accept `questions: [{ question: string, options: [{ label: string }] }]` (replace top-level `question`/`options`); keep TypeBox shapes.
- [x] 1.2 Update `types.ts`: add `QuestionInput`, `AnswerEntry`, and `MultiQuestionDetails`; keep `DisplayOption`/`UIState`/`ResultValue` aligned.

## 2. Result building

- [x] 2.1 Update `results.ts` `buildResult` to take the `questions` array and produce `details: { answers: [{ question, options, answer, wasCustom, comment? }], cancelled }`.
- [x] 2.2 Keep cancel path returning `answers: []`, `cancelled: true`; ensure caller sets `terminate: true` + `ctx.abort()`.

## 3. Interaction (TUI)

- [x] 3.1 In `interaction.ts`, accept `questions` array; build per-question `allOptions` (options + auto "Other").
- [x] 3.2 Add tab state (`currentTab`, Submit tab) and navigation with `Tab`/`→`/`Shift+Tab`/`←` when `questions.length > 1`.
- [x] 3.3 Preserve single-question behavior when `questions.length === 1` (no tab bar).
- [x] 3.4 Record one answer per question; advance on confirm; open comment on `Space`; open "Other" text input.
- [x] 3.5 Gate Submit tab on `allAnswered()`; `Esc` cancels the whole batch and calls `ctx.abort()`.

## 4. Rendering

- [x] 4.1 In `rendering.ts`, add a tab bar to `renderFrame` (only when multiple questions): `← □/■ Q… → ✓ Submit →`, with answered/unanswered markers.
- [x] 4.2 Add the Submit/Review screen inside the tool showing the Q→A mapping before confirming.
- [x] 4.3 Update `renderCall` to show the question count and labels.
- [x] 4.4 Update `renderResult` to emit one `✓ <question>: <answer>` line per answer (`(wrote)` for custom, ` — "<comment>"` for comments); cancelled shows "Cancelled".

## 5. Registration and prompt guidelines

- [x] 5.1 Update `index.ts` `promptGuidelines` to instruct the agent to pass `questions` (and that the first option per question is recommended).

## 6. Tests and quality gate

- [x] 6.1 Add Vitest coverage for schema validation (single vs multi), result building (normal/custom/comment/cancel/multi-aggregate), rendering (tab bar + result lines), and submit-gating.
- [x] 6.2 Run `npm run check` (lint + typecheck + test) and `npm run openspec`; fix any failures.
