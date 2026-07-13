## ADDED Requirements

### Requirement: Firecrawl Search and Scrape outcome logging

The system SHALL log successful and failed Firecrawl Search and Scrape requests through the shared web tools logger. Logs SHALL include operation context and elapsed time while excluding the API key and Authorization header.

#### Scenario: Log successful Firecrawl search

- **WHEN** Firecrawl Search returns a valid response
- **THEN** the system SHALL log a `firecrawl_search_success` event with the query, usable result count, and elapsed time

#### Scenario: Log failed Firecrawl search

- **WHEN** Firecrawl Search returns a non-2xx response, invalid response, or times out
- **THEN** the system SHALL log a `firecrawl_search_failure` event with the query, elapsed time, and standardized failure details

#### Scenario: Log successful Firecrawl scrape

- **WHEN** Firecrawl Scrape returns non-empty Markdown
- **THEN** the system SHALL log a `firecrawl_scrape_success` event with the URL, content length, and elapsed time

#### Scenario: Log failed Firecrawl scrape

- **WHEN** Firecrawl Scrape returns a non-2xx response, empty or invalid content, or times out
- **THEN** the system SHALL log a `firecrawl_scrape_failure` event with the URL, elapsed time, and standardized failure details or failure reason

#### Scenario: Protect Firecrawl credentials

- **WHEN** any Firecrawl event is logged
- **THEN** the log data SHALL NOT contain `FIRECRAWL_API_KEY` or the Authorization header value
