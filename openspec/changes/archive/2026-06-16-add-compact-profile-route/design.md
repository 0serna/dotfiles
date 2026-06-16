## Context

The profiles extension currently has required `light` and `high` model routes for slash-command routing. Pi compaction is not a slash command route; it is customizable through `session_before_compact`, where extensions can return a custom compaction result.

The desired behavior is a dedicated optional compaction route that does not change the active user model and does not make the main profile routing configuration invalid when absent.

## Goals / Non-Goals

**Goals:**

- Add optional `compact` route configuration using the existing route shape: model plus thinking level.
- Use Pi's `session_before_compact` hook and official `compact(...)` helper for custom compaction.
- Keep `light` and `high` as the only required routes for profile validity.
- Let `/profile` configure or unset `compact` without requiring manual JSON edits.
- Fall back to Pi default compaction when `compact` is absent, invalid, or unusable.

**Non-Goals:**

- Do not add a new slash command route for `/compact`.
- Do not switch Pi's active model before or after compaction.
- Do not change Pi's default compaction algorithm beyond selecting the compaction model/thinking level.
- Do not add new dependencies.

## Decisions

- Represent `compact` as `compact?: ModelRoute` in persisted config. This reuses existing model/thinking validation and avoids a second route shape.
- Keep required route validation limited to `light` and `high`. Optional `compact` validation is separate so a bad compact route does not disable slash-command routing.
- Render `compact` in `/profile` as an optional row. Saving requires only `light` and `high`; `compact` may remain unset.
- Provide a UI affordance to unset `compact`. Because it is optional, users must be able to return to Pi default compaction from the editor.
- Handle compaction through `session_before_compact`. If a usable compact route exists, resolve its model and auth and call Pi's exported `compact(...)` helper with `event.preparation`, `event.customInstructions`, `event.signal`, and the configured thinking level.
- If `compact` is absent or invalid, return nothing from the hook so Pi performs default compaction silently.
- If runtime use of configured `compact` fails, notify once for that compaction attempt and return nothing so Pi falls back to default compaction.

## Risks / Trade-offs

- Optional validation creates two validity concepts: required profile validity and compact-route usability. Mitigation: keep the runtime API explicit about retrieving only a usable compact route.
- The `/profile` UI needs a minimal unset interaction for one optional row. Mitigation: keep it local to the route editor instead of adding new screens.
- Falling back silently for invalid compact config can hide stale JSON. Mitigation: runtime failures still warn when the route was considered usable and attempted.
