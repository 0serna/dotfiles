## Context

This extension provides two web-access tools (`web_search` and `web_fetch`) as a Pi extension, using the Exa API as its primary data source. The design is inspired by `pi-web-access` but deliberately scoped to a minimal single-file extension with no SDK, no package.json, no multi-provider fallbacks, no curator UI, no background fetch infrastructure, and no video/PDF/GitHub special handling. The Exa HTTP API called directly via `fetch()` with the user's free API key is the sole search provider.

## Goals / Non-Goals

**Goals:**

- Register two Pi tools: `web_search` and `web_fetch`
- Use the Exa HTTP API directly via `fetch()` with the free API key
- Leverage Exa-first for content fetching, with a simple HTTP+Readability fallback
- Keep the extension as a single TypeScript file with minimal dependencies
- Provide a minimal but useful API surface: single query, single URL, limited parameters

**Non-Goals:**

- Multi-provider orchestration or fallback chains
- Curator UI or browser-based search review
- Background content fetching with stored result IDs
- Video, PDF, GitHub, or other special content type handling
- Multiple queries per call or advanced batch operations
- Persistent cache or result storage
- Integration with any Pi session lifecycle beyond basic tool registration

## Decisions

### Decision: Direct Exa HTTP API via fetch() — no SDK

- **Why**: The Exa search API is a straightforward POST endpoint. Calling it via native `fetch()` eliminates the need for an SDK dependency, a package.json, and an npm install step. The extension remains a single file with zero runtime dependencies for its primary path. The API surface is simple enough that an SDK adds wrapping overhead without meaningful benefit.
- **Alternatives considered**: Exa TypeScript SDK (adds a dependency and install step for minimal abstraction over one endpoint); Exa MCP (requires MCP infrastructure, less direct control).

### Decision: Exa-first content retrieval with HTTP fallback for web_fetch

- **Why**: Exa's contents API can return text content for a URL when available, which is simpler and more reliable than HTTP extraction for many sites. When Exa returns insufficient content, a direct HTTP fetch with Readability+Turndown extraction provides a fallback. This matches the user's preference for Exa-centric semantics.
- **Alternatives considered**: HTTP-only fetch (misses Exa's content advantage); Exa-only with no fallback (fails on sites Exa doesn't index well).

### Decision: Minimal API surface

- **Why**: The user explicitly chose "API mínima" — single query per call, single URL per call, limited optional parameters. This keeps the codebase small and the extension predictable.
- **Parameters for web_search**: `query` (required), `numResults` (optional), `recencyFilter` (optional), `domainFilter` (optional).
- **Parameters for web_fetch**: `url` (required). No extras in v1.

### Decision: API key exclusively from EXA_API_KEY environment variable

- **Why**: No config files, no JSON parsing, no file-system dependency. The extension reads `process.env.EXA_API_KEY` directly. This is the simplest possible configuration path and keeps the extension stateless.
- **Alternatives considered**: JSON config file at `~/.pi/web-search.json` (adds file I/O, parsing, and a secondary config surface for no benefit when a single env var suffices).

### Decision: Readability + Turndown for HTTP fallback extraction

- **Why**: These are the same dependencies `pi-web-access` uses for its HTTP extraction path. They are well-tested, handle most common page structures, and produce clean markdown output. These are loaded from the Pi runtime's node_modules, not from a local package.json.
- **Alternatives considered**: Pure text extraction (loses structure); jsdom alternative (heavier, same result).

## Risks / Trade-offs

- **[Risk] Free Exa API key may have rate limits or query caps** → Accept as a v1 constraint. Document the limit clearly. No rate-limiting logic in the extension itself.
- **[Risk] Exa-first web_fetch may return different content than a direct HTTP fetch of the URL** → Accept this as by-design. The tool's semantics are "content retrieval centered on Exa with HTTP fallback", not "exact URL fetch".
- **[Risk] HTTP fallback fails on JS-heavy pages** → Accept as in-scope for v1. The user explicitly chose "básico HTML" for fetch, not promising JS-heavy support.
- **[Risk] Exa API endpoint or response format changes** → The extension calls a documented REST endpoint. Breaking changes are unlikely and would be noticed quickly. If they occur, the fix is a single-file edit rather than a dependency update.
