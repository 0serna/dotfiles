## Context

The `web-search` extension has two tools (`web_search`, `web_fetch`) with complex orchestration:

- **`executeWebSearch`**: checks `EXA_API_KEY` and `TAVILY_API_KEY` presence, runs parallel `Promise.allSettled`, merges/deduplicates results, handles partial success and total failure.
- **`executeWebFetch`**: 4-tier fallback chain (GitHub → HTTP → Cloudflare → Exa) with in-process cache, source tracking, and fallback logging.

Existing tests cover only `github.ts` (URL classification + rendering). The `github.test.ts` file is broken — it asserts `/releases` is unsupported, but the code now supports releases and release-tags.

The extension uses ESM modules with `.ts` extensions in imports. Vitest is already a dev dependency and supports `vi.mock` for ESM module mocking.

## Goals / Non-Goals

**Goals:**

- Fix the broken `github.test.ts` assertion for `/releases`.
- Add behavioral tests for `executeWebSearch` covering all orchestration paths.
- Add behavioral tests for `executeWebFetch` covering fallback order, cache, and source tracking.

**Non-Goals:**

- 100% line coverage or coverage thresholds.
- Testing API client modules (`exa.ts`, `tavily.ts`, `cloudflare.ts`, `http.ts`) in isolation — they are thin `fetch` wrappers tested through orchestration.
- Testing renderer functions (`renderWebSearchResult`, `renderWebFetchResult`) — low risk, trivial logic.
- Integration tests against real Exa/Tavily/Cloudflare/GitHub APIs.
- Testing `profiles.test.ts` failures (unrelated to this extension).

## Decisions

### D1: Mock at module level with `vi.mock`

Use `vi.mock("./exa.ts", ...)` and `vi.mock("./tavily.ts", ...)` to replace API client modules with controlled stubs. This tests orchestration logic without real HTTP calls.

**Alternative considered:** Mock global `fetch`. Rejected because it requires intercepting specific URL patterns and is fragile — module-level mocking is cleaner and tests the actual orchestration decisions.

### D2: Test `executeWebSearch` and `executeWebFetch` as entry points

Test the exported `execute*` functions directly. They are async and return `TextToolResult`, which is easy to assert on (`content[0].text`, `details`, `isError`).

### D3: Control API key presence via `process.env` manipulation

Set/unset `EXA_API_KEY` and `TAVILY_API_KEY` in `beforeEach`/`afterEach` to test each orchestration path. Vitest runs in a single process, so env vars are mutable.

### D4: Test `web_fetch` pipeline with mocked tier modules

Mock `github.ts`, `http.ts`, `cloudflare.ts`, and `exa.ts` to return controlled successes/failures. Verify that early-tier success prevents later-tier calls (using `vi.fn()` call counts). Test cache by calling `executeWebFetch` twice with the same URL.

### D5: Keep tests out of `check.sh`

Do not add Vitest to `scripts/check.sh`. The repository currently has unrelated failing tests outside the web-search extension, and the user explicitly wants focused tests available on demand rather than making the standard quality gate run tests.

**Alternative considered:** Scope `check.sh` to `vitest run dotfiles/pi/agent/extensions/web-search/`. Rejected because the quality gate should remain non-test-based for this repository.

### D6: Fix `github.test.ts` by updating the assertion

Change the test expectation from `toBe("unsupported")` to `toBe("releases")` for the `/releases` URL, and add a test for `/releases/tag/{tag}` matching `release-tag`. Also add assertions for the `owner`/`repo` fields on these new types.

### D7: No spec delta for `web-search`

The proposal lists `web-search` under Modified Capabilities, but there are no spec-level behavior changes — tests verify existing requirements. No delta spec file is created for `web-search`.

## Risks / Trade-offs

- [Module mock fragility] → `vi.mock` paths must match import paths exactly. Mitigation: use relative paths matching the source imports (e.g., `vi.mock("./exa.ts")`).
- [Env var leakage between tests] → Mitigation: save/restore `process.env` keys in `beforeEach`/`afterEach`.
- [Cache state leakage in `web_fetch` tests] → Mitigation: the cache is module-level; test cache behavior in a single `it` block or accept that cache persists across tests in the same file (order-dependent). Alternative: export a `_resetCache` function for testing, but that adds production code for tests. Preferred: test cache hit in a single test that calls `executeWebFetch` twice.
- [Full `npm test` still fails outside this extension] → Existing `profiles.test.ts` failures are unrelated to this change. Mitigation: verify this change with `npx vitest run dotfiles/pi/agent/extensions/web-search/` and keep `check.sh` unchanged.
