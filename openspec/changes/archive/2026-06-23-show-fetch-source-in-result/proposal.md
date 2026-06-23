## Why

The `web_fetch` tool result renderer shows only the extracted content size and a generic "fallback" flag. The user cannot see at a glance which of the four retrieval sources (GitHub, Exa, Cloudflare, HTTP) actually produced the content. With the recent addition of Cloudflare Browser Run as a third fallback layer, this visibility gap is more pronounced — knowing which source succeeded is valuable for understanding fetch quality and diagnosing issues.

## What Changes

- Display the retrieval source name alongside the content size in the `web_fetch` tool result renderer (e.g., `17.2KB (exa)`, `17.2KB (cloudflare)`)
- Unify `github-raw` and `github-api` sub-sources under a single `github` label for display
- Remove the `fallback` boolean from `tryFetchContent`'s return type and from `details` — the source name now distinguishes HTTP regex (`http`) from primary sources, making the boolean redundant
- Error results remain unchanged (no source shown on errors)

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-fetch`: The "Fetch content from a single URL" requirement is modified to specify that the result renderer displays the retrieval source name. The existing `fallback` field in result details is removed.

## Impact

- **Code**: `renderWebFetchResult` in `web-fetch.ts` (display logic change), `tryFetchContent` in `web-fetch.ts` (remove `fallback` from return type and details)
- **APIs**: No external API changes. `details` is internal to the extension (used only for UI rendering and logs, not sent to the LLM per `AgentToolResult` type definition)
- **Dependencies**: None
