import { isValidThinkingLevel, type ThinkingLevel } from "./types.ts";

/**
 * The internal state of the transition coordinator. It tracks the last
 * model identity we observed and whether selection events should be
 * treated as manual preferences (i.e. ignored while the extension is
 * restoring a route or session-start selection).
 */
export interface TransitionState {
  /**
   * The model identity we last attributed an event to, in
   * `provider/model` form. This is the basis for detecting automatic
   * clamps that arrive before Pi's `model_select` for a manual switch.
   */
  activeModelId: string | undefined;
  /**
   * When true, model and thinking-level events are caused by the
   * extension itself (route activation, route restoration, or
   * session-start restoration) and MUST NOT update manual preferences.
   */
  suppressManualPersistence: boolean;
}

export function createTransitionState(): TransitionState {
  return { activeModelId: undefined, suppressManualPersistence: false };
}

/**
 * The view of the session's manual thinking memory that the reducer needs to
 * evaluate facts. The coordinator supplies it so the reducer stays pure and
 * free of filesystem dependencies.
 */
export interface TransitionView {
  getRememberedLevel(modelId: string): ThinkingLevel | undefined;
}

/**
 * Normalized facts the reducer consumes. The adapter in `route-session.ts`
 * converts Pi events into one of these before calling the reducer.
 *
 * `currentLevel` carries the active thinking level at the time of the
 * fact. The reducer needs it to emit a `persist_selection` effect for
 * manual model selections: Pi may have already adjusted the level in
 * response to the model change, and both the session snapshot and published
 * persisted snapshot must reflect what the user effectively settled on.
 */
type TransitionFact =
  | {
      kind: "model_selected";
      source: ModelSelectionSource;
      provider: string;
      modelId: string;
      currentLevel: ThinkingLevel;
    }
  | {
      kind: "thinking_level_selected";
      level: string;
      provider: string;
      modelId: string;
    }
  | { kind: "suppress_manual_persistence" }
  | { kind: "release_manual_persistence" };

export type ModelSelectionSource = "set" | "cycle" | "other";

/**
 * Effects the reducer asks the coordinator to perform. The reducer never
 * writes files, calls Pi, or touches external state.
 */
export type TransitionEffect =
  | { kind: "apply_thinking_level"; level: ThinkingLevel }
  | {
      kind: "persist_selection";
      provider: string;
      modelId: string;
      thinkingLevel: ThinkingLevel;
    };

/**
 * Reduce a fact against the current state. The reducer is pure: given the
 * same inputs it always produces the same `(state, effects)` pair.
 *
 * The clamp rule is encoded here: a `thinking_level_selected` fact that
 * arrives while `activeModelId` is set to a different model identity is
 * treated as an automatic Pi-side clamp emitted before `model_select`,
 * and therefore is not turned into a manual preference persistence effect.
 */
export function reduceTransition(
  state: TransitionState,
  fact: TransitionFact,
  view: TransitionView,
): { state: TransitionState; effects: TransitionEffect[] } {
  switch (fact.kind) {
    case "suppress_manual_persistence":
      return {
        state: { ...state, suppressManualPersistence: true },
        effects: [],
      };

    case "release_manual_persistence":
      return {
        state: { ...state, suppressManualPersistence: false },
        effects: [],
      };

    case "model_selected": {
      const modelId = `${fact.provider}/${fact.modelId}`;
      const isManualSource = fact.source === "set" || fact.source === "cycle";
      const nextState: TransitionState = { ...state, activeModelId: modelId };

      if (!isManualSource || state.suppressManualPersistence) {
        return { state: nextState, effects: [] };
      }

      const remembered = view.getRememberedLevel(modelId);
      const finalLevel = remembered ?? fact.currentLevel;
      const effects: TransitionEffect[] = [];
      if (remembered) {
        effects.push({ kind: "apply_thinking_level", level: remembered });
      }
      effects.push({
        kind: "persist_selection",
        provider: fact.provider,
        modelId: fact.modelId,
        thinkingLevel: finalLevel,
      });
      return { state: nextState, effects };
    }

    case "thinking_level_selected": {
      const modelId = `${fact.provider}/${fact.modelId}`;
      const previous = state.activeModelId;
      const modelChanged = previous !== undefined && previous !== modelId;
      const nextState: TransitionState = { ...state, activeModelId: modelId };

      if (
        state.suppressManualPersistence ||
        modelChanged ||
        !isValidThinkingLevel(fact.level)
      ) {
        // Suppression, model-identity mismatch (automatic clamp from Pi
        // before the corresponding model_select), and unsupported levels
        // are all classified as non-manual. We still update activeModelId
        // so the upcoming model_select can be attributed correctly.
        return { state: nextState, effects: [] };
      }

      return {
        state: nextState,
        effects: [
          {
            kind: "persist_selection",
            provider: fact.provider,
            modelId: fact.modelId,
            thinkingLevel: fact.level,
          },
        ],
      };
    }
  }
}
