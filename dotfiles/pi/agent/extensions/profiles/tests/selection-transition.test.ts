import { describe, expect, it } from "vitest";
import {
  createTransitionState,
  reduceTransition,
  type TransitionView,
} from "../selection-transition.ts";
import type { ThinkingLevel } from "../types.ts";

const emptyView: TransitionView = {
  getRememberedLevel: () => undefined,
};

function viewFrom(memory: Record<string, ThinkingLevel>): TransitionView {
  return { getRememberedLevel: (id) => memory[id] };
}

describe("selection transition reducer", () => {
  it("applies the remembered level and persists a selection on manual model pick", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "set",
        provider: "user",
        modelId: "b",
        currentLevel: "medium",
      },
      viewFrom({ "user/b": "high" }),
    );
    expect(result.state.activeModelId).toBe("user/b");
    expect(result.effects).toEqual([
      { kind: "apply_thinking_level", level: "high" },
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "b",
        thinkingLevel: "high",
      },
    ]);
  });

  it("applies the remembered level even when it matches the current Pi level", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "set",
        provider: "user",
        modelId: "b",
        currentLevel: "high",
      },
      viewFrom({ "user/b": "high" }),
    );
    expect(result.effects).toEqual([
      { kind: "apply_thinking_level", level: "high" },
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "b",
        thinkingLevel: "high",
      },
    ]);
  });

  it("persists a selection without apply when there is no remembered level", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "cycle",
        provider: "user",
        modelId: "b",
        currentLevel: "low",
      },
      emptyView,
    );
    expect(result.effects).toEqual([
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "b",
        thinkingLevel: "low",
      },
    ]);
    expect(result.state.activeModelId).toBe("user/b");
  });

  it("ignores non-manual model selections", () => {
    const state = createTransitionState();
    const result = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "other",
        provider: "user",
        modelId: "a",
        currentLevel: "high",
      },
      viewFrom({ "user/a": "high" }),
    );
    expect(result.effects).toEqual([]);
    expect(result.state.activeModelId).toBe("user/a");
  });

  it("persists a manual thinking-level selection for the active model", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "xhigh",
        provider: "user",
        modelId: "a",
      },
      emptyView,
    );
    expect(result.effects).toEqual([
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "a",
        thinkingLevel: "xhigh",
      },
    ]);
  });

  it("treats a thinking-level event after the model identity changes as an automatic clamp", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "xhigh",
        provider: "user",
        modelId: "b",
      },
      emptyView,
    );
    expect(result.effects).toEqual([]);
    expect(result.state.activeModelId).toBe("user/b");
  });

  it("ignores thinking-level events whose level is not in the supported enum", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const result = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "max",
        provider: "user",
        modelId: "a",
      },
      emptyView,
    );
    expect(result.effects).toEqual([]);
    expect(result.state.activeModelId).toBe("user/a");
  });

  it("suppresses persistence while the extension is restoring a selection", () => {
    let state = createTransitionState();
    state = reduceTransition(
      state,
      { kind: "suppress_manual_persistence" },
      emptyView,
    ).state;
    const result = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "high",
        provider: "user",
        modelId: "a",
      },
      emptyView,
    );
    expect(result.effects).toEqual([]);
    expect(result.state.suppressManualPersistence).toBe(true);
  });

  it("releases suppression and resumes manual persistence", () => {
    let state = createTransitionState();
    state = reduceTransition(
      state,
      { kind: "suppress_manual_persistence" },
      emptyView,
    ).state;
    state = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "set",
        provider: "user",
        modelId: "a",
        currentLevel: "high",
      },
      emptyView,
    ).state;
    state = reduceTransition(
      state,
      { kind: "release_manual_persistence" },
      emptyView,
    ).state;
    const result = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "low",
        provider: "user",
        modelId: "a",
      },
      emptyView,
    );
    expect(result.effects).toEqual([
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "a",
        thinkingLevel: "low",
      },
    ]);
  });

  it("handles repeated model switches: clamp xhigh, model_select, restore high", () => {
    let state = createTransitionState();
    state = { ...state, activeModelId: "user/a" };
    const view = viewFrom({ "user/b": "high" });

    // The automatic clamp arrives after the model identity changes.
    const clamp = reduceTransition(
      state,
      {
        kind: "thinking_level_selected",
        level: "xhigh",
        provider: "user",
        modelId: "b",
      },
      view,
    );
    expect(clamp.effects).toEqual([]);
    state = clamp.state;

    // The corresponding model_select arrives and the reducer applies the
    // remembered "high" level.
    const select = reduceTransition(
      state,
      {
        kind: "model_selected",
        source: "set",
        provider: "user",
        modelId: "b",
        currentLevel: "xhigh",
      },
      view,
    );
    expect(select.effects).toEqual([
      { kind: "apply_thinking_level", level: "high" },
      {
        kind: "persist_selection",
        provider: "user",
        modelId: "b",
        thinkingLevel: "high",
      },
    ]);
  });
});
