import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({
    description:
      "Short one-line label. Ideally under 80 characters; omit descriptions and rationale.",
  }),
});

export const QuestionParams = Type.Object({
  question: Type.String({
    description:
      "Short one-line question. Ideally under 150 characters; put context in the assistant message before using this tool.",
  }),
  options: Type.Array(OptionSchema, {
    description:
      "Options for the user to choose from. Use short labels only. The first option is treated as your recommendation and will be visually marked.",
  }),
});
