## MODIFIED Requirements

### Requirement: Tool registration and parameters

The extension SHALL register a tool named `question` via `pi.registerTool()`. The tool SHALL accept the following parameter:

- `questions` (required, array of objects): Each entry SHALL represent one question and SHALL have:
  - `question` (string, required): The question text displayed to the user for that tab.
  - `options` (required, array of objects): Each option SHALL have:
    - `label` (string, required): Display label for the option.
    - The first option in the array SHALL be treated as the agent's recommendation.

In non-interactive modes (when `ctx.hasUI` is false), the tool SHALL return an error message.

#### Scenario: Tool registers with correct name

- **WHEN** the extension is loaded
- **THEN** `pi.getAllTools()` SHALL include a tool with `name: "question"`.

#### Scenario: Tool accepts an array of questions

- **WHEN** the agent calls with `questions: [{ question: "Scope?", options: [{ label: "Backend" }, { label: "Frontend" }] }, { question: "Priority?", options: [{ label: "P0" }] }]`
- **THEN** the tool SHALL process both questions and return one answer per question.

#### Scenario: Tool returns error in non-UI mode

- **WHEN** the tool is called with `ctx.hasUI === false`
- **THEN** the tool SHALL return content `"Error: UI not available (running in non-interactive mode)"`.

### Requirement: Options list with recommended highlight

For each question, the tool SHALL display all options from the agent plus an automatically appended "Other" option at the end. The "Other" option SHALL have `isOther: true`.

The first option in each question's `options` array SHALL be visually marked as recommended (★). The agent MUST ensure the recommended option is first.

The agent SHALL NOT include an "Other" option in their `options` array. The extension always appends it automatically.

#### Scenario: First option is visually marked as recommended

- **WHEN** the agent calls with a question whose `options` first item is `{ label: "Next.js" }`
- **THEN** the "Next.js" option SHALL be shown with a visual indicator marking it as recommended.

#### Scenario: Other is always appended last

- **WHEN** the agent provides `options` with 3 items
- **THEN** the UI SHALL display exactly 4 options: the 3 from the agent plus "Other" at the end.

### Requirement: Keyboard interaction modes

For a single question, the tool SHALL support the interaction modes described below. For multiple questions, the tool SHALL additionally render a tab bar (one tab per question plus a trailing "Submit" tab) and SHALL support tab navigation.

1. **Navigate**: Arrow keys (↑/↓) move selection within the active question's options. The "Other" option is selectable like any other.
2. **Confirm (Enter)**: If the selected option is a regular option, the tool SHALL record that answer and advance. If the selected option is "Other", the tool SHALL enter text input mode.
3. **Comment (Space)**: If the selected option is a regular option, the tool SHALL select it and open a comment field. If the selected option is "Other", the tool SHALL enter text input mode (equivalent to Enter).
4. **Tab navigation (multiple questions only)**: `Tab` or `→` SHALL move to the next tab (wrapping around, including the Submit tab); `Shift+Tab` or `←` SHALL move to the previous tab. Answered questions SHALL be marked distinctly from unanswered ones in the tab bar.
5. **Submit tab**: When the Submit tab is active, `Enter` SHALL submit only if every question is answered; otherwise the UI SHALL show which questions remain unanswered. `Esc` on the Submit tab SHALL cancel the whole batch.
6. **Escape in list (any question)**: Cancels the whole batch. Returns a cancelled result and aborts the current agent run.
7. **Escape in text/comment input**: Returns to the active question's option list without confirming.

#### Scenario: Enter on normal option confirms

- **WHEN** the user selects a normal option with cursor and presses Enter
- **THEN** the tool SHALL record that option's label as the answer and advance to the next tab (or submit if it was the last question).

#### Scenario: Space on normal option opens comment

- **WHEN** the user selects a normal option and presses Space
- **THEN** the tool SHALL show a comment input field below the selected option. The user can type a comment and press Enter to confirm or Escape to return to the list.

#### Scenario: Enter/Space on Other opens text input

- **WHEN** the user selects the "Other" option and presses Enter or Space
- **THEN** the tool SHALL show a text input field where the user types their own answer.

#### Scenario: Tab navigation moves between questions

- **WHEN** the user presses `Tab` or `→` while multiple questions are shown
- **THEN** the active tab SHALL move to the next question (or the Submit tab after the last question), wrapping around.

#### Scenario: Submit requires all questions answered

- **WHEN** the user is on the Submit tab and at least one question is unanswered
- **THEN** pressing Enter SHALL NOT submit and the UI SHALL indicate the unanswered questions.

#### Scenario: Escape cancels

- **WHEN** the user presses Escape in the option list
- **THEN** the tool SHALL return with cancelled state
- **AND** the current agent run SHALL be aborted.

#### Scenario: Escape in input returns to list

- **WHEN** the user is in a comment or text input field and presses Escape
- **THEN** the tool SHALL return to the active question's option list without saving input.

### Requirement: Result shape

The tool SHALL return structured data to the LLM. The result `details` SHALL contain an `answers` array with one entry per question and a `cancelled` boolean.

Normal selection (per question):

```typescript
{
  content: [{ type: "text", text: "<q1 label>: User selected: <label>\n<q2 label>: User wrote: <text>" }],
  details: {
    answers: [
      { question, options, answer: "<label>", wasCustom: false },
      { question, options, answer: "<text>", wasCustom: true }
    ],
    cancelled: false
  }
}
```

Normal selection with comment (per question):

```typescript
{
  content: [{ type: "text", text: "<q label>: User selected: <label>\nComment: <comment>" }],
  details: {
    answers: [{ question, options, answer: "<label>", comment: "<comment>", wasCustom: false }],
    cancelled: false
  }
}
```

Cancelled:

```typescript
{
  content: [{ type: "text", text: "User cancelled the selection" }],
  details: { answers: [], cancelled: true },
  terminate: true
}
```

#### Scenario: Result includes an answer per question

- **WHEN** the user answers two questions ("Next.js" and a custom "SvelteKit")
- **THEN** the returned `details.answers` SHALL contain two entries, one with `answer: "Next.js"` / `wasCustom: false` and one with `answer: "SvelteKit"` / `wasCustom: true`, and `cancelled` SHALL be `false`.

#### Scenario: Comment is included in result

- **WHEN** the user selects "Next.js" via Space and writes "Best ecosystem"
- **THEN** the returned entry SHALL contain `answer: "Next.js"`, `comment: "Best ecosystem"`, `wasCustom: false`.

#### Scenario: Other returns custom answer

- **WHEN** the user selects Other and types "SvelteKit"
- **THEN** the returned entry SHALL contain `answer: "SvelteKit"`, `wasCustom: true`.

#### Scenario: Cancelled result

- **WHEN** the user presses Escape
- **THEN** the returned `details` SHALL contain `answers: []` and `cancelled: true`
- **AND** the tool result SHALL set `terminate: true`
- **AND** the current agent run SHALL be aborted.

### Requirement: Custom TUI rendering

The tool SHALL provide `renderCall` and `renderResult` for custom display in the pi TUI.

`renderCall` SHALL show the tool name followed by the question count and, when present, the question labels.
`renderResult` SHALL show one styled line per answered question in the form `✓ <question>: <answer>`:

- Normal selection: green checkmark + question + answer label
- Selection with comment: green checkmark + question + answer + comment in quotes
- Custom answer: green checkmark + question + "(wrote)" prefix + answer text
- Cancelled: warning-colored "Cancelled"

#### Scenario: renderCall shows question count

- **WHEN** the tool call is rendered with two questions
- **THEN** it SHALL display the tool name and the count of questions (and their labels).

#### Scenario: renderResult shows one line per answer

- **WHEN** the result is rendered after answering two questions
- **THEN** it SHALL show two green checkmark lines, one per question, each with its question and answer.

#### Scenario: renderResult shows styled answer for a single question

- **WHEN** the result is rendered after a normal single-question selection
- **THEN** it SHALL show a green checkmark ("✓") followed by the answer label, exactly as before the multi-question change.
