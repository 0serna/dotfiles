## MODIFIED Requirements

### Requirement: Regression tests for web_search orchestration

The system SHALL include behavioral tests for `executeWebSearch` that verify provider eligibility and parallel orchestration across Exa, Tavily, and Firecrawl; keyless Firecrawl operation; partial and total failure semantics; deterministic three-provider interleaving; URL deduplication with first-occurrence priority; and provider-count details when multiple providers contribute.

#### Scenario: Three-provider parallel path

- **WHEN** `EXA_API_KEY`, `TAVILY_API_KEY`, and `FIRECRAWL_API_KEY` are set
- **THEN** the tests SHALL verify that Exa, Tavily, and Firecrawl are called concurrently with 2 requested results each and the result contains interleaved merged results

#### Scenario: Keyless Firecrawl path

- **WHEN** `FIRECRAWL_API_KEY` is absent
- **THEN** the tests SHALL verify Firecrawl Search is still called without an Authorization header

#### Scenario: Firecrawl with Exa only

- **WHEN** `EXA_API_KEY` is set and `TAVILY_API_KEY` is absent
- **THEN** the tests SHALL verify Exa and Firecrawl are called and Tavily is not called

#### Scenario: Firecrawl with Tavily only

- **WHEN** `TAVILY_API_KEY` is set and `EXA_API_KEY` is absent
- **THEN** the tests SHALL verify Tavily and Firecrawl are called and Exa is not called

#### Scenario: Firecrawl only

- **WHEN** neither Exa nor Tavily credentials are configured
- **THEN** the tests SHALL verify keyless Firecrawl results can satisfy the search

#### Scenario: Partial success from any provider

- **WHEN** at least one eligible provider fails and another returns usable results
- **THEN** the tests SHALL verify the successful results are returned without error

#### Scenario: All eligible providers fail

- **WHEN** every eligible provider rejects, returns null, or returns no usable results
- **THEN** the tests SHALL verify `executeWebSearch` throws a search failure

#### Scenario: Three-provider URL deduplication and ordering

- **WHEN** Exa, Tavily, and Firecrawl return ranked results with overlapping URLs
- **THEN** the tests SHALL verify round-robin order Exa → Tavily → Firecrawl and one retained occurrence per case-insensitive URL

#### Scenario: Provider details for multiple contributors

- **WHEN** at least two providers return usable results
- **THEN** the tests SHALL verify `details.providers` contains the received result count for each contributor

#### Scenario: Provider details for one contributor

- **WHEN** only one provider returns usable results
- **THEN** the tests SHALL verify `details.providers` is absent

#### Scenario: Empty query returns error

- **WHEN** `executeWebSearch` is called with an empty or whitespace-only query
- **THEN** the tests SHALL verify it throws an error indicating a query is required

### Requirement: Regression tests for web_fetch pipeline

The system SHALL include behavioral tests for `executeWebFetch` and the Firecrawl adapter that verify five-tier fallback ordering, authenticated and keyless requests, cache short-circuit behavior, source tracking, renderer labeling, partial Firecrawl failure, and clean error when all tiers fail.

#### Scenario: GitHub success short-circuits pipeline

- **WHEN** a recognized GitHub URL is fetched successfully
- **THEN** the tests SHALL verify HTTP, Firecrawl, Cloudflare, and Exa are not called and `details.source` is a GitHub source

#### Scenario: HTTP success short-circuits before rendered retrieval

- **WHEN** direct HTTP returns content
- **THEN** the tests SHALL verify Firecrawl, Cloudflare, and Exa are not called and `details.source` is `http-fallback`

#### Scenario: Firecrawl success short-circuits before Cloudflare and Exa

- **WHEN** HTTP returns null and Firecrawl Scrape returns Markdown
- **THEN** the tests SHALL verify Cloudflare and Exa are not called and `details.source` is `firecrawl`

#### Scenario: Firecrawl failure continues to Cloudflare

- **WHEN** HTTP and Firecrawl do not provide content and Cloudflare succeeds
- **THEN** the tests SHALL verify Cloudflare content is returned and Exa is not called

#### Scenario: Firecrawl authenticated request

- **WHEN** `FIRECRAWL_API_KEY` is set
- **THEN** the adapter tests SHALL verify Search and Scrape requests include its bearer Authorization header

#### Scenario: Firecrawl keyless request

- **WHEN** `FIRECRAWL_API_KEY` is absent
- **THEN** the adapter tests SHALL verify Search and Scrape requests omit the Authorization header

#### Scenario: Firecrawl malformed or empty response

- **WHEN** Firecrawl returns invalid JSON or no usable Markdown
- **THEN** the tests SHALL verify the scrape adapter returns null and the retrieval cascade continues

#### Scenario: Firecrawl rate limit

- **WHEN** Firecrawl returns HTTP 429
- **THEN** the tests SHALL verify no retry occurs and the retrieval cascade continues

#### Scenario: Cache hit avoids redundant calls

- **WHEN** `executeWebFetch` is called twice with the same URL and the first call succeeds through Firecrawl
- **THEN** the tests SHALL verify the second call returns cached content and no retrieval adapter is called again

#### Scenario: Firecrawl source renderer label

- **WHEN** a fetch result has source `firecrawl`
- **THEN** the renderer test SHALL verify it displays the `firecrawl` label beside the content size

#### Scenario: All tiers fail produces clean error

- **WHEN** all five retrieval tiers return null or reject
- **THEN** the tests SHALL verify `executeWebFetch` throws a descriptive fetch error

#### Scenario: Invalid URL returns error

- **WHEN** `executeWebFetch` is called with a non-HTTP URL or empty string
- **THEN** the tests SHALL verify it throws an invalid URL error
