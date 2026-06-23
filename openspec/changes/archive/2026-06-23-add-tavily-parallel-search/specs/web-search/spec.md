## MODIFIED Requirements

### Requirement: Search with query string

The system SHALL accept a single query string and execute parallel searches through Exa and Tavily APIs when both API keys are available. The system SHALL request 2 results from each provider, merge the results by interleaving them in ranking order, deduplicate by URL, and return a unified result list without provider labels to the LLM. When only one provider's API key is available, the system SHALL use that provider exclusively with its default result count.

#### Scenario: Parallel search returns merged results

- **WHEN** the user calls `web_search` with query "TypeScript best practices" and both `EXA_API_KEY` and `TAVILY_API_KEY` are set
- **THEN** the system SHALL execute Exa and Tavily searches in parallel, each requesting 2 results, and return a deduplicated merged list of up to 4 results with title, URL, and snippet

#### Scenario: Tavily absent falls back to Exa only

- **WHEN** the user calls `web_search` with a valid query and `TAVILY_API_KEY` is not set
- **THEN** the system SHALL skip Tavily silently and return results from Exa only using the default result count

#### Scenario: Exa absent falls back to Tavily only

- **WHEN** the user calls `web_search` with a valid query and `EXA_API_KEY` is not set but `TAVILY_API_KEY` is set
- **THEN** the system SHALL skip Exa and return results from Tavily only

#### Scenario: Both providers fail

- **WHEN** both Exa and Tavily searches fail or return no results
- **THEN** the system SHALL return an error indicating the search failed

#### Scenario: One provider fails with partial success

- **WHEN** one provider returns results and the other fails
- **THEN** the system SHALL return the successful provider's results without error

#### Scenario: Search with empty query

- **WHEN** the user calls `web_search` with an empty string
- **THEN** the system SHALL return an error indicating that a query is required

#### Scenario: Deduplicated results

- **WHEN** Exa and Tavily return results with overlapping URLs
- **THEN** the system SHALL include each URL only once in the merged result list, preserving the first occurrence in interleave order

#### Scenario: Result format is provider-transparent

- **WHEN** the system returns search results to the LLM
- **THEN** each result SHALL contain only the title, URL, and snippet without any provider label

## ADDED Requirements

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

### Requirement: Result merging and interleaving

The system SHALL merge results from multiple search providers by interleaving them in ranking order (Exa[0], Tavily[0], Exa[1], Tavily[1]) and deduplicating by URL (case-insensitive). The first occurrence in interleave order SHALL be kept.

#### Scenario: Interleave two providers with 2 results each

- **WHEN** Exa returns results [A, B] and Tavily returns results [C, D]
- **THEN** the merged order SHALL be [A, C, B, D]

#### Scenario: Interleave with partial provider results

- **WHEN** Exa returns results [A, B] and Tavily returns results [C]
- **THEN** the merged order SHALL be [A, C, B]

#### Scenario: Deduplicate overlapping URLs

- **WHEN** Exa returns [url1, url2] and Tavily returns [url1, url3]
- **THEN** the merged list SHALL contain [url1, url3, url2] with url1 appearing only once at its first interleave position

### Requirement: Display search provider counts in renderer

The system SHALL display the total unique source count and per-provider received counts in the `web_search` tool result renderer when multiple providers contribute results.

#### Scenario: Both providers return results

- **WHEN** the tool result has results from both Exa and Tavily
- **THEN** the renderer SHALL display the unique count with per-provider breakdown (e.g., `3 sources (2 exa, 2 tavily)`)

#### Scenario: Single provider active

- **WHEN** only one provider returned results (other absent or failed)
- **THEN** the renderer SHALL display only the total count without per-provider breakdown (e.g., `2 sources`)

#### Scenario: Search error

- **WHEN** the tool result is an error (both providers failed)
- **THEN** the renderer SHALL display "search error"

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
