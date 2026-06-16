## 1. Route Configuration

- [x] 1.1 Change fixed profile routes from `default`/`light` to `light`/`high`.
- [x] 1.2 Update route config loading for the new `light`/`high` shape and correct the local config file directly.
- [x] 1.3 Update `/profile` editor defaults, labels, validation, and save behavior for `light` and `high` only.

## 2. Routing Runtime

- [x] 2.1 Remove default activation on `session_start`.
- [x] 2.2 Remove default-route restoration on `agent_end`.
- [x] 2.3 Keep temporary command routing for configured route mappings.
- [x] 2.4 Restore the latest user model/thinking snapshot after routed commands.
- [x] 2.5 Ignore route/restoration model and thinking events when updating the user snapshot.

## 3. Per-Model Thinking Memory

- [x] 3.1 Add persisted state helpers for model id to thinking level memory.
- [x] 3.2 Record the current model's thinking level on `thinking_level_select`.
- [x] 3.3 On manual `model_select` from `set` or `cycle`, restore the remembered thinking level when one exists.
- [x] 3.4 Remove forced `medium` thinking on manual model set/cycle.

## 4. Verification

- [x] 4.1 Update or add Vitest coverage for route config shape, no-default behavior, and per-model thinking memory.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run `npm run check`.
