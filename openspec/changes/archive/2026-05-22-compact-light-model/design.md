## Context

Pi uses the active session model for compaction summarization (`compact(preparation, this.model, ...)`). The profiles extension already routes slash commands (`/opsx-propose`, `/commit`, etc.) to light or heavy models by subscribing to the `input` and `agent_end` events. Compaction—both manual `/compact` and auto-compaction—follows a separate lifecycle: `session_before_compact` → LLM summarization → `session_compact`. Today the extension does not subscribe to these events, so compaction always uses the current model (often an expensive reasoning one).

The extension source lives at `dotfiles/pi/agent/extensions/profiles/`.

## Goals / Non-Goals

**Goals:**

- Route compaction to the active profile's `light` model before summarization begins.
- Restore the exact model and thinking level that were active before compaction.
- Reuse the existing `activateRoute()` function and `RouteSnapshot` type.

**Non-Goals:**

- Changing which profile is active during compaction (only the route changes).
- Handling the rare case where auto-compaction fires mid-route (skip the switch if a route snapshot is already active).
- Modifying Pi's core compaction logic or adding new extension APIs.

## Decisions

### Decision: Intercept via `session_before_compact` / `session_compact` events

The extension already uses event hooks (`input`, `agent_end`, `session_start`, `model_select`). Adding `session_before_compact` and `session_compact` is consistent with this pattern. Pi awaits all `session_before_compact` handlers before calling `compact()`, so a model switch in the handler is visible to the summarization call.

**Alternatives considered:**

- Override `/compact` as a custom extension command. Rejected: shadows the built-in, requires re-implementing the full compaction flow, and does not cover auto-compaction.
- Use `ctx.compact()` from a different hook. Rejected: unnecessary indirection.

### Decision: Separate `compactSnapshot` state variable (not reuse `routeSnapshot`)

The existing `routeSnapshot` in `ProfilesRuntime` tracks state for command-based routing. Reusing it for compaction would create conflicts if compaction triggers during a routed command. A dedicated `compactSnapshot` variable with its own `markCompactSnapshot`, `hasCompactSnapshot`, `consumeCompactSnapshot` methods keeps the two concerns independent.

**Alternatives considered:**

- Nested snapshot stack. Rejected: adds complexity for an acknowledged rare case (routing during compaction), and the skip-if-routed guard avoids the problem instead.

### Decision: Skip the switch if a command route is active

If `hasRoutedSnapshot()` is true (meaning the user triggered a routed command like `/opsx-propose` and the heavy model is active), the compaction handler does nothing. The compaction proceeds with whatever model is currently active. This is acceptable because:

- It's rare for auto-compaction to fire mid-route.
- It avoids nested snapshot management.
- If it does happen, the user pays the cost of one heavy-model compaction, not a recurring cost.

## Risks / Trade-offs

- **[Risk] Model switch is a no-op if the light model is the same as the current model** → Acceptable. `activateRoute()` handles this gracefully. No extra guard needed.
- **[Risk] If the light model's API key is unavailable, `activateRoute()` returns false** → The handler should skip the snapshot and let compaction proceed with the current model. No user-facing error needed since compaction should not fail due to a routing preference.
- **[Trade-off] Restoring to the exact pre-compact model instead of the profile default** → More accurate (preserves manual model changes) but slightly more state to manage. Worth it for correctness.
