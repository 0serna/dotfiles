## Context

The profiles extension currently treats Pi's `model_select` and `thinking_level_select` callbacks as independent events. During a manual model switch, Pi can emit an automatic thinking-level clamp before `model_select`; the extension must infer that relationship using `activeModelId` and callback timing. The recent `max` versus `high` regression showed that this state is too distributed for reliable reasoning.

Manual preference persistence is also split across `user-selection.json` and `thinking-memory.json`. Both files describe the user's manual model/thinking choices, but they have different write queues, flush behavior, and read/write interfaces. That split allowed the same preference to become inconsistent.

Automatic route configuration in `profiles.json` is a separate concern. It describes configured route activation, is edited through `/profile`, and must not be merged with manual preferences.

## Goals / Non-Goals

**Goals:**

- Put model-switch event attribution and thinking-level clamp handling behind one internal selection transition module.
- Represent selection handling as a pure reducer plus explicit effects.
- Persist the current manual selection and per-model thinking memory as one coherent record.
- Preserve the distinction between manual preference state and automatic route configuration.
- Preserve existing route suppression, session restoration, and manual `set`/`cycle` behavior.
- Keep Pi event registration in `index.ts` and do not add event listeners.
- Migrate the current user state manually, without shipping runtime migration or legacy-reading code.

**Non-Goals:**

- Changing route names, route configuration shape, or `profiles.json`.
- Changing Pi event semantics or adding a second event source.
- Supporting concurrent writers with cross-process locking or conflict resolution.
- Retaining runtime compatibility with the two legacy manual-preference files.
- Changing the public extension registration surface.

## Decisions

### 1. Use one internal selection transition reducer

The Pi callbacks remain registered in `index.ts`, but their orchestration moves behind the existing route-session module. The coordinator maintains the minimal transition state needed to interpret ordered events: the last active model identity and whether route/restoration effects are being ignored.

The reducer consumes normalized transition facts and returns state changes plus explicit effects. Effects cover applying a remembered thinking level and persisting a new manual preference snapshot. The reducer never writes files or calls Pi directly.

This keeps the external seam unchanged while creating an internal seam that tests can exercise without reproducing filesystem behavior. It also makes the clamp rule explicit: a thinking-level event observed after the model identity changed and before the target `model_select` is classified as automatic, not manual.

### 2. Keep Pi registration as a thin adapter

`index.ts` continues to register the existing `session_start`, `input`, `agent_end`, `model_select`, `thinking_level_select`, and `session_shutdown` hooks. It forwards each event to the route-session coordinator. No listener is added.

The adapter remains responsible for Pi-specific event and context shapes. The transition reducer works with the smallest internal facts needed for model identity, source, thinking level, and suppression state. This prevents Pi callback ordering details from leaking into persistence code.

### 3. Replace the two manual-preference files with one record

Create a single extension-owned `manual-preferences.json` containing two independent fields:

- `selection`: the latest manually selected provider, model, and thinking level; this remains the source of truth for restoration after routes and at session start.
- `thinkingMemory`: a map from formatted provider/model identity to the user's remembered thinking level for that model.

The fields remain semantically separate even though they are persisted together. `profiles.json` remains the only persisted state for automatic route configuration.

The persistence module owns loading, structural validation, serialized writes, and flush behavior for the combined record. A manual thinking-level change updates `selection` and its matching `thinkingMemory` entry in one write. A manual model selection updates `selection` and applies an existing `thinkingMemory` entry before persisting the resulting current level.

### 4. Make one write the consistency point

All manual-preference mutations produce a complete snapshot and enter one FIFO write queue. Reads wait for the queue before loading. Writes use an atomic replacement of the final file so readers see either the previous complete record or the next complete record, not a partial JSON document.

The queue is process-local, matching the existing last-writer-wins behavior across multiple Pi instances. Cross-process conflict resolution is explicitly out of scope.

### 5. Migrate manually, not at runtime

Before enabling the new implementation, create `manual-preferences.json` from the existing files:

1. Copy the current `user-selection.json` into `selection`.
2. Copy `thinking-memory.json` into `thinkingMemory`.
3. If the selected model exists in both records, overwrite its memory entry with `selection.thinkingLevel`, because user selection is the ground truth for that model.
4. Validate the resulting JSON and confirm it can be loaded.
5. Remove `user-selection.json` and `thinking-memory.json`.

The implementation does not read or write the legacy files. A manual backup can be taken before deletion, but no compatibility path is shipped.

### 6. Preserve route semantics

Route activation and restoration continue to run inside the existing suppression guard. Suppressed events may update transient active-model tracking when needed for later event attribution, but they never update `selection` or `thinkingMemory`.

Session start restores `selection`, then records the actual restored thinking level in `thinkingMemory` for the restored model. Manual model selection applies the remembered level after Pi's model change. Automatic clamp events during that change are ignored by the reducer.

## Risks / Trade-offs

- **[Manual migration error]** → Validate the generated `manual-preferences.json` before deleting the two legacy files; keep a user-created backup during rollout.
- **[No runtime rollback]** → The change deliberately removes legacy-reading code; rollback requires restoring the backup or reconstructing the two old files manually.
- **[Cross-process last-writer-wins remains]** → Keep the existing documented behavior; atomic complete snapshots prevent corruption but do not merge concurrent user choices.
- **[Pi ordering changes]** → Keep event attribution localized in the reducer and add an integration-shaped regression test for clamp-before-model-select ordering.
- **[Larger state record]** → The unified record is still small, and one write reduces inconsistency risk compared with two independent files.
