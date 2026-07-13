## 1. Firecrawl contract and adapter tests

- [x] 1.1 Add failing tests for Firecrawl Search and Scrape request bodies, 30-second abort handling, cloud endpoint selection, authenticated bearer headers, and keyless omission of Authorization.
- [x] 1.2 Add failing tests for mapping Firecrawl `data.web` search results and extracting non-empty Scrape `data.markdown` content.
- [x] 1.3 Add failing tests for non-2xx, 429, malformed JSON, empty content, and timeout outcomes, including structured success/failure log events without credentials.

## 2. Firecrawl REST integration

- [x] 2.1 Add Firecrawl cloud Search/Scrape endpoint constants and the shared 30-second timeout configuration.
- [x] 2.2 Implement the typed native-fetch Firecrawl module with optional `FIRECRAWL_API_KEY` bearer authentication and defensive response parsing.
- [x] 2.3 Implement Firecrawl Search result conversion and Scrape Markdown extraction with standardized diagnostics and clean partial-failure returns.

## 3. Search orchestration

- [x] 3.1 Add failing orchestration tests for Firecrawl-only, Exa+Firecrawl, Tavily+Firecrawl, and three-provider parallel search paths.
- [x] 3.2 Add failing tests for stable Exa → Tavily → Firecrawl round-robin interleaving, case-insensitive URL deduplication, partial/total failures, and provider-count details.
- [x] 3.3 Extend search result/provider types and generalize search orchestration to run all eligible providers concurrently with two results per provider.
- [x] 3.4 Update search result rendering to report all contributing provider counts while preserving provider-transparent LLM-visible results.

## 4. Fetch retrieval cascade

- [x] 4.1 Add failing retrieval tests proving the order GitHub → HTTP → Firecrawl → Cloudflare → Exa and short-circuit behavior at each successful tier.
- [x] 4.2 Add failing tests for Firecrawl failure fallthrough, source tracking, renderer labeling, and cache reuse of Firecrawl results.
- [x] 4.3 Add the Firecrawl retrieval adapter between HTTP and Cloudflare and extend retrieval source types and fallback diagnostics.
- [x] 4.4 Add the `firecrawl` source label to the `web_fetch` result renderer.

## 5. Verification

- [x] 5.1 Run the focused web-search extension tests and resolve all failures.
- [x] 5.2 Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run format`, and `npm run openspec`; fix every reported issue.
- [x] 5.3 Verify the final diff contains no Firecrawl credentials, no SDK dependency, and no self-hosted/base-URL configuration.
