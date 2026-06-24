## Context

The profiles extension currently keeps the user's model/thinking snapshot in memory. Route activation calls Pi's existing `setModel` and `setThinkingLevel` APIs, which also persist Pi defaults. If another Pi process starts while a route is active, Pi may initially use the routed model.

The accepted behavior is to let Pi start with its persisted default briefly, then have the profiles extension restore the user's last manual selection during `session_start` from extension-owned state.

## Goals / Non-Goals

**Goals:**

- Persist the user's last manual model and thinking level in profiles extension state.
- Restore that persisted user selection during `session_start` when the model is available and can be activated.
- Restore that same persisted selection after routed commands complete.
- Keep route activation and route restoration from overwriting the persisted manual selection.

**Non-Goals:**

- Prevent Pi's own default model setting from being temporarily changed by `pi.setModel`.
- Modify Pi upstream APIs or internal settings behavior.
- Edit Pi's global `settings.json` directly.

## Decisions

- Store the durable user selection in profiles-owned persistence rather than Pi settings.
  - Rationale: Pi settings are changed by the same API required to activate routes, so they cannot distinguish manual selection from temporary routing.
  - Alternative considered: rewrite Pi settings after route activation. Rejected because it is more coupled to Pi internals and still has race windows.

- Treat only non-ignored `model_select` events with source `set` or `cycle` as manual model selection.
  - Rationale: This matches existing snapshot behavior and excludes route activation/restoration wrapped by `ignoreSelectionEventsWhile`.

- Persist thinking together with the active model at the time of manual selection or manual thinking-level change.
  - Rationale: The restoration target must be a coherent pair: selected model plus the user's intended thinking level for that model.

- On `session_start`, attempt restoration after loading extension state and before route processing.
  - Rationale: This corrects route-contaminated Pi defaults before the user submits the next prompt.

## Risks / Trade-offs

- Brief startup mismatch → Accepted: Pi may show the routed default for a short interval before `session_start` restoration runs.
- Persisted model unavailable or unauthenticated → Leave Pi's current model unchanged and warn or silently continue according to existing extension warning style.
- Existing in-memory snapshot behavior diverges from persisted state → Use the persisted user selection as the source of truth and keep the in-memory snapshot synchronized after load and manual changes.
