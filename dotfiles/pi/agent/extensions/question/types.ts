export interface QuestionOption {
  label: string;
}

export interface QuestionInput {
  question: string;
  options: QuestionOption[];
}

export type DisplayOption = QuestionOption & { isOther?: boolean };

export interface AnswerEntry {
  question: string;
  options: string[];
  answer: string;
  wasCustom: boolean;
  comment?: string;
}

export interface MultiQuestionDetails {
  answers: AnswerEntry[];
  cancelled: boolean;
}

export type MultiResultValue =
  | { type: "answers"; answers: AnswerEntry[] }
  | { type: "cancel" };

export type UIState = {
  currentTab: number;
  optionIndex: number;
  editMode: "comment" | "other" | false;
};

export interface RenderView {
  isMulti: boolean;
  questions: { question: string; label: string }[];
  currentTab: number;
  answered: boolean[];
  allOptions: DisplayOption[];
  optionIndex: number;
  editMode: "comment" | "other" | false;
  reviewAnswers: AnswerEntry[];
  allAnswered: boolean;
  /** Index of the chosen option for the active question, or null if unanswered. */
  answeredIndex?: number | null;
  /** Comment (normal option) or custom text (Other) shown next to the chosen option. */
  answerNote?: string;
}
