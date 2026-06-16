import type { QuestionDetails, QuestionOption, ResultValue } from "./types.ts";

function makeBaseDetails(question: string, options: QuestionOption[]) {
  return {
    question,
    options: options.map((o) => o.label),
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
  result: Extract<ResultValue, { type: "answer" }>,
) {
  if (result.wasCustom) return resultCustom(base, result.answer);
  if (result.comment)
    return resultWithComment(base, result.answer, result.comment);
  return resultNormal(base, result.answer);
}

export function buildResult(
  result: ResultValue | null,
  question: string,
  options: QuestionOption[],
) {
  const base = makeBaseDetails(question, options);
  if (!result || result.type === "cancel") return resultCancelled(base);
  return buildResultPrompted(base, result);
}
