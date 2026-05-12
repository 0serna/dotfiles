## ADDED Requirements

### Requirement: Search with query string

The system SHALL accept a single query string and return search results synthesized from the Exa API.

#### Scenario: Basic search returns answer and sources

- **WHEN** the user calls `web_search` with query "TypeScript best practices"
- **THEN** the system SHALL return an AI-synthesized answer with at least one source citation including title and URL

#### Scenario: Search with empty query

- **WHEN** the user calls `web_search` with an empty string
- **THEN** the system SHALL return an error indicating that a query is required

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
