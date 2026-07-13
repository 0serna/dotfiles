## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting retrieval through a five-tier fallback chain ordered as GitHub URL optimization, direct HTTP text extraction, Firecrawl Scrape, Cloudflare Browser Run headless rendering, and Exa-assisted retrieval. The system SHALL include the retrieval source name in the tool result details for display purposes. The system SHALL cache successful fetch results in-process for 10 minutes to avoid redundant retrieval on repeated fetches of the same URL.

#### Scenario: Cache hit on repeated fetch

- **WHEN** the user calls `web_fetch` with a URL that was successfully fetched within the last 10 minutes
- **THEN** the system SHALL return the cached content and source without making any HTTP request

#### Scenario: Cache entry expired

- **WHEN** the user calls `web_fetch` with a URL whose cached entry is older than 10 minutes
- **THEN** the system SHALL discard the cache entry and re-run the full fallback chain

#### Scenario: Cache stores successes only

- **WHEN** a previous fetch for a URL failed because all tiers returned no content
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

- **WHEN** GitHub, HTTP, and Firecrawl cannot provide content and Cloudflare Browser Run credentials are available
- **THEN** the system SHALL launch a headless browser via the Browser Run `/markdown` endpoint and return the extracted Markdown with source set to `cloudflare`

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
- **THEN** the renderer SHALL display the label `github` alongside the content size, for example `17.2KB (github)`

#### Scenario: Display source for Firecrawl retrieval

- **WHEN** the tool result has `source` set to `firecrawl`
- **THEN** the renderer SHALL display the label `firecrawl` alongside the content size, for example `17.2KB (firecrawl)`

#### Scenario: Display source for Exa retrieval

- **WHEN** the tool result has `source` set to `exa`
- **THEN** the renderer SHALL display the label `exa` alongside the content size, for example `17.2KB (exa)`

#### Scenario: Display source for Cloudflare retrieval

- **WHEN** the tool result has `source` set to `cloudflare`
- **THEN** the renderer SHALL display the label `cloudflare` alongside the content size, for example `17.2KB (cloudflare)`

#### Scenario: Display source for HTTP fallback retrieval

- **WHEN** the tool result has `source` set to `http-fallback`
- **THEN** the renderer SHALL display the label `http` alongside the content size, for example `17.2KB (http)`

#### Scenario: Unknown or missing source

- **WHEN** the tool result has no `source` field or an unrecognized source value
- **THEN** the renderer SHALL display only the content size without a source label, for example `17.2KB extracted`

#### Scenario: Error result

- **WHEN** the tool result is an error
- **THEN** the renderer SHALL display only the error message without a source label

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
- **THEN** the system SHALL fetch release data for that tag from the GitHub API and return compact markdown describing the release

#### Scenario: Preserve fallback for unrecognized GitHub URLs

- **WHEN** the user calls `web_fetch` with a GitHub URL that does not match a supported file, repository, issue, pull request, or release pattern
- **THEN** the system SHALL use the HTTP, Firecrawl, Cloudflare, and Exa retrieval cascade

#### Scenario: Preserve fallback when GitHub optimized fetch fails

- **WHEN** a recognized GitHub URL cannot be retrieved through its optimized raw or API endpoint
- **THEN** the system SHALL use the HTTP, Firecrawl, Cloudflare, and Exa retrieval cascade instead of failing immediately
