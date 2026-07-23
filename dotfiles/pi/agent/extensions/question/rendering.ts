import type { AgentToolResult, Theme } from "@earendil-works/pi-coding-agent";
import {
  Text,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui";

import type {
  DisplayOption,
  MultiQuestionDetails,
  RenderView,
} from "./types.ts";

function renderOptionLine(
  lines: string[],
  width: number,
  opt: DisplayOption,
  index: number,
  optionIndex: number,
  answeredIndex: number | null | undefined,
  answerNote: string | undefined,
  theme: Theme,
): void {
  const isCursor = index === optionIndex;
  const isAnswered = answeredIndex !== null && index === answeredIndex;
  const isRecommended = !opt.isOther && index === 0;
  const labelText =
    isAnswered && opt.isOther && answerNote ? answerNote : opt.label;
  const prefix = isCursor
    ? theme.fg("accent", `> ${index + 1}. ${labelText}`)
    : `  ${index + 1}. ${labelText}`;
  let line = prefix;
  if (isRecommended) line += theme.fg("success", " ★");
  if (isAnswered) {
    line += theme.fg("success", " ✓");
    if (answerNote) line += theme.fg("muted", ` "${answerNote}"`);
  }
  lines.push(truncateToWidth(line, width));
}

function renderTabBar(
  lines: string[],
  width: number,
  view: RenderView,
  theme: Theme,
): void {
  const tabs: string[] = [" ← "];
  for (let i = 0; i < view.questions.length; i++) {
    const isActive = i === view.currentTab;
    const isAnswered = view.answered[i];
    const box = isAnswered ? "■" : "□";
    const color = isAnswered ? "success" : "muted";
    const text = ` ${box} ${view.questions[i]?.label ?? ""} `;
    const styled = isActive
      ? theme.bg("selectedBg", theme.fg("text", text))
      : theme.fg(color, text);
    tabs.push(`${styled} `);
  }
  const isSubmitTab = view.currentTab === view.questions.length;
  const submitText = " ✓ Submit ";
  const submitStyled = isSubmitTab
    ? theme.bg("selectedBg", theme.fg("text", submitText))
    : theme.fg(view.allAnswered ? "success" : "dim", submitText);
  tabs.push(`${submitStyled} →`);
  lines.push(truncateToWidth(" " + tabs.join(""), width));
  lines.push("");
}

export function renderFrame(
  width: number,
  view: RenderView,
  editorText: string,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  lines.push(theme.fg("accent", "─".repeat(width)));

  if (view.isMulti) {
    renderTabBar(lines, width, view, theme);
  }

  const onSubmitTab = view.isMulti && view.currentTab === view.questions.length;

  if (view.editMode) {
    const question = view.questions[view.currentTab]?.question ?? "";
    lines.push(...wrapTextWithAnsi(theme.fg("text", question), width));
    lines.push("");
    lines.push(
      truncateToWidth(
        theme.fg(
          "muted",
          view.editMode === "comment" ? " Comment:" : " Your answer:",
        ),
        width,
      ),
    );
    for (const editorLine of editorText.split("\n")) {
      lines.push(truncateToWidth(` ${editorLine}`, width));
    }
    lines.push("");
    lines.push(
      truncateToWidth(
        theme.fg("dim", " Enter to submit • Esc to go back"),
        width,
      ),
    );
  } else if (onSubmitTab) {
    lines.push(
      ...wrapTextWithAnsi(
        theme.fg("accent", theme.bold("Ready to submit")),
        width,
      ),
    );
    lines.push("");
    if (view.allAnswered) {
      for (const answer of view.reviewAnswers) {
        lines.push(
          ...wrapTextWithAnsi(theme.fg("muted", answer.question), width),
        );
        const answerBody = answer.wasCustom
          ? `(wrote) ${answer.answer}`
          : answer.answer;
        const note = answer.comment
          ? theme.fg("muted", `  —  "${answer.comment}"`)
          : "";
        lines.push(
          ...wrapTextWithAnsi(theme.fg("text", answerBody) + note, width),
        );
      }
      lines.push("");
      lines.push(
        truncateToWidth(theme.fg("success", "Press Enter to submit"), width),
      );
    } else {
      const missing = view.questions
        .filter((_, i) => !view.answered[i])
        .map((q) => q.label)
        .join(", ");
      lines.push(
        truncateToWidth(theme.fg("warning", `Unanswered: ${missing}`), width),
      );
    }
  } else {
    const question = view.questions[view.currentTab]?.question ?? "";
    lines.push(...wrapTextWithAnsi(theme.fg("text", question), width));
    lines.push("");
    for (const [i, option] of view.allOptions.entries()) {
      renderOptionLine(
        lines,
        width,
        option,
        i,
        view.optionIndex,
        view.answeredIndex,
        view.answerNote,
        theme,
      );
    }
  }

  lines.push("");
  if (!view.editMode) {
    const help = view.isMulti
      ? "Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
      : "↑↓ navigate • Enter select • Esc cancel";
    lines.push(truncateToWidth(theme.fg("dim", help), width));
  }
  lines.push(theme.fg("accent", "─".repeat(width)));

  return lines;
}

export function renderCall(
  _args: { questions: { question: string }[] },
  theme: Theme,
) {
  return new Text(theme.fg("toolTitle", "question"), 0, 0);
}

function renderAnswered(details: MultiQuestionDetails, theme: Theme): Text {
  const blocks = details.answers.map((answer) => {
    const lines: string[] = [theme.fg("muted", answer.question)];
    const answerBody = answer.wasCustom
      ? theme.fg("muted", "(wrote) ") + answer.answer
      : answer.answer;
    const note = answer.comment
      ? theme.fg("muted", `  —  "${answer.comment}"`)
      : "";
    lines.push(theme.fg("success", "✓ ") + answerBody + note);
    return lines.join("\n");
  });
  return new Text(blocks.join("\n\n"), 0, 0);
}

export function renderResult(
  result: AgentToolResult<MultiQuestionDetails>,
  _options: unknown,
  theme: Theme,
) {
  const details = result.details;
  if (!details || details.cancelled) {
    return new Text(theme.fg("warning", "Cancelled"), 0, 0);
  }
  return renderAnswered(details, theme);
}
