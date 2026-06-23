## MODIFIED Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting retrieval through a four-tier fallback chain: GitHub URL optimization, Exa-assisted retrieval, Cloudflare Browser Run headless rendering, and direct HTTP regex extraction. The system SHALL include the retrieval source name in the tool result details for display purposes.

#### Scenario: Successful content retrieval via GitHub optimization

- **WHEN** the user calls `web_fetch` with a recognized public GitHub URL
- **THEN** the system SHALL return optimized content from GitHub raw or API endpoints with source set to `github-raw` or `github-api`

#### Scenario: Successful content retrieval via Exa

- **WHEN** the user calls `web_fetch` with a URL that Exa has content for and GitHub optimization does not apply
- **THEN** the system SHALL return the extracted content as markdown with a title and source set to `exa`

#### Scenario: Successful content retrieval via Cloudflare Browser Run

- **WHEN** the user calls `web_fetch` with a URL that neither GitHub optimization nor Exa can provide content for, and Cloudflare Browser Run credentials are available
- **THEN** the system SHALL launch a headless browser via the Browser Run `/markdown` endpoint, render the page with JavaScript, and return the extracted Markdown content with source set to `cloudflare`

#### Scenario: Successful content retrieval via HTTP fallback

- **WHEN** the user calls `web_fetch` with a URL that GitHub, Exa, and Cloudflare Browser Run cannot provide content for
- **THEN** the system SHALL attempt direct HTTP fetch and return the extracted readable content with source set to `http-fallback`, or return an error if extraction fails

#### Scenario: Invalid URL

- **WHEN** the user calls `web_fetch` with a malformed or empty URL
- **THEN** the system SHALL return an error indicating the URL is invalid

## ADDED Requirements

### Requirement: Display retrieval source in tool result

The system SHALL display the retrieval source name alongside the content size in the `web_fetch` tool result renderer. The system SHALL map internal source identifiers to short display labels.

#### Scenario: Display source for GitHub retrieval

- **WHEN** the tool result has `source` set to `github-raw` or `github-api`
- **THEN** the renderer SHALL display the label `github` alongside the content size (e.g., `17.2KB (github)`)

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
