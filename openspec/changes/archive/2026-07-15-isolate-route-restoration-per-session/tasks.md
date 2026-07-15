## 1. Regression Coverage

- [x] 1.1 Change the concurrent-session route-settlement test to prove that an external preferences update does not replace the current session's model or thinking level.
- [x] 1.2 Verify focused model-routing tests fail under the current file-reloading restoration behavior before changing production code.

## 2. Session-Owned Restoration

- [x] 2.1 Restore settled routes from the in-memory manual preferences snapshot and remove the route-settlement file reload.
- [x] 2.2 Update model-routing names and comments to distinguish the session manual selection from the latest persisted manual selection.
- [x] 2.3 Update `CONTEXT.md` with the agreed manual-selection terms and redefine route restoration as returning to the session manual selection.

## 3. Verification

- [x] 3.1 Run the focused model-routing test suite and confirm the session-isolation regression passes.
- [x] 3.2 Run `npm run test`, `npm run lint`, `npm run typecheck`, Prettier verification, and `npm run openspec`; resolve all findings caused by the change.
