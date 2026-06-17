## Context

The `profiles` extension declares slash-command → route mappings in `routes.ts` (`ROUTE_TYPES`), routing commands like `/skill:commit` to the `light` or `high` named route for the duration of that agent turn. The `/compact` command is the exception: it is not a routed input token (pi handles `/compact` internally and emits `session_before_compact`), and the extension currently selects a dedicated `compact` `ModelRoute` persisted independently in `profiles.json` and edited through the `/profile` TUI. This splits the "/compact uses which route" concept across `routes.ts` and the persisted config.

The user wants `/compact`'s target route declared in `routes.ts` alongside the other mappings, reusing an existing named route (`high`) rather than maintaining a dedicated compact `ModelRoute`.

Constraints:

- `/compact` does not fire the `input` event (only user prompts do), so adding it to `ROUTE_TYPES` does not cause it to be treated as a temporary turn route. It is consumed only by `session_before_compact`.
- `light` and `high` are required routes, always validated, so a present compact target resolved from `ROUTE_TYPES` points at a validated named route.
- The `/compact` mapping is intentionally optional: removing it from `ROUTE_TYPES` disables custom compact routing and lets Pi use default compaction.

## Goals / Non-Goals

**Goals:**

- Declare the `/compact` → `high` mapping in `routes.ts`.
- Resolve the compaction model + thinking level from the persisted `high` route inside `session_before_compact` when the mapping is present.
- Let Pi use default compaction when `ROUTE_TYPES` has no `/compact` mapping.
- Remove the dedicated `compact` route from persisted config, the editor, runtime state, and validation.

**Non-Goals:**

- Supporting a compact-specific model distinct from `light`/`high`. (Lost flexibility by design.)
- Migrating existing `profiles.json` files: a leftover `compact` key becomes ignored dead data; no rewrite or error.
- Changing auto-compaction trigger behavior or the `session_before_compact` event contract.

## Decisions

**Decision 1: Map `/compact` to `high` in `ROUTE_TYPES`.**
`/compact` semantically benefits from the stronger model, and `high` is already required and validated. Alternative considered: mapping to `light` (cheaper compaction) — rejected by the user in favor of `high`.

**Decision 2: Resolve the compact route from the optional `ROUTE_TYPES["/compact"]` mapping inside `session_before_compact`.**
The handler first reads the `/compact` route type from `ROUTE_TYPES`; if absent, it returns without a custom result so Pi performs default compaction. If present, it resolves `config[routeType]` and reuses the existing path resolution (`parseModelId` + `ctx.modelRegistry.find`) already in the handler. Alternative considered: routing `/compact` through the `input` event like other tokens — rejected because `/compact` never fires `input`; the compaction hook is the only correct interception point.

**Decision 3: Treat an invalid/missing base config as "no custom compaction" (silent fallback).**
When the base config is missing or invalid, `runtime.getConfig()` is null and `configEnabled()` is false; `session_before_compact` returns without a compaction result, letting pi use default compaction. This matches the prior "absent compact route" behavior but is now driven by base-config validity. A warning is still emitted only on runtime failure (model/auth/compaction error) of the resolved `high` route, preserving the existing runtime-fallback UX.

**Decision 4: Remove `compact` from `PersistedConfig`, `AllRouteName`, `resolveCompactRoute`, runtime `compactRoute`, editor `compact` row, and the compact-unsusable save rejection.**
Full removal keeps the data model and editor coherent with the single-source `ROUTE_TYPES` mapping. `AllRouteName` collapses to `FixedRouteName` (or is deleted in favor of `FixedRouteName`).

## Risks / Trade-offs

- [Loss of dedicated compact model] → Accepted by design. Users who relied on a compact model cheaper than `high` lose that. Mitigation: none; the trade-off is explicit.
- [Leftover `compact` keys in existing `profiles.json`] → Ignored at load (no longer read). `structuralErrors` already does not require `compact`, so existing files remain valid. No migration step.
- [Test surface reduction] → Compact-specific tests are deleted; the remaining compaction test path covers the new `ROUTE_TYPES`-resolved behavior. Mitigation: add tests asserting `session_before_compact` uses the `high` route from `ROUTE_TYPES["/compact"]` and falls back silently when that mapping is absent.
