## ADDED Requirements

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
