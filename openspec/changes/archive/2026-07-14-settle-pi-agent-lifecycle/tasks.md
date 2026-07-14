## 1. Settled Working Statistics

- [x] 1.1 Add a failing lifecycle-sequence test and implement one processing-cycle timer across repeated agent attempts with completion only at settled idle.
- [x] 1.2 Add failing attribution and cleanup tests, then preserve the last responding model and latest valid final throughput while keeping shutdown cleanup notification-free.

## 2. Settled Model Routing

- [x] 2.1 Add a failing queued-route boundary test and activate expanded queued skill routes from `message_start` without changing the in-flight model at `input`.
- [x] 2.2 Add failing manual-selection tests and cancel the active route when a manual model or thinking-level selection is persisted.
- [x] 2.3 Add failing settlement tests and restore the latest manual selection only at settled idle, retaining the active model and warning when restoration is unavailable.

## 3. Specification Consolidation and Verification

- [x] 3.1 Validate the OpenSpec deltas that consolidate working-stats ownership into `pi-working-time-throughput` and retire the two legacy capabilities.
- [x] 3.2 Run focused extension tests and the full repository lint, typecheck, test, formatting, and OpenSpec quality gates.
