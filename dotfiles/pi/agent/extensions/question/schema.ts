import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({ description: "Display label for the option" }),
  description: Type.Optional(
    Type.String({ description: "Optional description shown below the label" }),
  ),
});

export const QuestionParams = Type.Object({
  question: Type.String({
    description: "The question text to display to the user",
  }),
  options: Type.Array(OptionSchema, {
    description:
      "Options for the user to choose from. The first option is treated as your recommendation and will be visually marked.",
  }),
});
