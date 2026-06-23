## Why

`web_search` relies exclusively on Exa as its search provider. If Exa fails or returns poor results, the agent has no alternative. Adding Tavily as a parallel search provider increases result diversity, improves resilience through partial-success semantics, and leverages Tavily's free tier (1,000 API credits/month) at no additional cost.

## What Changes

- Add a Tavily search module (`tavily.ts`) that calls the Tavily Search REST API (`POST /search`) with `max_results=2`, `search_depth=basic`, and no `include_answer`.
- Modify `web_search` to execute Exa and Tavily searches in parallel via `Promise.allSettled`, requesting 2 results from each provider.
- Merge results from both providers, deduplicating by URL, and interleave them preserving each provider's internal ranking.
- Present a unified result list to the agent with no provider labels (transparent to the LLM).
- Update the renderer to show total unique sources plus per-provider counts (e.g., `3 sources (2 exa, 2 tavily)`).
- Skip Tavily silently when `TAVILY_API_KEY` is absent; fall back to Exa-only.
- Allow partial success: if one provider fails, return results from the other. Only fail if both providers fail or are unavailable.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-search`: Add parallel Tavily search provider alongside Exa, with result merging, deduplication, interleaving, partial-success handling, and renderer updates.

## Impact

- **New file**: `tavily.ts` — Tavily Search API client module.
- **Modified files**: `web-search.ts` (parallel execution, merge, format), `config.ts` (Tavily constants), `types.ts` (Tavily response types), `index.ts` (no changes expected).
- **New env var**: `TAVILY_API_KEY` — optional; absence skips Tavily silently.
- **Dependencies**: No new npm dependencies; uses native `fetch`.
- **Cost**: Each `web_search` call consumes 1 Tavily API credit (free tier: 1,000/month) when `TAVILY_API_KEY` is set.
