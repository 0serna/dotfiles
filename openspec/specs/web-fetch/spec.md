# web-fetch Specification

## Purpose

TBD - created by archiving change pi-exa-tools. Update Purpose after archive.

## Requirements

### Requirement: Fetch content from a single URL

The system SHALL accept a single URL and return its readable content, attempting Exa-assisted retrieval first and falling back to direct HTTP extraction.

#### Scenario: Successful content retrieval via Exa

- **WHEN** the user calls `web_fetch` with a URL that Exa has content for
- **THEN** the system SHALL return the extracted content as markdown with a title

#### Scenario: Successful content retrieval via HTTP fallback

- **WHEN** the user calls `web_fetch` with a URL that Exa cannot provide content for
- **THEN** the system SHALL attempt direct HTTP fetch and return the extracted readable content, or return an error if extraction fails

#### Scenario: Invalid URL

- **WHEN** the user calls `web_fetch` with a malformed or empty URL
- **THEN** the system SHALL return an error indicating the URL is invalid

### Requirement: Error handling

The system SHALL return descriptive error messages when fetch operations fail.

#### Scenario: Unreachable URL

- **WHEN** the user calls `web_fetch` with a URL that returns a non-2xx status or is unreachable
- **THEN** the system SHALL return an error with the HTTP status code or connection failure description

#### Scenario: Timeout

- **WHEN** the URL takes too long to respond
- **THEN** the system SHALL return an error indicating the request timed out

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

#### Scenario: Preserve fallback for unrecognized GitHub URLs

- **WHEN** the user calls `web_fetch` with a GitHub URL that does not match a supported file, repository, issue, or pull request pattern
- **THEN** the system SHALL use the existing Exa-assisted and HTTP fallback retrieval behavior

#### Scenario: Preserve fallback when GitHub optimized fetch fails

- **WHEN** a recognized GitHub URL cannot be retrieved through its optimized raw or API endpoint
- **THEN** the system SHALL use the existing Exa-assisted and HTTP fallback retrieval behavior instead of failing immediately
