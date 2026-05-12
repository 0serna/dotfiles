## Why

pi-web-access exists as a full-featured Pi extension providing web search, URL fetching, video analysis, and more across multiple providers (Exa, Perplexity, Gemini). But most of its complexity — curator UI, background fetch, multi-provider fallbacks, PDF/video/GitHub support — is unnecessary when the goal is just to search the web and fetch page content using Exa's free API key. A minimal, self-contained extension with just two tools and no dependency on orchestration infrastructure is simpler to maintain, faster to ship, and easier to reason about.

## What Changes

- New Pi extension at `dotfiles/pi/agent/extensions/web-tools.ts` with two tools: `web_search` and `web_fetch`
- Uses the Exa HTTP API directly via `fetch()` — no SDK, no package.json, no install step
- `web_search` calls `POST https://api.exa.ai/search` with the raw query and parameters
- `web_fetch` attempts content retrieval through Exa first; falls back to HTTP+Readability extraction
- API key read exclusively from `EXA_API_KEY` environment variable — no config files
- API surface is minimal: single query per call, single URL per call, limited optional parameters
- Self-contained architecture: no multi-provider fallbacks, no curator UI, no background fetch, no video/PDF/GitHub handling
- No existing code is modified — this is a greenfield single-file extension

## Capabilities

### New Capabilities

- `web-search`: Search the web via the Exa API. Accepts a single query string with optional parameters (numResults, recencyFilter, domainFilter). Returns an AI-synthesized answer with source citations.
- `web-fetch`: Fetch and extract readable content from a single URL. Attempts Exa-assisted content retrieval first; falls back to HTTP fetch + Readability/Turndown extraction when Exa doesn't provide sufficient content.

### Modified Capabilities

_(None — new project, no existing capabilities are affected.)_

## Impact

- **New extension**: Single TypeScript file at `dotfiles/pi/agent/extensions/web-tools.ts`
- **Dependencies**: `@mozilla/readability`, `linkedom`, `turndown` for the HTTP fallback (no SDK needed — Exa API called via native `fetch()`)
- **Configuration**: `EXA_API_KEY` environment variable — no config files, no JSON parsing
- **No changes** to existing Pi configuration, other extensions, or any project in this repository
- **No breaking changes** — this is additive only
