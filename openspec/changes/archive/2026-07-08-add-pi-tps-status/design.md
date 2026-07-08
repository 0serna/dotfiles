## Context

The repository manages Pi agent extensions under `dotfiles/pi/agent/extensions`. The current custom footer builds a left-side sequence containing cwd, active profile, model/thinking, context metrics, and remaining extension statuses, with quota reserved on the right. Existing extensions publish compact footer segments through `ctx.ui.setStatus(...)`.

Pi exposes assistant streaming through `message_update` events and finalized assistant usage through `message_end`. Streaming deltas can provide a medium-precision live estimate, while `message.usage.output` provides the high-precision final output token count when the provider reports usage.

## Goals / Non-Goals

**Goals:**

- Add a dedicated `tps` Pi extension for assistant output throughput.
- Show one compact footer status formatted as `<integer> tok/s`.
- Show live estimated throughput during active assistant generation and replace it with final precise throughput when the stream closes.
- Measure each assistant stream independently, starting at the first output delta and ending at `message_end`.
- Keep the last final precise value visible while tools run between assistant streams.
- Place the status immediately after the model/thinking footer section.

**Non-Goals:**

- Do not measure prompt latency, queue latency, or end-to-end agent run duration.
- Do not reconstruct previous throughput after reload/resume.
- Do not add provider-specific tokenizers or new external dependencies.
- Do not expose a command or configuration surface unless later needed.

## Decisions

### Use a dedicated `tps` extension

The throughput state is separate from context/cache metrics and from elapsed working time. A dedicated extension keeps event handling, estimation, formatting, and cleanup isolated while allowing the existing footer to place the status by key.

Alternatives considered:

- Add to `working-time`: rejected because elapsed run duration and output throughput have different lifecycle semantics.
- Add to `context`: rejected because context/cache metrics are prompt-side/session-state metrics, not stream-generation metrics.

### Use first output delta as the stream start

The timer starts when the first assistant output delta is observed, not at `agent_start` or request dispatch. This measures generation throughput rather than network latency, provider queueing, or tool execution delays.

Alternatives considered:

- Start at `agent_start`: rejected because it conflates latency and generation speed.
- Start at `message_start`: less precise because it may precede actual generated output.

### Estimate live tokens from streamed output deltas

Live throughput uses accumulated streamed delta content to estimate output tokens and updates approximately once per second. The estimate includes text, thinking, and tool-call deltas so it tracks total output semantics as closely as the stream allows.

Alternatives considered:

- Update on every delta: rejected to avoid excessive footer renders.
- Provider-specific tokenizers: rejected to avoid dependency and model-compatibility complexity.
- Text-only live estimate: rejected because final output usage includes more than visible text for some providers.

### Use provider `usage.output` for final throughput

When `message_end` provides an assistant message with `usage.output`, final throughput is calculated from that exact output count and the elapsed stream time. If exact usage is unavailable, the extension keeps the previous final precise status instead of publishing an estimated final value.

Alternatives considered:

- Publish the latest live estimate as final fallback: rejected because it would weaken the meaning of the final displayed value.
- Hide status on missing usage: rejected because preserving the last precise value is less disruptive.

### Order `tps` explicitly in the custom footer

The custom footer should include `tps` immediately after the model/thinking segment and exclude it from the generic remaining statuses so it does not appear twice. This mirrors existing special handling for `context`, `profiles`, and `quota`.

Alternatives considered:

- Let `tps` appear in generic status order: rejected because insertion order does not guarantee the requested placement.

## Risks / Trade-offs

- Live token estimate differs from final provider usage → Replace live with precise final output whenever `usage.output` is available.
- Some providers may not report output usage → Keep the last final precise value and do not present estimates as final.
- Tool-call deltas may serialize differently from provider billing tokens → Treat live throughput as medium-precision only and document/test final precision separately.
- Very short streams may produce unstable live values → Do not show live throughput until at least one second of generation has elapsed.
- Footer overcrowding on narrow terminals → Keep the segment short and rely on existing footer truncation.
