import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({
    description:
      "Short one-line label. Ideally under 80 characters; omit descriptions and rationale.",
  }),
});

const QuestionSchema = Type.Object({
  question: Type.String({
    description:
      "Short one-line question. Ideally under 150 characters; put context in the assistant message before using this tool.",
  }),
  options: Type.Array(OptionSchema, {
    description:
      "Options for this question. Use short labels only. The first option is treated as your recommendation and will be visually marked.",
  }),
});

export const QuestionParams = Type.Object({
  questions: Type.Array(QuestionSchema, {
    description:
      "One or more questions to ask in a single call. With more than one, each is shown as a tab and a trailing Submit tab confirms all answers.",
    minItems: 1,
  }),
});
