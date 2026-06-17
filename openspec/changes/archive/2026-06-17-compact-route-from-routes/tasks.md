## 1. Routes declaration

- [x] 1.1 Add `"/compact": "high"` to `ROUTE_TYPES` in `dotfiles/pi/agent/extensions/profiles/routes.ts`

## 2. Types and config model

- [x] 2.1 Remove `compact?: ModelRoute` from `PersistedConfig` in `types.ts`
- [x] 2.2 Remove `AllRouteName` (collapse usages to `FixedRouteName`) in `types.ts`

## 3. Routing and runtime

- [x] 3.1 Delete `resolveCompactRoute` from `routing.ts`
- [x] 3.2 Remove `compactRoute` state and `getCompactRoute` from `runtime.ts`; drop `resolveCompactRoute` use in `refreshConfig`

## 4. Compaction handler

- [x] 4.1 Rewrite `session_before_compact` in `index.ts` to resolve the route via `ROUTE_TYPES["/compact"]` against `runtime.getConfig()` and use that named route's model + thinking level
- [x] 4.2 Keep runtime-failure fallback (model not found / auth unavailable / compaction error) with the existing warning; drop the absent/invalid compact-route branches
- [x] 4.3 Guard the handler on `runtime.configEnabled()` / `getConfig()` so missing or invalid base config yields no custom compaction result
- [x] 4.4 Guard the handler so an absent `ROUTE_TYPES["/compact"]` mapping yields no custom compaction result

## 5. Profile editor and command

- [x] 5.1 Remove `compact` from `ALL_ROUTES`, the `routes` initialization, and the "d unset optional" keybinding branch in `ui.ts`
- [x] 5.2 Remove the compact-unsusable save-rejection block from `command.ts`
- [x] 5.3 Remove the optional-compact structural-validation comment from `state.ts`

## 6. Tests

- [x] 6.1 Simplify the `validConfig` helper in `profiles.test.ts` (drop the `compact` parameter)
- [x] 6.2 Delete the `compact route compaction` describe block tests
- [x] 6.3 Delete the `profile editor compact route` tests and the "preserves/malformed compact" tests
- [x] 6.4 Add a test asserting `session_before_compact` uses the `high` route resolved from `ROUTE_TYPES["/compact"]` and does not change the active model
- [x] 6.5 Add a test asserting missing/invalid base config yields no custom compaction result
- [x] 6.6 Add a test asserting an absent `/compact` mapping yields no custom compaction result

## 7. Verification

- [x] 7.1 Run `npm test` and confirm the suite passes
- [x] 7.2 Run `npm run check` (eslint, tsc, fallow, openspec) and confirm all gates are green
