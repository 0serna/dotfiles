# web Specification

## Purpose

Web search via multiple providers (Exa, Tavily, Firecrawl) with parallel execution, result merging, and diagnostics logging.

## Requirements

### Requirement: Search with query string

The system SHALL accept a single query string and execute eligible searches in parallel through Exa, Tavily, and Firecrawl. Firecrawl SHALL always be eligible through authenticated or keyless access; Exa and Tavily SHALL be eligible when their respective API keys are configured. The system SHALL request 2 results from each eligible provider, merge the results by interleaving them in ranking order, deduplicate by URL, and return a unified result list without provider labels to the LLM.

#### Scenario: Three-provider parallel search returns merged results

- **WHEN** the user calls `web_search` with query "TypeScript best practices" and `EXA_API_KEY`, `TAVILY_API_KEY`, and `FIRECRAWL_API_KEY` are set
- **THEN** the system SHALL execute Exa, Tavily, and Firecrawl searches in parallel, each requesting 2 results, and return a deduplicated merged list of up to 6 results with title, URL, and snippet

#### Scenario: Firecrawl supplements Exa when Tavily is absent

- **WHEN** the user calls `web_search` with a valid query, `EXA_API_KEY` is set, and `TAVILY_API_KEY` is not set
- **THEN** the system SHALL execute Exa and Firecrawl searches in parallel and skip Tavily silently

#### Scenario: Firecrawl supplements Tavily when Exa is absent

- **WHEN** the user calls `web_search` with a valid query, `TAVILY_API_KEY` is set, and `EXA_API_KEY` is not set
- **THEN** the system SHALL execute Tavily and Firecrawl searches in parallel and skip Exa silently

#### Scenario: Firecrawl keyless is the only eligible provider

- **WHEN** neither `EXA_API_KEY` nor `TAVILY_API_KEY` nor `FIRECRAWL_API_KEY` is set
- **THEN** the system SHALL execute Firecrawl Search without authorization and return its usable results

#### Scenario: All eligible providers fail

- **WHEN** all eligible provider searches fail or return no usable results
- **THEN** the system SHALL return an error indicating the search failed

#### Scenario: One provider fails with partial success

- **WHEN** at least one eligible provider returns results and another eligible provider fails
- **THEN** the system SHALL return the successful provider results without error

#### Scenario: Search with empty query

- **WHEN** the user calls `web_search` with an empty string
- **THEN** the system SHALL return an error indicating that a query is required

#### Scenario: Deduplicated results

- **WHEN** multiple providers return results with overlapping URLs
- **THEN** the system SHALL include each URL only once in the merged result list, preserving the first occurrence in interleave order

#### Scenario: Result format is provider-transparent

- **WHEN** the system returns search results to the LLM
- **THEN** each result SHALL contain only the title, URL, and snippet without any provider label

### Requirement: Tavily search provider

The system SHALL integrate the Tavily Search API as a parallel search provider, calling `POST https://api.tavily.com/search` with `max_results=2`, `search_depth=basic`, and no `include_answer`. The system SHALL authenticate using a Bearer token from the `TAVILY_API_KEY` environment variable.

#### Scenario: Successful Tavily search

- **WHEN** the system calls the Tavily Search API with a valid query and API key
- **THEN** the system SHALL return up to 2 results with title, URL, and content snippet

#### Scenario: Tavily API key absent

- **WHEN** `TAVILY_API_KEY` environment variable is not set
- **THEN** the system SHALL skip the Tavily search without making any HTTP request and without logging an error

#### Scenario: Tavily API error

- **WHEN** the Tavily Search API returns a non-2xx status or the request times out
- **THEN** the system SHALL log the failure with error details and return null, allowing partial success from Exa

### Requirement: Firecrawl search provider

The system SHALL integrate Firecrawl Cloud Search as a parallel search provider by calling `POST https://api.firecrawl.dev/v2/search` with the query and a limit of 2 results. The request SHALL include `Authorization: Bearer <FIRECRAWL_API_KEY>` when `FIRECRAWL_API_KEY` is configured and SHALL omit authorization otherwise. The system SHALL map usable entries from `data.web` to provider-transparent title, URL, and snippet results.

#### Scenario: Authenticated Firecrawl search

- **WHEN** `FIRECRAWL_API_KEY` is configured and the user submits a valid query
- **THEN** the system SHALL call Firecrawl Search with the bearer API key and request 2 results

#### Scenario: Keyless Firecrawl search

- **WHEN** `FIRECRAWL_API_KEY` is not configured and the user submits a valid query
- **THEN** the system SHALL call Firecrawl Search without an Authorization header and request 2 results

#### Scenario: Firecrawl search failure is partial

- **WHEN** Firecrawl Search returns a non-2xx response, invalid response, no usable results, or times out while another provider returns results
- **THEN** the system SHALL omit Firecrawl results and return the successful provider results without error

### Requirement: Result merging and interleaving

The system SHALL merge results from eligible search providers by interleaving them in ranking order using the stable provider order Exa, Tavily, Firecrawl and deduplicating by URL case-insensitively. The first occurrence in interleave order SHALL be kept.

#### Scenario: Interleave three providers with 2 results each

- **WHEN** Exa returns [A, B], Tavily returns [C, D], and Firecrawl returns [E, F]
- **THEN** the merged order SHALL be [A, C, E, B, D, F]

#### Scenario: Interleave with partial provider results

- **WHEN** Exa returns [A, B], Tavily returns [C], and Firecrawl returns [D, E]
- **THEN** the merged order SHALL be [A, C, D, B, E]

#### Scenario: Interleave only eligible providers

- **WHEN** Exa is absent, Tavily returns [A, B], and Firecrawl returns [C, D]
- **THEN** the merged order SHALL be [A, C, B, D]

#### Scenario: Deduplicate overlapping URLs

- **WHEN** Exa returns [url1, url2], Tavily returns [url1, url3], and Firecrawl returns [url2, url4]
- **THEN** the merged list SHALL contain [url1, url2, url3, url4] with each URL appearing only once at its first interleave position

### Requirement: Display search provider counts in renderer

The system SHALL display the total unique source count and per-provider received counts in the `web_search` tool result renderer when at least two providers contribute results. The provider breakdown SHALL include each contributing provider among Exa, Tavily, and Firecrawl.

#### Scenario: Three providers return results

- **WHEN** the tool result has results from Exa, Tavily, and Firecrawl
- **THEN** the renderer SHALL display the unique count with all provider counts, for example `5 sources (2 exa, 2 tavily, 2 firecrawl)`

#### Scenario: Two providers return results

- **WHEN** exactly two providers contribute results
- **THEN** the renderer SHALL display the unique count with only those two provider counts

#### Scenario: Single provider active

- **WHEN** only one provider returned results
- **THEN** the renderer SHALL display only the total count without a provider breakdown, for example `2 sources`

#### Scenario: Search error

- **WHEN** the tool result is an error because all eligible providers failed
- **THEN** the renderer SHALL display `search error`

### Requirement: Optional result count

The system SHALL accept an optional `numResults` parameter to control the number of search results returned per query.

#### Scenario: Custom result count

- **WHEN** the user calls `web_search` with query "Rust async" and `numResults` set to 10
- **THEN** the system SHALL return up to 10 results for the query

#### Scenario: Default result count

- **WHEN** the user calls `web_search` with query "Python testing" and no `numResults` parameter
- **THEN** the system SHALL use a default of 5 results

### Requirement: Recency filter

The system SHALL accept an optional `recencyFilter` parameter to limit results by publication date.

#### Scenario: Filter by last week

- **WHEN** the user calls `web_search` with query "React 19" and `recencyFilter` set to "week"
- **THEN** the system SHALL only return results published within the last 7 days

#### Scenario: Invalid recency value

- **WHEN** the user calls `web_search` with `recencyFilter` set to an unsupported value
- **THEN** the system SHALL ignore the invalid filter and return results without date filtering

### Requirement: Domain filter

The system SHALL accept an optional `domainFilter` parameter to include or exclude specific domains.

#### Scenario: Include specific domain

- **WHEN** the user calls `web_search` with query "tailwindcss components" and `domainFilter` set to `["github.com"]`
- **THEN** the system SHALL only return results from github.com

#### Scenario: Exclude domain

- **WHEN** the user calls `web_search` with query "SEO tools" and `domainFilter` set to `["-spam-site.com"]`
- **THEN** the system SHALL exclude results from spam-site.com

### Requirement: Error handling

The system SHALL return a descriptive error message when the Exa API is unreachable, the API key is invalid, or the query fails.

#### Scenario: Invalid API key

- **WHEN** the Exa API key is invalid or missing
- **THEN** the system SHALL return an error indicating authentication failure

#### Scenario: API timeout

- **WHEN** the Exa API does not respond within the timeout period
- **THEN** the system SHALL return an error indicating the request timed out

### Requirement: Log search outcomes for diagnostics

The system SHALL log successful and failed Exa Search API calls to the persistent log file, enabling monitoring of search health and usage patterns.

#### Scenario: Log successful search

- **WHEN** the system calls `web_search` and the Exa API returns results successfully
- **THEN** the system SHALL log the event with the query string and the number of results returned

#### Scenario: Log failed search

- **WHEN** the system calls `web_search` and the Exa API returns an error
- **THEN** the system SHALL log the event with the query string and the HTTP status or error description

#### Scenario: Log empty results

- **WHEN** the system calls `web_search` and the Exa API returns zero results
- **THEN** the system SHALL log the event with the query string and a zero result count

### Requirement: Log Tavily search events for diagnostics

The system SHALL log successful and failed Tavily Search API calls to the persistent log file, consistent with existing Exa search logging patterns.

#### Scenario: Log successful Tavily search

- **WHEN** the Tavily Search API returns results successfully
- **THEN** the system SHALL log a `tavily_search_success` event with the query string and the number of results returned

#### Scenario: Log failed Tavily search

- **WHEN** the Tavily Search API returns an error or times out
- **THEN** the system SHALL log a `tavily_search_failure` event with the query string and failure details

#### Scenario: Log Tavily skip due to missing API key

- **WHEN** the Tavily search is skipped because `TAVILY_API_KEY` is not set
- **THEN** the system SHALL NOT log any event for the skip
