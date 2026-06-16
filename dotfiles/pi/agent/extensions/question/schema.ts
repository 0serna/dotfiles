import { Type } from "typebox";

const OptionSchema = Type.Object({
  label: Type.String({
    description: "Brief, self-explanatory display label for the option",
  }),
});

export const QuestionParams = Type.Object({
  question: Type.String({
    description: "Concise question text to display to the user",
  }),
  options: Type.Array(OptionSchema, {
    description:
      "Options for the user to choose from. The first option is treated as your recommendation and will be visually marked.",
  }),
});
