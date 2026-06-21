# question-tool Specification

## Purpose

Define the `question` tool, which asks the user a question with customizable options (including recommendation marking) and supports comment input and a custom "Other" option. Used when the LLM needs user input to proceed.

## Requirements

### Requirement: Tool registration and parameters

The extension SHALL register a tool named `question` via `pi.registerTool()`. The tool SHALL accept the following parameters:

- `question` (required, string): The question text displayed to the user.
- `options` (required, array of objects): Each option SHALL have:
  - `label` (string, required): Display label for the option.
  - `description` (string, optional): Description shown below the label.
    The first option in the array SHALL be treated as the agent's recommendation.

In non-interactive modes (when `ctx.hasUI` is false), the tool SHALL return an error message.

#### Scenario: Tool registers with correct name

- **WHEN** the extension is loaded
- **THEN** `pi.getAllTools()` SHALL include a tool with `name: "question"`.

#### Scenario: Tool returns error in non-UI mode

- **WHEN** the tool is called with `ctx.hasUI === false`
- **THEN** the tool SHALL return content `"Error: UI not available (running in non-interactive mode)"`.

### Requirement: Options list with recommended highlight

The tool SHALL display all options from the agent plus an automatically appended "Other" option at the end. The "Other" option SHALL have `isOther: true`.

The first option in the agent's `options` array SHALL be visually marked as recommended. The agent MUST ensure the recommended option is first.

The agent SHALL NOT include an "Other"/"Type something." option in their `options` array. The extension always appends it automatically.

#### Scenario: First option is visually marked as recommended

- **WHEN** the agent calls with `options` where the first item is `{ label: "Next.js" }`
- **THEN** the "Next.js" option SHALL be shown first in the list with a visual indicator marking it as recommended.

#### Scenario: Other is always appended last

- **WHEN** the agent provides `options` with 3 items
- **THEN** the UI SHALL display exactly 4 options: the 3 from the agent plus "Other" at the end.

### Requirement: Keyboard interaction modes

The tool SHALL support three interaction modes:

1. **Navigate**: Arrow keys (↑/↓) move selection. The "Other" option is selectable like any other.
2. **Confirm (Enter)**: If the selected option is a regular option, the tool SHALL return immediately with that answer. If the selected option is "Other", the tool SHALL enter text input mode.
3. **Comment (Space)**: If the selected option is a regular option, the tool SHALL select it and open a comment field. If the selected option is "Other", the tool SHALL enter text input mode (equivalent to Enter).
4. **Escape in list**: Cancels the question. Returns a cancelled result and aborts the current agent run.
5. **Escape in text/comment input**: Returns to the list without confirming.

#### Scenario: Enter on normal option confirms

- **WHEN** the user selects a normal option with cursor and presses Enter
- **THEN** the tool SHALL return with that option's label as the answer.

#### Scenario: Space on normal option opens comment

- **WHEN** the user selects a normal option and presses Space
- **THEN** the tool SHALL show a comment input field below the selected option. The user can type a comment and press Enter to confirm or Escape to return to the list.

#### Scenario: Enter/Space on Other opens text input

- **WHEN** the user selects the "Other" option and presses Enter or Space
- **THEN** the tool SHALL show a text input field where the user types their own answer.

#### Scenario: Escape cancels

- **WHEN** the user presses Escape in the option list
- **THEN** the tool SHALL return with cancelled state
- **AND** the current agent run SHALL be aborted.

#### Scenario: Escape in input returns to list

- **WHEN** the user is in a comment or text input field and presses Escape
- **THEN** the tool SHALL return to the option list without saving input.

### Requirement: Result shape

The tool SHALL return structured data to the LLM.

Normal selection:

```typescript
{
  content: [{ type: "text", text: "User selected: <label>" }],
  details: { question, options, answer: "<label>", wasCustom: false }
}
```

Normal selection with comment:

```typescript
{
  content: [{ type: "text", text: "User selected: <label>\nComment: <comment>" }],
  details: { question, options, answer: "<label>", comment: "<comment>", wasCustom: false }
}
```

Other (custom answer):

```typescript
{
  content: [{ type: "text", text: "User wrote: <text>" }],
  details: { question, options, answer: "<text>", wasCustom: true }
}
```

Cancelled:

```typescript
{
  content: [{ type: "text", text: "User cancelled the selection" }],
  details: { question, options, answer: null, cancelled: true },
  terminate: true
}
```

#### Scenario: Result includes answer and metadata

- **WHEN** the user selects "Next.js" via Enter
- **THEN** the returned details SHALL contain `answer: "Next.js"`, `wasCustom: false`, and no `comment`.

#### Scenario: Comment is included in result

- **WHEN** the user selects "Next.js" via Space and writes "Best ecosystem"
- **THEN** the returned details SHALL contain `answer: "Next.js"`, `comment: "Best ecosystem"`, `wasCustom: false`.

#### Scenario: Other returns custom answer

- **WHEN** the user selects Other and types "SvelteKit"
- **THEN** the returned details SHALL contain `answer: "SvelteKit"`, `wasCustom: true`.

#### Scenario: Cancelled result

- **WHEN** the user presses Escape
- **THEN** the returned details SHALL contain `answer: null` and `cancelled: true`
- **AND** the tool result SHALL set `terminate: true`
- **AND** the current agent run SHALL be aborted.

### Requirement: Custom TUI rendering

The tool SHALL provide `renderCall` and `renderResult` for custom display in the pi TUI.

`renderCall` SHALL show the tool name followed by the question text (word-wrapped if long).
`renderResult` SHALL show the answer with visual styling:

- Normal selection: green checkmark + answer label
- Selection with comment: green checkmark + answer + comment in quotes
- Custom answer: green checkmark + "(wrote)" prefix + answer text
- Cancelled: warning-colored "Cancelled"

#### Scenario: renderCall shows question

- **WHEN** the tool call is rendered
- **THEN** it SHALL display the tool name and the question text.

#### Scenario: renderResult shows styled answer

- **WHEN** the result is rendered after a normal selection
- **THEN** it SHALL show a green checkmark ("✓") followed by the answer label.
