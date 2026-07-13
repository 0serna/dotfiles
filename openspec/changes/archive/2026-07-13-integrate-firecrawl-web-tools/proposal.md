## Why

The web tools currently depend on Exa and Tavily for search and have no credential-free rendered-page retrieval tier between direct HTTP and credentialed Cloudflare/Exa fallbacks. Firecrawl's cloud free tier can improve search diversity and make JavaScript-rendered content available with optional authentication, without changing the public tool interfaces.

## What Changes

- Add Firecrawl Search as a parallel peer to Exa and Tavily in `web_search`.
- Merge, URL-deduplicate, and report results from all contributing search providers.
- Add Firecrawl Scrape between direct HTTP retrieval and Cloudflare Browser Run in the `web_fetch` retrieval cascade.
- Support Firecrawl cloud requests with `FIRECRAWL_API_KEY` when configured and keyless requests otherwise.
- Treat Firecrawl failures as partial failures: omit failed search results and continue the retrieval cascade after failed scrapes.
- Add structured Firecrawl search and scrape diagnostics and regression coverage.

## Capabilities

### New Capabilities

<!-- No new standalone capabilities. -->

### Modified Capabilities

- `web-search`: Add Firecrawl as a parallel search provider and extend result merging and provider reporting to three providers.
- `web-fetch`: Add Firecrawl Scrape as a new retrieval adapter between direct HTTP and Cloudflare Browser Run.
- `web-tools-logging`: Record structured Firecrawl search and scrape success and failure events.
- `web-search-regression-tests`: Cover Firecrawl orchestration, partial failures, authentication modes, and retrieval ordering.

## Impact

- Affects `dotfiles/pi/agent/extensions/web-search/`, including provider types, configuration, search orchestration, retrieval ordering, rendering, logging, and tests.
- Adds outbound calls to Firecrawl Cloud v2 Search and Scrape endpoints; no SDK or package dependency is introduced.
- Adds optional `FIRECRAWL_API_KEY` configuration while preserving keyless operation.
- Does not change the parameters or names of `web_search` and `web_fetch`.
