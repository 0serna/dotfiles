## Context

The `web_fetch` tool result renderer (`renderWebFetchResult` in `web-fetch.ts`) currently displays the extracted content size and a boolean `fallback` flag. The `fallback` flag distinguishes only two cases: primary sources (GitHub, Exa, Cloudflare) vs. the HTTP regex fallback. The specific source that produced the content is available in `details.source` but is not displayed.

The `AgentToolResult<T>` type from `@earendil-works/pi-agent-core` defines `details` as "Arbitrary structured details for logs or UI rendering" — it is not sent to the LLM. This means changes to `details` fields are purely visual and do not affect the model's reasoning.

The `tryFetchContent` function already returns a `source` string (`"github-raw"`, `"github-api"`, `"exa"`, `"cloudflare"`, `"http-fallback"`) which flows into `result.details["source"]`. The renderer just doesn't use it.

## Goals / Non-Goals

**Goals:**

- Show which retrieval source produced the content in the tool result display
- Eliminate the redundant `fallback` boolean from the result details

**Non-Goals:**

- Changing what information the LLM receives (only `content` is sent to the model)
- Adding source info to error results
- Changing the fallback chain logic itself
- Adding new retrieval sources

## Decisions

### Decision 1: Use `source` field for display, remove `fallback`

**Choice**: Replace the `fallback` boolean in `renderWebFetchResult` with the `source` string. Remove `fallback` from `tryFetchContent`'s return type and from the `details` object.

**Rationale**: `fallback` is a binary signal that only distinguishes "HTTP regex" from "everything else". With four sources, `source` provides strictly more information. Since `details` is not consumed by the LLM or any other code outside the renderer (verified by grep), removing `fallback` is safe.

**Alternative considered**: Keep `fallback` alongside `source` for backward compatibility. Rejected because `details` is typed as `Record<string, unknown>` and only consumed within this extension's renderer — no external consumer exists.

### Decision 2: Unify GitHub sub-sources in display

**Choice**: Map both `github-raw` and `github-api` to the display label `github`.

**Rationale**: The distinction between raw file fetch and API metadata fetch is an implementation detail. For the user, "github" is sufficient. The underlying `source` value in `details` retains the full granularity for logs.

**Alternative considered**: Show `github-raw` and `github-api` separately. Rejected — adds visual noise without practical value for the user.

### Decision 3: Display format — `17.2KB (exa)`

**Choice**: `${kb}KB (${sourceLabel})` where `sourceLabel` is the short source name.

**Rationale**: Parenthetical format is compact, readable, and consistent with the existing minimal aesthetic. The source list: `github`, `exa`, `cloudflare`, `http`.

**Alternative considered**: `${kb}KB · exa` (middle dot separator). Rejected — less conventional than parentheses for metadata annotations.

### Decision 4: No source on error results

**Choice**: Error results show only the error message, no source label.

**Rationale**: When all sources fail, showing which one failed last adds no actionable information for the user. The error message already describes the failure.

## Risks / Trade-offs

- **[Future consumer of `details.fallback`]** → Mitigated: `details` is internal to the extension, typed as `Record<string, unknown>`, and only consumed by `renderWebFetchResult`. No external code reads it.
- **[Unknown `source` values]** → If `source` is `undefined` or an unrecognized string, the renderer falls back to `${kb}KB extracted` (the current behavior), ensuring no visual regression.
