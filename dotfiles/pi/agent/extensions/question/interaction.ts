import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  Editor,
  type EditorTheme,
  Key,
  matchesKey,
} from "@earendil-works/pi-tui";

import { renderFrame } from "./rendering.ts";
import { buildResult } from "./results.ts";
import type {
  DisplayOption,
  QuestionDetails,
  QuestionOption,
  ResultValue,
  UIState,
} from "./types.ts";

function navigateUp(state: UIState): void {
  state.optionIndex = Math.max(0, state.optionIndex - 1);
}

function navigateDown(state: UIState, allOptions: DisplayOption[]): void {
  state.optionIndex = Math.min(allOptions.length - 1, state.optionIndex + 1);
}

function selectWithEnter(
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): void {
  const selected = allOptions[state.optionIndex];
  if (!selected) return;
  if (selected.isOther) {
    state.editMode = "other";
    state.selectedLabel = null;
  } else {
    done({ type: "answer", answer: selected.label, wasCustom: false });
  }
}

function selectWithSpace(state: UIState, allOptions: DisplayOption[]): void {
  const selected = allOptions[state.optionIndex];
  if (!selected) return;
  if (selected.isOther) {
    state.editMode = "other";
    state.selectedLabel = null;
  } else {
    state.editMode = "comment";
    state.selectedLabel = selected.label;
  }
}

function handleNavigation(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
): boolean {
  if (matchesKey(key, Key.up)) {
    navigateUp(state);
    return true;
  }
  if (matchesKey(key, Key.down)) {
    navigateDown(state, allOptions);
    return true;
  }
  return false;
}

function handleAction(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): boolean {
  if (matchesKey(key, Key.enter)) {
    selectWithEnter(state, allOptions, done);
    return true;
  }
  if (matchesKey(key, Key.space)) {
    selectWithSpace(state, allOptions);
    return true;
  }
  if (matchesKey(key, Key.escape)) {
    done({ type: "cancel" });
    return true;
  }
  return false;
}

function handleKey(
  key: string,
  state: UIState,
  allOptions: DisplayOption[],
  done: (v: ResultValue) => void,
): boolean {
  return (
    handleNavigation(key, state, allOptions) ||
    handleAction(key, state, allOptions, done)
  );
}

export async function execute(
  _toolCallId: unknown,
  params: { question: string; options: QuestionOption[] },
  _signal: unknown,
  _onUpdate: unknown,
  ctx: ExtensionContext,
) {
  if (!ctx.hasUI) {
    return {
      content: [
        {
          type: "text" as const,
          text: "Error: UI not available (running in non-interactive mode)",
        },
      ],
      details: {
        question: params.question,
        options: params.options.map((o) => o.label),
        answer: null,
      } as QuestionDetails,
    };
  }

  const allOptions: DisplayOption[] = [
    ...params.options,
    { label: "Other", isOther: true },
  ];

  const result = await ctx.ui.custom<ResultValue>((tui, theme, _kb, done) => {
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
      optionIndex: 0,
      editMode: false,
      selectedLabel: null,
    };
    let cachedLines: string[] | undefined;

    editor.onSubmit = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        state.editMode = false;
        state.selectedLabel = null;
        editor.setText("");
        refresh();
        return;
      }
      if (state.editMode === "comment" && state.selectedLabel) {
        done({
          type: "answer",
          answer: state.selectedLabel,
          wasCustom: false,
          comment: trimmed,
        });
      } else {
        done({ type: "answer", answer: trimmed, wasCustom: true });
      }
    };

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;
      cachedLines = renderFrame(
        width,
        allOptions,
        state.optionIndex,
        state.editMode,
        editor,
        params.question,
        theme,
      );
      return cachedLines;
    }

    function handleInput(data: string) {
      if (state.editMode) {
        handleEditorInput(data);
        return;
      }
      handleListInput(data);
    }

    function handleEditorInput(data: string) {
      if (matchesKey(data, Key.escape)) {
        state.editMode = false;
        state.selectedLabel = null;
        editor.setText("");
        refresh();
        return;
      }
      editor.handleInput(data);
      refresh();
    }

    function handleListInput(data: string) {
      const handled = handleKey(data, state, allOptions, done);
      if (handled) refresh();
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });

  return buildResult(result, params.question, params.options);
}
