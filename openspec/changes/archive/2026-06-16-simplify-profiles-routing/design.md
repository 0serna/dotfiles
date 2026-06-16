## Context

The profiles extension currently owns two concerns: temporary command routing and base-model selection. Base-model selection duplicates Pi's native remembered-model behavior and overrides user intent by activating `default` on startup/restore and after routed commands. A separate model-select hook also forces `medium` thinking whenever the user sets or cycles models.

## Goals / Non-Goals

**Goals:**

- Keep temporary command routing for configured routes.
- Remove extension ownership of the user's base model.
- Persist the last thinking level used for each model and restore it on manual model set/cycle.
- Support `light` and `high` as configurable routes.

**Non-Goals:**

- Add default route replacement behavior.
- Auto-map commands to `high` before the user defines those mappings.
- Add a profile system beyond the existing single flat route config.

## Decisions

- Store route config as fixed routes `light` and `high` only. This is the smallest data model that matches the desired behavior and removes default-route migration complexity from runtime behavior.
- Do not add legacy migration logic for old `default` configs. Correct the local config file to the new shape directly.
- Store thinking memory separately from route config, keyed by formatted model id (`provider/id`). Route config remains about command routes; thinking memory remains about user model preference.
- Update thinking memory from `thinking_level_select` using the currently active model. Restore memory from `model_select` only for user set/cycle sources.
- Routed command activation continues to set both route model and route thinking level. No post-command restoration is performed; Pi and the user's later choices define the ongoing state.

## Risks / Trade-offs

- Existing configs become incomplete until `high` is set → correct the config file once, then use `/profile` for edits.
- A thinking change emitted during route activation could update memory for the routed model → acceptable; route use is an explicit model/thinking combination and can be remembered.
- If Pi clamps unsupported thinking levels, stored memory may become stale → rely on `setThinkingLevel` clamping and later `thinking_level_select` updates.
