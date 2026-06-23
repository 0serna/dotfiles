## Why

The `web-search` extension has complex orchestration logic — parallel multi-provider search, fallback chains, caching, and result merging — but only tests for `github.ts` URL classification and rendering. The existing test suite is also broken: `github.test.ts` asserts `/releases` is unsupported, but the code now supports releases. Without focused behavioral tests, changes to provider orchestration or fetch fallback ordering can break silently.

## What Changes

- Fix the obsolete `github.test.ts` assertion that rejects `/releases` as unsupported (now a supported URL type).
- Add `web-search.test.ts` with behavioral tests for `executeWebSearch` using mocked Exa/Tavily modules: Exa-only path, Tavily-only path, parallel path, partial success, both-fail, dedupe/interleave, and `details.providers` population.
- Add `web-fetch.test.ts` with behavioral tests for `executeWebFetch` using mocked fetch tiers: cache hit short-circuits pipeline, GitHub success short-circuits, HTTP success short-circuits before Cloudflare/Exa, all-fail produces clean error, and `details.source` is populated correctly.

## Capabilities

### New Capabilities

- `web-search-regression-tests`: Behavioral test coverage for the web-search extension's orchestration logic (`executeWebSearch`, `executeWebFetch`).

### Modified Capabilities

- `web-search`: No spec-level behavior changes. Tests verify existing requirements.

## Impact

- **Modified files**: `dotfiles/pi/agent/extensions/web-search/github.test.ts` (fix obsolete assertion).
- **New files**: `dotfiles/pi/agent/extensions/web-search/web-search.test.ts`, `dotfiles/pi/agent/extensions/web-search/web-fetch.test.ts`.
- **Dependencies**: No new npm dependencies. Uses existing `vitest` with module-level mocking via `vi.mock`.
- **No spec changes**: Tests verify existing behavior; no new requirements are introduced.
