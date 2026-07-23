import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
} from "@earendil-works/pi-tui";
import { isTuiMode } from "../shared/mode.ts";

import { renderFrame } from "./rendering.ts";
import { buildResult } from "./results.ts";
import type {
  AnswerEntry,
  DisplayOption,
  MultiQuestionDetails,
  MultiResultValue,
  QuestionInput,
  RenderView,
  UIState,
} from "./types.ts";

type QuestionState = {
  selectedIndex: number | null;
  comment?: string;
  customText?: string;
};

export function allAnswered(flags: boolean[]): boolean {
  return flags.length > 0 && flags.every(Boolean);
}

export async function execute(
  _toolCallId: unknown,
  params: { questions: QuestionInput[] },
  _signal: unknown,
  _onUpdate: unknown,
  ctx: ExtensionContext,
): Promise<
  | { content: { type: "text"; text: string }[]; details: MultiQuestionDetails }
  | {
      content: { type: "text"; text: string }[];
      details: MultiQuestionDetails;
      terminate: true;
    }
> {
  const questions = params.questions;

  if (!isTuiMode(ctx)) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: UI not available (question requires TUI mode)",
        },
      ],
      details: { answers: [], cancelled: false },
    };
  }

  const isMulti = questions.length > 1;
  const totalTabs = questions.length + (isMulti ? 1 : 0);

  // Per-question editable state, preserved when navigating between tabs.
  const questionStates: QuestionState[] = questions.map(() => ({
    selectedIndex: null,
  }));

  const result = await ctx.ui.custom<MultiResultValue | undefined>(
    (tui, theme, _kb, done) => {
      const editorTheme: EditorTheme = {
        borderColor: (s: string) => theme.fg("accent", s),
        selectList: {
          selectedPrefix: (t: string) => theme.fg("accent", t),
          selectedText: (t: string) => theme.fg("accent", t),
          description: (t: string) => theme.fg("muted", t),
          scrollInfo: (t: string) => theme.fg("dim", t),
          noMatch: (t: string) => theme.fg("warning", t),
        },
      };
      const editor = new Editor(tui, editorTheme);

      const state: UIState = {
        currentTab: 0,
        optionIndex: 0,
        editMode: false,
      };
      let cachedLines: string[] | undefined;

      function refresh(): void {
        cachedLines = undefined;
        tui.requestRender();
      }

      function otherIndex(question: QuestionInput): number {
        return question.options.length;
      }

      function currentQuestion(): QuestionInput | undefined {
        return questions[state.currentTab]!;
      }

      function currentOptions(): DisplayOption[] {
        const question = currentQuestion();
        if (!question) return [];
        return [...question.options, { label: "Other", isOther: true }];
      }

      function answeredFlags(): boolean[] {
        return questionStates.map((s) => s.selectedIndex !== null);
      }

      function buildAnswers(): AnswerEntry[] {
        const out: AnswerEntry[] = [];
        for (let i = 0; i < questions.length; i++) {
          const s = questionStates[i]!;
          if (s.selectedIndex === null) continue;
          const question = questions[i]!;
          if (s.selectedIndex === otherIndex(question)) {
            out.push({
              question: question.question,
              options: question.options.map((o) => o.label),
              answer: s.customText ?? "",
              wasCustom: true,
            });
          } else {
            out.push({
              question: question.question,
              options: question.options.map((o) => o.label),
              answer: question.options[s.selectedIndex]!.label,
              wasCustom: false,
              comment: s.comment,
            });
          }
        }
        return out;
      }

      function focusTab(tab: number): void {
        state.currentTab = tab;
        state.optionIndex = questionStates[tab]?.selectedIndex ?? 0;
        refresh();
      }

      function submit(): void {
        done({ type: "answers", answers: buildAnswers() });
      }

      function cancel(): void {
        done({ type: "cancel" });
      }

      function advanceAfterAnswer(): void {
        if (!isMulti) {
          submit();
          return;
        }
        if (state.currentTab < questions.length - 1) {
          focusTab(state.currentTab + 1);
        } else {
          focusTab(questions.length);
        }
      }

      function openOther(): void {
        state.editMode = "other";
        editor.setText(questionStates[state.currentTab]!.customText ?? "");
        refresh();
      }

      editor.onSubmit = (value: string) => {
        const trimmed = value.trim();
        const s = questionStates[state.currentTab]!;
        if (state.editMode === "comment") {
          s.comment = trimmed ? trimmed : undefined;
          state.editMode = false;
          editor.setText("");
          if (trimmed) {
            advanceAfterAnswer();
          } else {
            refresh();
          }
          return;
        }
        // "Other" free-text mode
        if (!trimmed) {
          state.editMode = false;
          editor.setText("");
          refresh();
          return;
        }
        s.selectedIndex = otherIndex(questions[state.currentTab]!);
        s.customText = trimmed;
        state.editMode = false;
        editor.setText("");
        advanceAfterAnswer();
      };

      function handleInput(data: string): void {
        if (state.editMode) {
          if (matchesKey(data, Key.escape)) {
            state.editMode = false;
            editor.setText("");
            refresh();
            return;
          }
          editor.handleInput(data);
          refresh();
          return;
        }

        if (isMulti) {
          if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
            focusTab((state.currentTab + 1) % totalTabs);
            return;
          }
          if (
            matchesKey(data, Key.shift("tab")) ||
            matchesKey(data, Key.left)
          ) {
            focusTab((state.currentTab - 1 + totalTabs) % totalTabs);
            return;
          }
        }

        if (isMulti && state.currentTab === questions.length) {
          if (matchesKey(data, Key.enter) && allAnswered(answeredFlags())) {
            submit();
          } else if (matchesKey(data, Key.escape)) {
            cancel();
          }
          return;
        }

        const opts = currentOptions();
        if (matchesKey(data, Key.up)) {
          state.optionIndex = Math.max(0, state.optionIndex - 1);
          refresh();
          return;
        }
        if (matchesKey(data, Key.down)) {
          state.optionIndex = Math.min(opts.length - 1, state.optionIndex + 1);
          refresh();
          return;
        }

        const question = currentQuestion();
        const opt = opts[state.optionIndex];
        if (matchesKey(data, Key.enter)) {
          if (!question || !opt) return;
          if (opt.isOther) {
            openOther();
            return;
          }
          const s = questionStates[state.currentTab]!;
          s.selectedIndex = state.optionIndex;
          s.comment = undefined;
          advanceAfterAnswer();
          return;
        }
        if (matchesKey(data, Key.space)) {
          if (!question || !opt) return;
          if (opt.isOther) {
            openOther();
            return;
          }
          const s = questionStates[state.currentTab]!;
          s.selectedIndex = state.optionIndex;
          state.editMode = "comment";
          editor.setText(s.comment ?? "");
          refresh();
          return;
        }
        if (matchesKey(data, Key.escape)) {
          cancel();
        }
      }

      function buildView(): RenderView {
        const onSubmitTab = isMulti && state.currentTab === questions.length;
        const activeQuestion = onSubmitTab
          ? null
          : questions[state.currentTab]!;
        const flags = answeredFlags();
        const s = onSubmitTab ? null : questionStates[state.currentTab]!;
        const activeOther = activeQuestion ? otherIndex(activeQuestion) : -1;
        return {
          isMulti,
          questions: questions.map((q, i) => ({
            question: q.question,
            label: `Q${i + 1}`,
          })),
          currentTab: state.currentTab,
          answered: flags,
          allOptions: currentOptions(),
          optionIndex: state.optionIndex,
          editMode: state.editMode,
          reviewAnswers: buildAnswers(),
          allAnswered: allAnswered(flags),
          answeredIndex: s ? s.selectedIndex : null,
          answerNote:
            s && s.selectedIndex !== null
              ? s.selectedIndex === activeOther
                ? s.customText
                : s.comment
              : undefined,
        };
      }

      function render(width: number): string[] {
        if (cachedLines) return cachedLines;
        const view = buildView();
        const editorText = state.editMode
          ? editor.render(Math.max(1, width - 2)).join("\n")
          : "";
        cachedLines = renderFrame(width, view, editorText, theme);
        return cachedLines;
      }

      return {
        render,
        invalidate: () => {
          cachedLines = undefined;
        },
        handleInput,
      };
    },
  );

  const toolResult = buildResult(
    result && result.type === "answers" ? result.answers : null,
  );

  if (!result || result.type === "cancel") {
    ctx.abort();
    return { ...toolResult, terminate: true };
  }

  return toolResult;
}
