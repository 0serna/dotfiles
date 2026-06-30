## 1. Extension Structure

- [x] 1.1 Create `dotfiles/pi/agent/extensions/duration/index.ts` with the Pi extension entry point.
- [x] 1.2 Extract pure helpers for duration formatting and session-history inference so they can be tested directly.

## 2. Live Duration Tracking

- [x] 2.1 Handle `agent_start` by recording the start time, publishing `⏱ <duration>`, and starting a one-second update interval.
- [x] 2.2 Handle `agent_end` by clearing the interval and leaving the measured run visible as `⏱ <duration>`.
- [x] 2.3 Handle `session_shutdown` by clearing any active interval and dropping active run state.

## 3. Session History Inference

- [x] 3.1 On `session_start`, inspect session entries and infer the latest user-to-generated-message duration when available.
- [x] 3.2 Publish `⏱ <duration>` for an inferred completed duration and publish nothing when no valid duration can be inferred.

## 4. Tests and Validation

- [x] 4.1 Add Vitest coverage for duration formatting, including seconds and minute-plus durations.
- [x] 4.2 Add Vitest coverage for session-history inference with completed, incomplete, and multi-user-message histories.
- [x] 4.3 Add Vitest coverage for extension lifecycle behavior: live publish, interval cleanup, completion publish, and session shutdown cleanup.
- [x] 4.4 Run the repository quality gate and fix any reported issues.
