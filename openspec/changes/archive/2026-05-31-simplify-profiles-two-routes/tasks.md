## 1. Types and Constants

- [x] 1.1 Update `types.ts`: Remove `ProfileName`, `FIXED_PROFILE_NAMES`, update `FIXED_ROUTE_NAMES` to `["default", "high"]`, simplify `PersistedConfig` to flat `{ default: ModelRoute, high: ModelRoute }`
- [x] 1.2 Rename `profiles.ts` to `routes.ts`: Update `DEFAULT_ROUTE` to `"default"`, remove `COMPACT_ROUTE`, update `ROUTE_TYPES` mappings

## 2. State and Config

- [x] 2.1 Update `state.ts`: Rewrite `structuralErrors` and `tryRecoverConfig` for flat config structure
- [x] 2.2 Update `state.ts`: Remove `FIXED_PROFILE_NAMES` references, simplify validation

## 3. Routing Logic

- [x] 3.1 Update `routing.ts`: Remove `getActiveProfile` function, simplify `isConfigEnabled`
- [x] 3.2 Update `routing.ts`: Update `validateConfigSemantics` for 2 routes, remove profile iteration
- [x] 3.3 Update `routing.ts`: Update `activateRoute` and `getRouteName` imports

## 4. Runtime

- [x] 4.1 Update `runtime.ts`: Remove `activeProfileName`, simplify state to single profile
- [x] 4.2 Update `runtime.ts`: Remove `publishStatus`, `publishFailedStatus`, `warnOnce` status functions
- [x] 4.3 Update `runtime.ts`: Remove compaction snapshot logic, simplify `tryActivateDefault`

## 5. UI

- [x] 5.1 Update `ui.ts`: Remove `showProfileList` function entirely
- [x] 5.2 Update `ui.ts`: Simplify `editProfileRoutes` to work with 2 routes, remove profile parameter
- [x] 5.3 Update `ui.ts`: Update route editor to show only `default` and `high`

## 6. Command

- [x] 6.1 Update `command.ts`: Remove profile selection flow, go directly to route editor
- [x] 6.2 Update `command.ts`: Rename command registration from `profiles` to `profile`
- [x] 6.3 Update `command.ts`: Remove status publishing calls

## 7. Index (Extension Entry)

- [x] 7.1 Update `index.ts`: Remove `session_before_compact` and `session_compact` handlers
- [x] 7.2 Update `index.ts`: Remove status publishing from `session_start` handler
- [x] 7.3 Update `index.ts`: Update imports for renamed files and removed exports
- [x] 7.4 Update `index.ts`: Update command name from `profiles` to `profile`

## 8. Cleanup and Verification

- [x] 8.1 Remove unused imports and dead code across all files
- [x] 8.2 Run TypeScript compilation to verify type safety
- [x] 8.3 Run tests if available
