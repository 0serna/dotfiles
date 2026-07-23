import type { AnswerEntry, MultiQuestionDetails } from "./types.ts";

type ToolResult = {
  content: { type: "text"; text: string }[];
  details: MultiQuestionDetails;
};

function answerLine(entry: AnswerEntry): string {
  if (entry.wasCustom) return `${entry.question}: user wrote: ${entry.answer}`;
  const comment = entry.comment ? `\nComment: ${entry.comment}` : "";
  return `${entry.question}: user selected: ${entry.answer}${comment}`;
}

function resultCancelled(): ToolResult {
  return {
    content: [{ type: "text", text: "User cancelled the selection" }],
    details: { answers: [], cancelled: true },
  };
}

function resultAnswers(answers: AnswerEntry[]): ToolResult {
  const text = answers.map(answerLine).join("\n");
  return {
    content: [{ type: "text", text }],
    details: { answers, cancelled: false },
  };
}

export function buildResult(answers: AnswerEntry[] | null): ToolResult {
  if (!answers) return resultCancelled();
  return resultAnswers(answers);
}
