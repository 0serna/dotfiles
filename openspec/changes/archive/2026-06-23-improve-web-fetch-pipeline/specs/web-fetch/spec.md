## MODIFIED Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting retrieval through a four-tier fallback chain ordered by cost: GitHub URL optimization (free), direct HTTP text extraction (free), Cloudflare Browser Run headless rendering (free tier), and Exa-assisted retrieval (paid). The system SHALL include the retrieval source name in the tool result details for display purposes. The system SHALL cache successful fetch results in-process for 10 minutes to avoid redundant retrieval on repeated fetches of the same URL.

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

#### Scenario: HTTP fallback skips HTML content

- **WHEN** the user calls `web_fetch` with a URL that serves `text/html` content and GitHub optimization does not apply
- **THEN** the system SHALL skip the HTTP fallback and continue to the Cloudflare Browser Run fallback

#### Scenario: Successful content retrieval via Cloudflare Browser Run

- **WHEN** the user calls `web_fetch` with a URL that neither GitHub optimization nor HTTP text extraction can provide content for, and Cloudflare Browser Run credentials are available
- **THEN** the system SHALL launch a headless browser via the Browser Run `/markdown` endpoint, render the page with JavaScript, and return the extracted Markdown content with source set to `cloudflare`

#### Scenario: Successful content retrieval via Exa

- **WHEN** the user calls `web_fetch` with a URL that GitHub, HTTP, and Cloudflare Browser Run cannot provide content for
- **THEN** the system SHALL attempt Exa-assisted retrieval and return the extracted content as markdown with a title and source set to `exa`

#### Scenario: All tiers exhausted

- **WHEN** all four fallback tiers fail to provide content for a URL
- **THEN** the system SHALL return an error indicating the fetch failed

#### Scenario: Invalid URL

- **WHEN** the user calls `web_fetch` with a malformed or empty URL
- **THEN** the system SHALL return an error indicating the URL is invalid

### Requirement: Cloudflare Browser Run fallback with credentials gating

The system SHALL attempt Cloudflare Browser Run's `/markdown` Quick Action endpoint as a fallback between HTTP text extraction and Exa-assisted retrieval. The system SHALL skip this fallback silently when required environment variables are not set.

#### Scenario: Skip Browser Run when credentials are absent

- **WHEN** `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` environment variables are not set
- **THEN** the system SHALL skip the Browser Run fallback without making any HTTP request and proceed to the Exa fallback

#### Scenario: Successful Browser Run extraction

- **WHEN** the Browser Run `/markdown` endpoint returns a successful response with Markdown content
- **THEN** the system SHALL return the Markdown content as the fetch result with source marked as `cloudflare`

#### Scenario: Browser Run returns empty or invalid response

- **WHEN** the Browser Run `/markdown` endpoint returns a response with no usable content
- **THEN** the system SHALL fall through to the Exa fallback

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
- **THEN** the system SHALL use the HTTP, Cloudflare, and Exa fallback retrieval behavior

#### Scenario: Preserve fallback when GitHub optimized fetch fails

- **WHEN** a recognized GitHub URL cannot be retrieved through its optimized raw or API endpoint
- **THEN** the system SHALL use the HTTP, Cloudflare, and Exa fallback retrieval behavior instead of failing immediately

## ADDED Requirements

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

### Requirement: Log GitHub rate limit for diagnostic insights

The system SHALL detect GitHub API HTTP 403 rate limit responses and log them with a distinct reason for diagnostic visibility.

#### Scenario: Log rate limited GitHub fetch

- **WHEN** the GitHub API returns HTTP 403 with a response body containing "rate limit"
- **THEN** the system SHALL log a `github_fetch_failure` event with `reason: "rate_limited"` alongside the standard failure details

#### Scenario: Log non-rate-limit GitHub failure

- **WHEN** the GitHub API returns an error that is not a rate limit 403
- **THEN** the system SHALL log a `github_fetch_failure` event without the `rate_limited` reason, preserving the standard failure details
