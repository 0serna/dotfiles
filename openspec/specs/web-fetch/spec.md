# web-fetch Specification

## Purpose

TBD - created by archiving change pi-exa-tools. Update Purpose after archive.

## Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting retrieval through a five-tier fallback chain ordered as GitHub URL optimization, direct HTTP text extraction, Firecrawl Scrape, Cloudflare Browser Run headless rendering, and Exa-assisted retrieval. The system SHALL include the retrieval source name in the tool result details for display purposes. The system SHALL cache successful fetch results in-process for 10 minutes to avoid redundant retrieval on repeated fetches of the same URL.

#### Scenario: Cache hit on repeated fetch

- **WHEN** the user calls `web_fetch` with a URL that was successfully fetched within the last 10 minutes
- **THEN** the system SHALL return the cached content and source without making any HTTP request

#### Scenario: Cache entry expired

- **WHEN** the user calls `web_fetch` with a URL whose cached entry is older than 10 minutes
- **THEN** the system SHALL discard the cache entry and re-run the full fallback chain

#### Scenario: Cache stores successes only

- **WHEN** a previous fetch for a URL failed (error or all tiers returned no content)
- **THEN** the system SHALL NOT cache the result and SHALL re-run the full fallback chain on subsequent fetches

#### Scenario: Successful content retrieval via GitHub optimization

- **WHEN** the user calls `web_fetch` with a recognized public GitHub URL
- **THEN** the system SHALL return optimized content from GitHub raw or API endpoints with source set to `github-raw` or `github-api`

#### Scenario: Successful content retrieval via HTTP text extraction

- **WHEN** the user calls `web_fetch` with a URL that serves `text/plain` content and GitHub optimization does not apply
- **THEN** the system SHALL fetch the content directly via HTTP and return the raw text with source set to `http-fallback`

#### Scenario: HTTP retrieval skips HTML content

- **WHEN** the user calls `web_fetch` with a URL that serves `text/html` content and GitHub optimization does not apply
- **THEN** the system SHALL skip direct HTTP content and continue to Firecrawl Scrape

#### Scenario: Successful content retrieval via Firecrawl

- **WHEN** the user calls `web_fetch` with a URL that neither GitHub optimization nor HTTP text extraction can provide content for and Firecrawl returns Markdown
- **THEN** the system SHALL return the extracted Markdown with source set to `firecrawl`

#### Scenario: Successful content retrieval via Cloudflare Browser Run

- **WHEN** the user calls `web_fetch` with a URL that neither GitHub optimization nor HTTP text extraction can provide content for, and Cloudflare Browser Run credentials are available
- **THEN** the system SHALL launch a headless browser via the Browser Run `/markdown` endpoint, render the page with JavaScript, and return the extracted Markdown content with source set to `cloudflare`

#### Scenario: Successful content retrieval via Exa

- **WHEN** GitHub, HTTP, Firecrawl, and Cloudflare Browser Run cannot provide content
- **THEN** the system SHALL attempt Exa-assisted retrieval and return extracted content with source set to `exa`

#### Scenario: All tiers exhausted

- **WHEN** all five fallback tiers fail to provide content for a URL
- **THEN** the system SHALL return an error indicating the fetch failed

#### Scenario: Invalid URL

- **WHEN** the user calls `web_fetch` with a malformed or empty URL
- **THEN** the system SHALL return an error indicating the URL is invalid

### Requirement: Display retrieval source in tool result

The system SHALL display the retrieval source name alongside the content size in the `web_fetch` tool result renderer. The system SHALL map internal source identifiers to short display labels.

#### Scenario: Display source for GitHub retrieval

- **WHEN** the tool result has `source` set to `github-raw` or `github-api`
- **THEN** the renderer SHALL display the label `github` alongside the content size (e.g., `17.2KB (github)`)

#### Scenario: Display source for Firecrawl retrieval

- **WHEN** the tool result has `source` set to `firecrawl`
- **THEN** the renderer SHALL display the label `firecrawl` alongside the content size, for example `17.2KB (firecrawl)`

#### Scenario: Display source for Exa retrieval

- **WHEN** the tool result has `source` set to `exa`
- **THEN** the renderer SHALL display the label `exa` alongside the content size (e.g., `17.2KB (exa)`)

#### Scenario: Display source for Cloudflare retrieval

- **WHEN** the tool result has `source` set to `cloudflare`
- **THEN** the renderer SHALL display the label `cloudflare` alongside the content size (e.g., `17.2KB (cloudflare)`)

#### Scenario: Display source for HTTP fallback retrieval

- **WHEN** the tool result has `source` set to `http-fallback`
- **THEN** the renderer SHALL display the label `http` alongside the content size (e.g., `17.2KB (http)`)

#### Scenario: Unknown or missing source

- **WHEN** the tool result has no `source` field or an unrecognized source value
- **THEN** the renderer SHALL display only the content size without a source label (e.g., `17.2KB extracted`)

#### Scenario: Error result

- **WHEN** the tool result is an error
- **THEN** the renderer SHALL display only the error message without a source label

### Requirement: Firecrawl Scrape retrieval adapter

The system SHALL call `POST https://api.firecrawl.dev/v2/scrape` with the requested URL, Markdown output, and main-content extraction after direct HTTP retrieval fails and before Cloudflare Browser Run. The request SHALL include `Authorization: Bearer <FIRECRAWL_API_KEY>` when `FIRECRAWL_API_KEY` is configured and SHALL omit authorization otherwise. A successful non-empty `data.markdown` result SHALL be returned with source `firecrawl`.

#### Scenario: Authenticated Firecrawl scrape succeeds

- **WHEN** direct HTTP retrieval does not provide content, `FIRECRAWL_API_KEY` is configured, and Firecrawl returns non-empty Markdown
- **THEN** the system SHALL send the bearer API key and return the Markdown with source `firecrawl` without invoking Cloudflare or Exa

#### Scenario: Keyless Firecrawl scrape succeeds

- **WHEN** direct HTTP retrieval does not provide content, `FIRECRAWL_API_KEY` is not configured, and Firecrawl returns non-empty Markdown
- **THEN** the system SHALL omit the Authorization header and return the Markdown with source `firecrawl`

#### Scenario: Firecrawl scrape fails cleanly

- **WHEN** Firecrawl returns a non-2xx response, HTTP 429, invalid response, empty Markdown, or times out
- **THEN** the system SHALL return no Firecrawl content without retrying and continue to Cloudflare Browser Run

#### Scenario: Firecrawl request timeout

- **WHEN** the Firecrawl request does not complete within 30 seconds
- **THEN** the system SHALL abort it and continue to Cloudflare Browser Run

### Requirement: In-process fetch content cache

The system SHALL maintain an in-process cache of successful `web_fetch` results to avoid redundant HTTP requests when the LLM fetches the same URL multiple times within a session.

#### Scenario: Cache stores content, source, and timestamp

- **WHEN** a fetch succeeds through any fallback tier
- **THEN** the system SHALL store the URL, content, source identifier, and current timestamp in the cache

#### Scenario: Cache returns early on hit

- **WHEN** `tryFetchContent` is called with a URL that has a valid cache entry (not expired)
- **THEN** the system SHALL return the cached content and source immediately without invoking any fallback tier

#### Scenario: No cache size limit

- **WHEN** the process accumulates more than 30 unique cached URLs
- **THEN** the system SHALL continue accepting new entries without eviction, relying on process termination to clear the cache

### Requirement: Cloudflare Browser Run fallback with credentials gating

The system SHALL attempt Cloudflare Browser Run's `/markdown` Quick Action endpoint after Firecrawl Scrape and before Exa-assisted retrieval. The system SHALL skip this fallback silently when required environment variables are not set.

#### Scenario: Skip Browser Run when credentials are absent

- **WHEN** `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` environment variables are not set
- **THEN** the system SHALL skip Browser Run without making any HTTP request and proceed to Exa

#### Scenario: Successful Browser Run extraction

- **WHEN** the Browser Run `/markdown` endpoint returns a successful response with Markdown content after Firecrawl did not provide content
- **THEN** the system SHALL return the Markdown content with source marked as `cloudflare`

#### Scenario: Browser Run returns empty or invalid response

- **WHEN** the Browser Run `/markdown` endpoint returns a response with no usable content
- **THEN** the system SHALL continue to Exa

### Requirement: Browser Run rendering configuration

The system SHALL configure the Browser Run `/markdown` request to fully render JavaScript-heavy pages by waiting for network idle and blocking non-essential resources.

#### Scenario: Wait for network idle

- **WHEN** the system sends a request to the Browser Run `/markdown` endpoint
- **THEN** the system SHALL set `gotoOptions.waitUntil` to `networkidle0` to ensure JavaScript rendering completes before extraction

#### Scenario: Block non-essential resources

- **WHEN** the system sends a request to the Browser Run `/markdown` endpoint
- **THEN** the system SHALL set `rejectResourceTypes` to `["image", "font", "stylesheet"]` to reduce browser time consumption without affecting Markdown text extraction

### Requirement: Browser Run quota and rate-limit handling

The system SHALL handle Cloudflare Browser Run HTTP 429 responses by falling through to the Exa fallback without retrying. When the 429 indicates daily quota exhaustion, the system SHALL cache that state in-process to skip all subsequent Browser Run attempts for the remainder of the process lifetime.

#### Scenario: Cache quota exhaustion for session

- **WHEN** the Browser Run endpoint returns HTTP 429 with a message indicating browser time limit exceeded
- **THEN** the system SHALL set an in-process flag that causes all subsequent Browser Run attempts to return `null` immediately for the remainder of the process lifetime, and SHALL fall through to the Exa fallback

#### Scenario: Fall through on transitory rate limit

- **WHEN** the Browser Run endpoint returns HTTP 429 without a quota-exceeded message
- **THEN** the system SHALL fall through to the Exa fallback without retrying

### Requirement: Browser Run request timeout

The system SHALL enforce a 30-second timeout on Browser Run `/markdown` requests using an AbortController.

#### Scenario: Request exceeds 30 seconds

- **WHEN** the Browser Run `/markdown` request does not complete within 30 seconds
- **THEN** the system SHALL abort the request and fall through to the Exa fallback

### Requirement: Log Browser Run events for diagnostic insights

The system SHALL log Browser Run success and failure events using the shared web tools logging infrastructure, consistent with existing Exa and HTTP fallback logging patterns.

#### Scenario: Log successful Browser Run extraction

- **WHEN** the Browser Run `/markdown` endpoint returns content successfully
- **THEN** the system SHALL log a `cloudflare_markdown_success` event with the URL, elapsed time, and content length

#### Scenario: Log Browser Run failure

- **WHEN** the Browser Run `/markdown` request fails due to HTTP error, timeout, or invalid response
- **THEN** the system SHALL log a `cloudflare_markdown_failure` event with the URL, elapsed time, and failure details

#### Scenario: Log Browser Run skip due to quota cache

- **WHEN** the Browser Run fallback is skipped because the quota-exhausted flag is set
- **THEN** the system SHALL log a `cloudflare_markdown_skipped` event indicating quota exhaustion as the reason

### Requirement: Error handling

The system SHALL return descriptive error messages when fetch operations fail.

#### Scenario: Unreachable URL

- **WHEN** the user calls `web_fetch` with a URL that returns a non-2xx status or is unreachable
- **THEN** the system SHALL return an error with the HTTP status code or connection failure description

#### Scenario: Timeout

- **WHEN** the URL takes too long to respond
- **THEN** the system SHALL return an error indicating the request timed out

### Requirement: Log GitHub rate limit for diagnostic insights

The system SHALL detect GitHub API HTTP 403 rate limit responses and log them with a distinct reason for diagnostic visibility.

#### Scenario: Log rate limited GitHub fetch

- **WHEN** the GitHub API returns HTTP 403 with a response body containing "rate limit"
- **THEN** the system SHALL log a `github_fetch_failure` event with `reason: "rate_limited"` alongside the standard failure details

#### Scenario: Log non-rate-limit GitHub failure

- **WHEN** the GitHub API returns an error that is not a rate limit 403
- **THEN** the system SHALL log a `github_fetch_failure` event without the `rate_limited` reason, preserving the standard failure details

### Requirement: Log Exa statuses for diagnostic insights

The system SHALL inspect the Exa Contents API `statuses` response field to capture specific error tags when content retrieval fails, improving diagnostic visibility beyond generic failure messages.

#### Scenario: Log crawl not found

- **WHEN** the Exa Contents API returns a `CRAWL_NOT_FOUND` status for a URL
- **THEN** the system SHALL log the specific tag and associated HTTP status code

#### Scenario: Log crawl timeout

- **WHEN** the Exa Contents API returns a `CRAWL_TIMEOUT` or `CRAWL_LIVECRAWL_TIMEOUT` status for a URL
- **THEN** the system SHALL log the specific timeout tag

#### Scenario: Log source not available

- **WHEN** the Exa Contents API returns a `SOURCE_NOT_AVAILABLE` status for a URL
- **THEN** the system SHALL log the tag and HTTP 403 status code

#### Scenario: Log unknown error

- **WHEN** the Exa Contents API returns a `CRAWL_UNKNOWN_ERROR` status for a URL
- **THEN** the system SHALL log the tag and associated HTTP status code

#### Scenario: Successful fetch with statuses check

- **WHEN** the Exa Contents API returns successfully for a URL
- **THEN** the system SHALL verify the `statuses` field reflects a success state and log the content length

### Requirement: Optimize recognized public GitHub URLs

The system SHALL detect recognized public GitHub URLs passed to `web_fetch` and return a token-efficient representation using GitHub raw or public API endpoints before falling back to general web extraction.

#### Scenario: Fetch GitHub blob URL as raw file content

- **WHEN** the user calls `web_fetch` with a public GitHub file URL matching `https://github.com/{owner}/{repo}/blob/{ref}/{path}`
- **THEN** the system SHALL fetch the corresponding raw file content from `raw.githubusercontent.com` and return the file content without GitHub web page navigation text

#### Scenario: Fetch GitHub repository URL as compact markdown

- **WHEN** the user calls `web_fetch` with a public GitHub repository URL matching `https://github.com/{owner}/{repo}`
- **THEN** the system SHALL fetch public repository metadata from the GitHub API and return compact markdown describing the repository

#### Scenario: Fetch GitHub issue URL as compact markdown

- **WHEN** the user calls `web_fetch` with a public GitHub issue URL matching `https://github.com/{owner}/{repo}/issues/{number}`
- **THEN** the system SHALL fetch public issue data from the GitHub API and return compact markdown describing the issue

#### Scenario: Fetch GitHub pull request URL as compact markdown

- **WHEN** the user calls `web_fetch` with a public GitHub pull request URL matching `https://github.com/{owner}/{repo}/pull/{number}`
- **THEN** the system SHALL fetch public pull request data from the GitHub API and return compact markdown describing the pull request

#### Scenario: Fetch GitHub releases page as latest release markdown

- **WHEN** the user calls `web_fetch` with a public GitHub releases URL matching `https://github.com/{owner}/{repo}/releases`
- **THEN** the system SHALL fetch the latest release data from the GitHub API and return compact markdown describing the release

#### Scenario: Fetch GitHub release by tag as release markdown

- **WHEN** the user calls `web_fetch` with a public GitHub release tag URL matching `https://github.com/{owner}/{repo}/releases/tag/{tag}`
- **THEN** the system SHALL fetch the release data for that tag from the GitHub API and return compact markdown describing the release

#### Scenario: Preserve fallback for unrecognized GitHub URLs

- **WHEN** the user calls `web_fetch` with a GitHub URL that does not match a supported file, repository, issue, pull request, or release pattern
- **THEN** the system SHALL use the HTTP, Firecrawl, Cloudflare, and Exa retrieval cascade

#### Scenario: Preserve fallback when GitHub optimized fetch fails

- **WHEN** a recognized GitHub URL cannot be retrieved through its optimized raw or API endpoint
- **THEN** the system SHALL use the HTTP, Firecrawl, Cloudflare, and Exa retrieval cascade instead of failing immediately
