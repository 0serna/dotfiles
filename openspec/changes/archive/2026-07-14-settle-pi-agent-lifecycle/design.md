## Context

Pi emits `agent_end` after each low-level agent attempt, then evaluates retries, overflow compaction, and continuations before emitting `agent_settled`. Both model restoration and user-visible completion currently run at the earlier boundary. Model routing also activates a route immediately from `input`, which can switch models before an already-running message reaches a queued routed message.

The extension API exposes raw route tokens in `input`, expanded skill blocks in user `message_start`, and `ctx.isIdle()` at settlement. Pi exports `parseSkillBlock`, allowing queued routed messages to be recognized at their actual processing boundary without relying on private queue state.

## Goals / Non-Goals

**Goals:**

- Model one processing cycle across all low-level attempts until Pi is settled and idle.
- Keep each route segment active through retries, compaction recovery, and unrouted continuations.
- Activate a queued route only when its expanded user message starts processing.
- Make manual model or thinking-level changes cancel automatic routing.
- Preserve one elapsed-time notification and the last meaningful model/throughput attribution across attempts.
- Consolidate duplicated working-stats specifications.

**Non-Goals:**

- Change quota reselection behavior.
- Add attempt counts or outcome-specific completion symbols.
- Depend on `AgentSession` internals in extension tests.
- Preserve compatibility with Pi versions older than 0.80.6.

## Decisions

### Use settled-and-idle as the completion boundary

Both extensions subscribe to `agent_settled` and check `ctx.isIdle()`. If an earlier settled handler starts more work, state remains active until a later idle settlement. This prevents model changes and completion notifications while Pi is processing. A mechanical event rename without the idle guard was rejected because extension handler ordering can start another run.

### Keep processing-cycle state across repeated agent starts

`working-stats` initializes timing and throughput only for the first `agent_start` of a cycle. Later starts refresh live presentation without resetting the wall-clock start or last valid final throughput. Assistant `message_end` records the last responding model, while idle `model_select` restoration cannot overwrite final attribution. `session_shutdown` remains cleanup-only.

### Recognize queued routes from expanded skill messages

An idle routed input activates immediately so the first provider request uses the route. A routed input received while streaming does not change the active model. When its user `message_start` arrives, `parseSkillBlock` recovers the skill name and activates the matching declared route. This avoids a FIFO shadow queue that could desynchronize when Pi's message queue is cleared.

Unrouted queued messages leave the active route segment unchanged. A failed queued activation warns and retains the previous active selection.

### Treat persisted manual-selection effects as route cancellation

The selection transition reducer already distinguishes extension-suppressed changes and automatic clamps from manual selections. When a model or thinking-level event produces a manual persistence effect, the route session also cancels its active route. The resulting model/thinking pair becomes the manual selection and is not restored away at settlement.

### Close route restoration after one idle attempt

Route restoration remains pending while Pi is busy. Once idle, the extension loads the latest persisted manual selection and attempts restoration. Success closes the route. Missing or unusable selection also closes it, retains the active model, and warns when a configured selection cannot be activated. Indefinite retries were rejected because they could switch models during a later unrelated cycle.

### Consolidate working-stats capability ownership

`pi-working-time-throughput` becomes the sole capability for duration, throughput, attribution, completion, and cleanup. The legacy duration and throughput capabilities are removed rather than retained as duplicate normative sources.

## Risks / Trade-offs

- [Expanded skill parsing depends on Pi's public `parseSkillBlock` contract] → Use the exported parser and cover raw idle input plus expanded queued-message boundaries in focused tests.
- [A route remains active during default compaction] → This is intentional; configure `/compact` to override the compaction model.
- [A completion marker does not communicate success] → Keep the existing compact `✓` contract, explicitly defined as settlement rather than outcome.
- [Multiple attempts are hidden in the final notification] → Rely on Pi's retry UI and keep working-stats focused on total elapsed time and stream throughput.
