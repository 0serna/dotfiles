import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
  Text,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ===========================================================================
// Types
// ===========================================================================

interface OptionWithDesc {
  label: string;
  description?: string;
}

type DisplayOption = OptionWithDesc & { isOther?: boolean };

interface QuestionDetails {
  question: string;
  options: string[];
  recommended: string | null;
  answer: string | null;
  wasCustom?: boolean;
  comment?: string;
  cancelled?: boolean;
}

type ResultValue =
  | { type: "answer"; answer: string; wasCustom: boolean; comment?: string }
  | { type: "cancel" };

type Theme = { fg: (style: string, text: string) => string };

type UIComponent = {
  render: (w: number) => string[];
  handleInput: (d: string) => void;
  invalidate: () => void;
};

type UIContext = {
  hasUI: boolean;
  ui: {
    custom: <T>(
      factory: (
        tui: unknown,
        theme: Theme,
        kb: unknown,
        done: (v: T) => void,
      ) => UIComponent,
    ) => Promise<T>;
  };
};

// ===========================================================================
// Schemas
// ===========================================================================

const OptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below the label" }),
  ),
});

const QuestionParams = Type.Object({
  question: Type.String({
    description: "The question text to display to the user",
  }),
  options: Type.Array(OptionSchema, {
    description: "Options for the user to choose from",
  }),
  recommended: Type.String({
    description: "Label of the option you recommend.",
  }),
});

// ===========================================================================
// Option line rendering
// ===========================================================================

function optionPrefix(
  opt: DisplayOption,
  index: number,
  isSelected: boolean,
  isCommentOpen: boolean,
  theme: Theme,
): string {
  if (!isSelected) return `  ${index + 1}. ${opt.label}`;
  if (isCommentOpen)
    return theme.fg("accent", `> ${index + 1}. ${opt.label} ✎`);
  return theme.fg("accent", `> ${index + 1}. ${opt.label}`);
}

function optionColor(
  text: string,
  opt: DisplayOption,
  isSelected: boolean,
  isRecommended: boolean,
  theme: Theme,
): string {
  if (opt.isOther) return theme.fg("muted", text);
  const base = isSelected ? text : theme.fg("text", text);
  if (isRecommended) return base + theme.fg("success", " ★");
  return base;
}

function buildOptionLine(
  opt: DisplayOption,
  index: number,
  selectedIndex: number,
  isCommentOpen: boolean,
  recommendedLabel: string | null,
  theme: Theme,
): string {
  const isSelected = index === selectedIndex;
  const isRecommended = !opt.isOther && opt.label === recommendedLabel;
  const prefix = optionPrefix(opt, index, isSelected, isCommentOpen, theme);
  return optionColor(prefix, opt, isSelected, isRecommended, theme);
}

// ===========================================================================
// Frame rendering
// ===========================================================================

function renderOptionLine(
  lines: string[],
  width: number,
  opt: DisplayOption,
  index: number,
  optionIndex: number,
  isCommentOpen: boolean,
  recommendedLabel: string | null,
  theme: Theme,
) {
  const line = buildOptionLine(
    opt,
    index,
    optionIndex,
    isCommentOpen,
    recommendedLabel,
    theme,
  );
  lines.push(truncateToWidth(line, width));
  if (opt.description) {
    lines.push(
      truncateToWidth(`     ${theme.fg("muted", opt.description)}`, width),
    );
  }
}

function renderAllOptions(
  lines: string[],
  width: number,
  allOptions: DisplayOption[],
  optionIndex: number,
  isCommentMode: boolean,
  recommendedLabel: string | null,
  theme: Theme,
) {
  for (let i = 0; i < allOptions.length; i++) {
    renderOptionLine(
      lines,
      width,
      allOptions[i],
      i,
      optionIndex,
      isCommentMode && i === optionIndex,
      recommendedLabel,
      theme,
    );
  }
}

function renderEditorSection(
  lines: string[],
  width: number,
  editMode: "comment" | "other",
  editor: Editor,
  theme: Theme,
) {
  lines.push("");
  const label = editMode === "comment" ? " Comment:" : " Your answer:";
  lines.push(truncateToWidth(theme.fg("muted", label), width));
  for (const editorLine of editor.render(width - 2)) {
    lines.push(truncateToWidth(` ${editorLine}`, width));
  }
}

function renderFrame(
  width: number,
  allOptions: DisplayOption[],
  optionIndex: number,
  editMode: "comment" | "other" | false,
  recommendedLabel: string | null,
  editor: Editor,
  question: string,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(theme.fg("accent", "─".repeat(width)));
  const wrappedQuestion = wrapTextWithAnsi(
    theme.fg("text", `${question}`),
    width,
  );
  for (const wLine of wrappedQuestion) {
    lines.push(wLine);
  }
  lines.push("");

  renderAllOptions(
    lines,
    width,
    allOptions,
    optionIndex,
    editMode === "comment",
    recommendedLabel,
    theme,
  );

  if (editMode) {
    renderEditorSection(lines, width, editMode, editor, theme);
  }

  lines.push("");
  lines.push(
    truncateToWidth(
      editMode
        ? theme.fg("dim", " Enter to submit • Esc to go back")
        : theme.fg(
            "dim",
            " ↑↓ navigate • Enter to confirm • Space to add comment • Esc to cancel",
          ),
      width,
    ),
  );
  lines.push(theme.fg("accent", "─".repeat(width)));

  return lines;
}

// ===========================================================================
// Result building
// ===========================================================================

function makeBaseDetails(
  question: string,
  options: OptionWithDesc[],
  recommendedLabel: string | null,
) {
  return {
    question,
    options: options.map((o) => o.label),
    recommended: recommendedLabel,
  };
}

function resultCancelled(base: ReturnType<typeof makeBaseDetails>) {
  return {
    content: [{ type: "text" as const, text: "User cancelled the selection" }],
    details: { ...base, answer: null, cancelled: true } as QuestionDetails,
  };
}

function resultCustom(
  base: ReturnType<typeof makeBaseDetails>,
  answer: string,
) {
  return {
    content: [{ type: "text" as const, text: `User wrote: ${answer}` }],
    details: { ...base, answer, wasCustom: true } as QuestionDetails,
  };
}

function resultWithComment(
  base: ReturnType<typeof makeBaseDetails>,
  answer: string,
  comment: string,
) {
  return {
    content: [
      {
        type: "text" as const,
        text: `User selected: ${answer}\nComment: ${comment}`,
      },
    ],
    details: { ...base, answer, comment, wasCustom: false } as QuestionDetails,
  };
}

function resultNormal(
  base: ReturnType<typeof makeBaseDetails>,
  answer: string,
) {
  return {
    content: [{ type: "text" as const, text: `User selected: ${answer}` }],
    details: { ...base, answer, wasCustom: false } as QuestionDetails,
  };
}

function buildResultPrompted(
  base: ReturnType<typeof makeBaseDetails>,
  result: ResultValue,
) {
  if (result.wasCustom) return resultCustom(base, result.answer);
  if (result.comment)
    return resultWithComment(base, result.answer, result.comment);
  return resultNormal(base, result.answer);
}

function buildResult(
  result: ResultValue | null,
  question: string,
  options: OptionWithDesc[],
  recommendedLabel: string | null,
) {
  const base = makeBaseDetails(question, options, recommendedLabel);
  if (!result || result.type === "cancel") return resultCancelled(base);
  return buildResultPrompted(base, result);
}

// ===========================================================================
// Input handler helpers
// ===========================================================================

type UIState = {
  optionIndex: number;
  editMode: "comment" | "other" | false;
  selectedLabel: string | null;
};

function navigateUp(state: UIState): void {
  state.optionIndex = Math.max(0, state.optionIndex - 1);
}

function navigateDown(state: UIState, allOptions: DisplayOption[]): void {
  state.optionIndex = Math.min(allOptions.length - 1, state.optionIndex + 1);
}

function selectWithEnter(
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): void {
  const selected = allOptions[state.optionIndex];
  if (selected.isOther) {
    state.editMode = "other";
    state.selectedLabel = null;
  } else {
    done({ type: "answer", answer: selected.label, wasCustom: false });
  }
}

function selectWithSpace(state: UIState, allOptions: DisplayOption[]): void {
  const selected = allOptions[state.optionIndex];
  if (selected.isOther) {
    state.editMode = "other";
    state.selectedLabel = null;
  } else {
    state.editMode = "comment";
    state.selectedLabel = selected.label;
  }
}

function cancelSelection(done: (v: ResultValue) => void): void {
  done({ type: "cancel" });
}

function handleNavigation(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
): boolean {
  if (matchesKey(key, Key.up)) {
    navigateUp(state);
    return true;
  }
  if (matchesKey(key, Key.down)) {
    navigateDown(state, allOptions);
    return true;
  }
  return false;
}

function handleAction(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): boolean {
  if (matchesKey(key, Key.enter)) {
    selectWithEnter(state, allOptions, done);
    return true;
  }
  if (matchesKey(key, Key.space)) {
    selectWithSpace(state, allOptions);
    return true;
  }
  if (matchesKey(key, Key.escape)) {
    cancelSelection(done);
    return true;
  }
  return false;
}

function handleKey(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): boolean {
  return (
    handleNavigation(key, state, allOptions) ||
    handleAction(key, state, allOptions, done)
  );
}

// ===========================================================================
// Result rendering helpers
// ===========================================================================

function renderCancelled(theme: Theme): Text {
  return new Text(theme.fg("warning", "Cancelled"), 0, 0);
}

function renderCustomAnswer(theme: Theme, answer: string): Text {
  return new Text(
    theme.fg("success", "✓ ") +
      theme.fg("muted", "(wrote) ") +
      theme.fg("accent", answer),
    0,
    0,
  );
}

function renderWithComment(
  theme: Theme,
  answer: string,
  comment: string,
): Text {
  return new Text(
    theme.fg("success", "✓ ") +
      theme.fg("accent", answer) +
      theme.fg("dim", '  —  "') +
      theme.fg("muted", comment) +
      theme.fg("dim", '"'),
    0,
    0,
  );
}

function renderNormalAnswer(theme: Theme, answer: string): Text {
  return new Text(theme.fg("success", "✓ ") + theme.fg("accent", answer), 0, 0);
}

// ===========================================================================
// Tool execution
// ===========================================================================

async function execute(
  _toolCallId: unknown,
  params: { question: string; options: OptionWithDesc[]; recommended: string },
  _signal: unknown,
  _onUpdate: unknown,
  ctx: UIContext,
) {
  if (!ctx.hasUI) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: UI not available (running in non-interactive mode)",
        },
      ],
      details: {
        question: params.question,
        options: params.options.map((o) => o.label),
        recommended: params.recommended,
        answer: null,
      } as QuestionDetails,
    };
  }

  const sortedOptions = [...params.options];
  const recIndex = sortedOptions.findIndex(
    (o) => o.label === params.recommended,
  );
  if (recIndex > 0) {
    const [rec] = sortedOptions.splice(recIndex, 1);
    sortedOptions.unshift(rec);
  }
  const recommendedLabel = recIndex >= 0 ? params.recommended : null;

  const allOptions: DisplayOption[] = [
    ...sortedOptions,
    { label: "Other", isOther: true },
  ];

  const result = await ctx.ui.custom<ResultValue>((tui, theme, _kb, done) => {
    const editorTheme: EditorTheme = {
      borderColor: (s: string) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t: string) => theme.fg("accent", t),
        selectedText: (t: string) => theme.fg("accent", t),
        description: (t: string) => theme.fg("muted", t),
        scrollInfo: (t: string) => theme.fg("dim", t),
        noMatch: (t: string) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    const state: UIState = {
      optionIndex: 0,
      editMode: false,
      selectedLabel: null,
    };
    let cachedLines: string[] | undefined;

    editor.onSubmit = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        state.editMode = false;
        state.selectedLabel = null;
        editor.setText("");
        refresh();
        return;
      }
      if (state.editMode === "comment" && state.selectedLabel) {
        done({
          type: "answer",
          answer: state.selectedLabel,
          wasCustom: false,
          comment: trimmed,
        });
      } else {
        done({ type: "answer", answer: trimmed, wasCustom: true });
      }
    };

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      cachedLines = renderFrame(
        width,
        allOptions,
        state.optionIndex,
        state.editMode,
        recommendedLabel,
        editor,
        params.question,
        theme,
      );
      return cachedLines;
    }

    function handleInput(data: string) {
      if (state.editMode) {
        handleEditorInput(data);
        return;
      }
      handleListInput(data);
    }

    function handleEditorInput(data: string) {
      if (matchesKey(data, Key.escape)) {
        state.editMode = false;
        state.selectedLabel = null;
        editor.setText("");
        refresh();
        return;
      }
      editor.handleInput(data);
      refresh();
    }

    function handleListInput(data: string) {
      const handled = handleKey(data, state, allOptions, done);
      if (handled) refresh();
    }
  });

  return buildResult(result, params.question, params.options, recommendedLabel);
}

// ===========================================================================
// TUI rendering
// ===========================================================================

function renderCall(args: { question: string }, theme: Theme) {
  return new Text(
    theme.fg("toolTitle", "question ") + theme.fg("muted", args.question),
    0,
    0,
  );
}

function renderResultFallback(result: {
  content: Array<{ type: string; text: string }>;
}): Text {
  const text = result.content[0];
  return new Text(text?.type === "text" ? text.text : "", 0, 0);
}

function renderAnswered(details: QuestionDetails, theme: Theme) {
  const answer = details.answer ?? "";
  if (details.wasCustom) return renderCustomAnswer(theme, answer);
  if (details.comment) return renderWithComment(theme, answer, details.comment);
  return renderNormalAnswer(theme, answer);
}

function renderDetails(details: QuestionDetails, theme: Theme) {
  if (details.cancelled) return renderCancelled(theme);
  return renderAnswered(details, theme);
}

function renderResult(
  result: { content: Array<{ type: string; text: string }>; details: unknown },
  _options: unknown,
  theme: Theme,
) {
  const details = result.details as QuestionDetails | undefined;
  if (!details) return renderResultFallback(result);
  return renderDetails(details, theme);
}

// ===========================================================================
// Extension Entry Point
// ===========================================================================

export default function question(pi: ExtensionAPI) {
  pi.registerTool({
    name: "question",
    label: "Question",
    description:
      'Ask the user a question with customizable options and let them pick from the list. You must mark one option as recommended. The extension automatically adds an "Other" option for free-form input. Use when you need user input to proceed.',
    parameters: QuestionParams,
    execute,
    renderCall,
    renderResult,
  });
}
