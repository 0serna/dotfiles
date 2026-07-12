## 1. Route Domain and Persistence

- [x] 1.1 Rename the extension directory from `profiles` to `model-routing` and update profile-oriented internal names to model-routing terminology.
- [x] 1.2 Replace shared route categories with a declaration-ordered catalog of route tokens and a partial per-token `ModelRoute` configuration type.
- [x] 1.3 Replace `profiles.json` loading with `model-routes.json` parsing, independent route validation, canonical sanitization, and protection for unreadable files.
- [x] 1.4 Add focused tests for partial configuration, omitted unset routes, undeclared-route cleanup, invalid-entry sanitization, credential-only preservation, and unreadable-file protection.

## 2. Runtime Routing

- [x] 2.1 Resolve input commands directly to their token configuration and preserve independent fallback and warning behavior for absent or unusable routes.
- [x] 2.2 Update compact handling to resolve `/compact` directly while preserving manual/automatic compaction behavior and native fallback.
- [x] 2.3 Preserve manual preference persistence, selection-transition suppression, and latest-selection restoration across temporary routes.
- [x] 2.4 Update runtime tests for independently configured routes, isolated failures, route restoration, and compact behavior.

## 3. Route Editor

- [x] 3.1 Replace `/profile` with `/model-routes` and update user-facing labels and notifications to model-route terminology.
- [x] 3.2 Update the editor to list every declared token in declaration order and edit each route's model and supported thinking level.
- [x] 3.3 Add an explicit unset interaction and allow saving partial configuration while omitting unset and undeclared entries.
- [x] 3.4 Add focused editor and command tests for missing configuration, per-token editing, unsetting, partial saves, and unavailable models.

## 4. State Migration and Verification

- [x] 4.1 Manually expand the current local `cheap` and `auxiliar` values into `~/.local/state/pi/model-routes.json` without adding runtime migration code.
- [x] 4.2 Verify the new local route file, then remove `~/.local/state/pi/profiles.json`.
- [x] 4.3 Run the focused model-routing Vitest suite and fix all failures.
- [x] 4.4 Run the full repository quality gate and OpenSpec validation, fixing all reported issues.
