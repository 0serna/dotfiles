## Why

The quota extension’s account-selection policy is split between shallow pure modules and mutable Pi event orchestration, while refresh persistence is split across overlapping lifecycle/coordinator interfaces and process-global path configuration. Deepening these two connected modules will concentrate quota behavior behind testable seams without changing the user-visible quota contract.

## What Changes

- Introduce one deep OpenCode account-selection module that owns account activation state, cooldowns, blind fallback, processing-cycle attempts, reactive rotation, and preventive reselection decisions.
- Reduce the quota extension entry module to a Pi adapter that translates lifecycle events and applies account-selection outcomes through Pi auth, UI, logging, and automatic-continuation facilities.
- Consolidate quota refresh scheduling, source fetching, leasing, snapshot locking, persistence, watching, revision publication, and shutdown behind one deep quota-refresh module.
- Replace process-global snapshot-store and lease-directory overrides with instance-owned persistence paths.
- Remove overlapping lifecycle/coordinator interfaces and test-only reach-through to coordinator internals.
- Preserve shared quota snapshot behavior, runtime-local account operation, rotation guards, status rendering, and `/quota` behavior.
- Replace tests of shallow helpers and reconstructed orchestration with tests through the account-selection and quota-refresh interfaces plus focused Pi adapter coverage.

## Capabilities

### New Capabilities

- `quota-runtime-architecture`: Internal module ownership, seam placement, lifecycle cleanup, and test-surface requirements for account selection and shared quota refresh.

### Modified Capabilities

None.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/quota/index.ts`, account rotation/reselection/selection modules, refresh lifecycle/coordinator modules, snapshot persistence/lease/watcher modules, and quota tests.
- Existing behavior contracts remain governed by `shared-quota-snapshot`, `opencode-account-rotation`, `quota-rotation-guard`, `quota-status`, and `quota-command`.
- No persisted snapshot schema, user configuration, Pi event registration, external dependency, or user-visible interface changes are intended.
- Internal imports and test seams will change as shallow modules and global reset hooks are removed.
