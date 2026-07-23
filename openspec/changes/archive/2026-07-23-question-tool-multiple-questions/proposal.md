## Why

The `question` tool only accepts a single question per call, forcing the agent to make repeated tool calls (and interrupt the run) when it needs several decisions at once. Supporting a batch of questions in one call — presented as tabs in the TUI — removes that friction and gives the user a single, reviewable surface for multi-decision moments.

## What Changes

- The tool parameter `question` (string) and `options` (array) are replaced by a single required array `questions`, where each entry carries its own `question` (string) and `options` (array of `{ label }`).
- **BREAKING**: the previous top-level `question`/`options` shape is removed. Callers must pass `questions: [{ question, options }]`.
- When `questions` has a single entry, the tool behaves exactly like today (no tabs, same keyboard model, recommended-option highlight, "Other", comment).
- When `questions` has more than one entry, the UI renders a tab bar (one tab per question plus a "Submit" tab). Tabs navigate with `Tab` / `←` / `→`; answered tabs are marked. The Submit tab is only enabled once every question is answered.
- Existing per-question behavior is preserved: first option is the recommended highlight (★), an "Other" option is auto-appended, `Space` opens a comment field, and `Esc` cancels the whole batch (aborts the run with `terminate: true`).
- The result `details` change from a single answer to `answers: [{ question, options, answer, wasCustom, comment? }]`, plus a `cancelled` flag. `renderResult` shows one `✓` line per question.

## Capabilities

### New Capabilities

_(None — this extends the existing `question-tool` capability.)_

### Modified Capabilities

- `question-tool`: parameters now accept an array of questions; multi-question TUI adds tab navigation and a gated Submit; result shape returns an array of answers.

## Impact

- `dotfiles/pi/agent/extensions/question/`: `schema.ts`, `types.ts`, `interaction.ts`, `results.ts`, `rendering.ts`, `index.ts`.
- New Vitest coverage for schema, result building, rendering, cancel path, and multi-question aggregation/submit-gating.
- `openspec/specs/question-tool/spec.md` delta via this change.
- Breaking change to the tool's parameter contract (agent prompt guidelines updated in `index.ts`).
