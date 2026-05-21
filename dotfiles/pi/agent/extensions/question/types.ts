export interface OptionWithDesc {
  label: string;
  description?: string;
}

export type DisplayOption = OptionWithDesc & { isOther?: boolean };

export interface QuestionDetails {
  question: string;
  options: string[];
  answer: string | null;
  wasCustom?: boolean;
  comment?: string;
  cancelled?: boolean;
}

export type ResultValue =
  | { type: "answer"; answer: string; wasCustom: boolean; comment?: string }
  | { type: "cancel" };

export type UIState = {
  optionIndex: number;
  editMode: "comment" | "other" | false;
  selectedLabel: string | null;
};
