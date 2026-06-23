## Purpose

Regression tests for the web-search extension covering provider orchestration, fetch pipeline fallback, cache behavior, and GitHub URL classification.

## Requirements

### Requirement: Regression tests for web_search orchestration

The system SHALL include behavioral tests for `executeWebSearch` that verify all provider orchestration paths: Exa-only when `TAVILY_API_KEY` is absent, Tavily-only when `EXA_API_KEY` is absent, parallel execution when both keys are present, partial success when one provider fails, total failure when both providers fail or return no results, URL deduplication with first-occurrence priority, and correct `details.providers` population only when both providers contribute.

#### Scenario: Exa-only path

- **WHEN** `TAVILY_API_KEY` is not set and `EXA_API_KEY` is set
- **THEN** the test SHALL verify that `callExaSearch` is called with default `numResults` (undefined) and `callTavilySearch` is not called, and the result contains Exa-formatted content

#### Scenario: Tavily-only path

- **WHEN** `EXA_API_KEY` is not set and `TAVILY_API_KEY` is set
- **THEN** the test SHALL verify that `callTavilySearch` is called and `callExaSearch` is not called, and the result contains merged-format content

#### Scenario: Parallel path with both providers

- **WHEN** both `EXA_API_KEY` and `TAVILY_API_KEY` are set
- **THEN** the test SHALL verify that `callExaSearch` is called with `numResults=2` and `callTavilySearch` is called, and the result contains interleaved merged results

#### Scenario: Partial success — Exa fails, Tavily succeeds

- **WHEN** `callExaSearch` rejects and `callTavilySearch` returns results
- **THEN** the test SHALL verify the result contains Tavily results without error and `isError` is false

#### Scenario: Partial success — Tavily fails, Exa succeeds

- **WHEN** `callTavilySearch` returns null and `callExaSearch` returns results
- **THEN** the test SHALL verify the result contains Exa results without error and `isError` is false

#### Scenario: Both providers fail

- **WHEN** both `callExaSearch` rejects and `callTavilySearch` returns null
- **THEN** the test SHALL verify the result has `isError: true`

#### Scenario: Both providers return no results

- **WHEN** both providers return empty result arrays
- **THEN** the test SHALL verify the result has `isError: true`

#### Scenario: URL deduplication

- **WHEN** Exa and Tavily return results with one overlapping URL
- **THEN** the test SHALL verify the merged result contains the URL only once, preserving the first occurrence in interleave order

#### Scenario: details.providers only when both contribute

- **WHEN** both providers return at least one result
- **THEN** the test SHALL verify `details.providers` is populated with per-provider counts
- **WHEN** only one provider returns results
- **THEN** the test SHALL verify `details.providers` is absent

#### Scenario: Empty query returns error

- **WHEN** `executeWebSearch` is called with an empty or whitespace-only query
- **THEN** the test SHALL verify the result has `isError: true`

### Requirement: Regression tests for web_fetch pipeline

The system SHALL include behavioral tests for `executeWebFetch` that verify the fallback chain ordering, cache short-circuit behavior, source tracking in `details`, and clean error when all tiers fail.

#### Scenario: GitHub success short-circuits pipeline

- **WHEN** a GitHub URL is fetched and `tryGitHubFetch` returns content
- **THEN** the test SHALL verify that `extractViaHttp`, `tryCloudflareMarkdown`, and `callExaContents` are not called, and `details.source` is a GitHub source

#### Scenario: HTTP success short-circuits before Cloudflare and Exa

- **WHEN** a non-GitHub URL is fetched and `extractViaHttp` returns content
- **THEN** the test SHALL verify that `tryCloudflareMarkdown` and `callExaContents` are not called, and `details.source` is `"http-fallback"`

#### Scenario: Cloudflare success short-circuits before Exa

- **WHEN** HTTP returns null and `tryCloudflareMarkdown` returns content
- **THEN** the test SHALL verify that `callExaContents` is not called, and `details.source` is `"cloudflare"`

#### Scenario: All tiers fail produces clean error

- **WHEN** all fetch tiers return null or reject
- **THEN** the test SHALL verify the result has `isError: true` with a descriptive error message

#### Scenario: Cache hit avoids redundant calls

- **WHEN** `executeWebFetch` is called twice with the same URL and the first call succeeds
- **THEN** the test SHALL verify the second call returns cached content and no tier module is called again

#### Scenario: Invalid URL returns error

- **WHEN** `executeWebFetch` is called with a non-HTTP URL or empty string
- **THEN** the test SHALL verify the result has `isError: true`

### Requirement: GitHub URL classification tests reflect current supported types

The system SHALL include test assertions for `classifyGitHubUrl` that recognize `releases` and `release-tag` as supported URL types, replacing the obsolete assertion that expected `/releases` to be unsupported.

#### Scenario: Releases URL is classified as supported

- **WHEN** `classifyGitHubUrl` is called with `https://github.com/owner/repo/releases`
- **THEN** the test SHALL verify the result type is `"releases"` with correct `owner` and `repo`

#### Scenario: Release tag URL is classified as supported

- **WHEN** `classifyGitHubUrl` is called with `https://github.com/owner/repo/releases/tag/v1.0`
- **THEN** the test SHALL verify the result type is `"release-tag"` with correct `owner`, `repo`, and `tag`
