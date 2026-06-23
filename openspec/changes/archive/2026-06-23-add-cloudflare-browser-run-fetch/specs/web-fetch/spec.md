## MODIFIED Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting retrieval through a four-tier fallback chain: GitHub URL optimization, Exa-assisted retrieval, Cloudflare Browser Run headless rendering, and direct HTTP regex extraction.

#### Scenario: Successful content retrieval via GitHub optimization

- **WHEN** the user calls `web_fetch` with a recognized public GitHub URL
- **THEN** the system SHALL return optimized content from GitHub raw or API endpoints

#### Scenario: Successful content retrieval via Exa

- **WHEN** the user calls `web_fetch` with a URL that Exa has content for and GitHub optimization does not apply
- **THEN** the system SHALL return the extracted content as markdown with a title

#### Scenario: Successful content retrieval via Cloudflare Browser Run

- **WHEN** the user calls `web_fetch` with a URL that neither GitHub optimization nor Exa can provide content for, and Cloudflare Browser Run credentials are available
- **THEN** the system SHALL launch a headless browser via the Browser Run `/markdown` endpoint, render the page with JavaScript, and return the extracted Markdown content

#### Scenario: Successful content retrieval via HTTP fallback

- **WHEN** the user calls `web_fetch` with a URL that GitHub, Exa, and Cloudflare Browser Run cannot provide content for
- **THEN** the system SHALL attempt direct HTTP fetch and return the extracted readable content, or return an error if extraction fails

#### Scenario: Invalid URL

- **WHEN** the user calls `web_fetch` with a malformed or empty URL
- **THEN** the system SHALL return an error indicating the URL is invalid

## ADDED Requirements

### Requirement: Cloudflare Browser Run fallback with credentials gating

The system SHALL attempt Cloudflare Browser Run's `/markdown` Quick Action endpoint as a fallback between Exa and the HTTP regex fallback. The system SHALL skip this fallback silently when required environment variables are not set.

#### Scenario: Skip Browser Run when credentials are absent

- **WHEN** `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` environment variables are not set
- **THEN** the system SHALL skip the Browser Run fallback without making any HTTP request and proceed to the HTTP regex fallback

#### Scenario: Successful Browser Run extraction

- **WHEN** the Browser Run `/markdown` endpoint returns a successful response with Markdown content
- **THEN** the system SHALL return the Markdown content as the fetch result with source marked as `cloudflare`

#### Scenario: Browser Run returns empty or invalid response

- **WHEN** the Browser Run `/markdown` endpoint returns a response with no usable content
- **THEN** the system SHALL fall through to the HTTP regex fallback

### Requirement: Browser Run rendering configuration

The system SHALL configure the Browser Run `/markdown` request to fully render JavaScript-heavy pages by waiting for network idle and blocking non-essential resources.

#### Scenario: Wait for network idle

- **WHEN** the system sends a request to the Browser Run `/markdown` endpoint
- **THEN** the system SHALL set `gotoOptions.waitUntil` to `networkidle0` to ensure JavaScript rendering completes before extraction

#### Scenario: Block non-essential resources

- **WHEN** the system sends a request to the Browser Run `/markdown` endpoint
- **THEN** the system SHALL set `rejectResourceTypes` to `["image", "font", "stylesheet"]` to reduce browser time consumption without affecting Markdown text extraction

### Requirement: Browser Run quota and rate-limit handling

The system SHALL handle Cloudflare Browser Run HTTP 429 responses by falling through to the HTTP regex fallback without retrying. When the 429 indicates daily quota exhaustion, the system SHALL cache that state in-process to skip all subsequent Browser Run attempts for the remainder of the process lifetime.

#### Scenario: Cache quota exhaustion for session

- **WHEN** the Browser Run endpoint returns HTTP 429 with a message indicating browser time limit exceeded
- **THEN** the system SHALL set an in-process flag that causes all subsequent Browser Run attempts to return `null` immediately for the remainder of the process lifetime, and SHALL fall through to the HTTP regex fallback

#### Scenario: Fall through on transitory rate limit

- **WHEN** the Browser Run endpoint returns HTTP 429 without a quota-exceeded message
- **THEN** the system SHALL fall through to the HTTP regex fallback without retrying

### Requirement: Browser Run request timeout

The system SHALL enforce a 30-second timeout on Browser Run `/markdown` requests using an AbortController.

#### Scenario: Request exceeds 30 seconds

- **WHEN** the Browser Run `/markdown` request does not complete within 30 seconds
- **THEN** the system SHALL abort the request and fall through to the HTTP regex fallback

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
