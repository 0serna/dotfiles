## Context

Pi extensions use a shared logger for file transport and context injection, but error diagnostics are still implemented ad hoc. The current web-search logging redesign introduced useful structured diagnostics for thrown errors, immediate causes, HTTP response status, and bounded response body snippets. Other extensions still log plain message strings or status-only failures.

The agreed direction is to make those diagnostics reusable without expanding the logger's responsibility. The shared logger remains a JSONL writer; diagnostics become a separate shared module consumed by any extension that needs richer failure payloads.

## Goals / Non-Goals

**Goals:**

- Provide shared helpers for structured error serialization and HTTP response diagnostics.
- Keep response and error payload shapes consistent across extensions.
- Remove the web-search-local diagnostics module in favor of shared diagnostics.
- Migrate only obvious, low-risk existing failure logs in quota and context.
- Preserve extension control flow and event names.

**Non-Goals:**

- Do not validate or enforce global event naming.
- Do not add specialized failure methods to `ExtensionLogger`.
- Do not inject `toolCallId` or `elapsedMs` from the shared logger.
- Do not redesign retry behavior, fetch timeouts, or authentication.
- Do not preserve old plain `message` payload fields when a migrated log now emits structured `error`.

## Decisions

### Keep diagnostics separate from logging transport

Add `dotfiles/pi/agent/extensions/shared/diagnostics.ts` instead of adding HTTP/error methods to `shared/logger.ts`.

Rationale: the logger is currently simple and generic: it writes JSONL, injects context, truncates logs, and catches write errors. HTTP response parsing and error serialization are diagnostic concerns, not transport concerns.

Alternative considered: add `logger.failure(...)`. This would reduce call-site code, but it would couple the logger to error payload semantics and make future non-error logging conventions harder to reason about.

### Standardize the payload helpers, not the event taxonomy

Expose helpers that return structured payload fragments, especially `failureDetails(err)`, while leaving event names chosen by each extension.

Rationale: event names vary across existing extensions and changing them globally would broaden the migration. Structured `error` and optional `response` fields provide diagnostic consistency without forcing a naming migration.

### Use immediate error cause only

`serializeError(err)` captures the thrown error and one immediate cause, including `name`, `message`, and string `code` when present.

Rationale: this captures the most useful Undici/fetch cause information without logging stack traces or producing deeply nested payloads.

### Allow bounded HTTP body snippets

`responseDetails(response)` includes a bounded `bodySnippet` for HTTP failures, including authenticated endpoints when callers use this helper.

Rationale: the user accepted the risk of body snippets for authenticated endpoints in exchange for stronger diagnostics. The helper bounds the snippet and does not log headers, request bodies, cookies, tokens, or stack traces.

### Migrate obvious existing logs only

Migrate web-search fully and selected quota/context logs where the change is a direct replacement from plain error text to structured `error`. Leave unrelated logging shape and event naming unchanged.

Rationale: this demonstrates shared usage while keeping the change focused and avoiding broad log taxonomy churn.

## Risks / Trade-offs

- Authenticated response snippets may contain sensitive service messages → Mitigation: bound snippets, never log headers/request bodies/tokens, and use the helper only in failure paths where diagnostics matter.
- Replacing `message` with `error` changes selected log payload formats → Mitigation: this is intentional and limited to migrated diagnostic logs.
- Reading response bodies for snippets consumes the response body → Mitigation: use `responseDetails()` only on non-OK responses that will not be parsed afterward.
- Some extensions may continue using older logging styles → Mitigation: the shared helper establishes the preferred pattern without requiring a broad migration.
