import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import {
  type Editor,
  Text,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import type { DisplayOption, QuestionDetails } from "./types.ts";

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
  theme: Theme,
): string {
  const isSelected = index === selectedIndex;
  const isRecommended = !opt.isOther && index === 0;
  const prefix = optionPrefix(opt, index, isSelected, isCommentOpen, theme);
  return optionColor(prefix, opt, isSelected, isRecommended, theme);
}

function renderOptionLine(
  lines: string[],
  width: number,
  opt: DisplayOption,
  index: number,
  optionIndex: number,
  isCommentOpen: boolean,
  theme: Theme,
) {
  const line = buildOptionLine(opt, index, optionIndex, isCommentOpen, theme);
  lines.push(truncateToWidth(line, width));
}

function renderAllOptions(
  lines: string[],
  width: number,
  allOptions: DisplayOption[],
  optionIndex: number,
  isCommentMode: boolean,
  theme: Theme,
) {
  for (const [i, option] of allOptions.entries()) {
    renderOptionLine(
      lines,
      width,
      option,
      i,
      optionIndex,
      isCommentMode && i === optionIndex,
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

export function renderFrame(
  width: number,
  allOptions: DisplayOption[],
  optionIndex: number,
  editMode: "comment" | "other" | false,
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

export function renderCall(args: { question: string }, theme: Theme) {
  return new Text(
    theme.fg("toolTitle", "question ") + theme.fg("muted", args.question),
    0,
    0,
  );
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

export function renderResult(
  result: AgentToolResult<QuestionDetails>,
  _options: unknown,
  theme: Theme,
) {
  return renderDetails(result.details, theme);
}
