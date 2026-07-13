# web-tools-logging Specification

## Purpose

Diagnostic logging for the web-tools extension (web_search, web_fetch), recording Exa API calls and HTTP fallback outcomes in structured JSON format via the shared logger.

## Requirements

### Requirement: Persistent log file location

The system SHALL write diagnostic logs to a persistent location outside of `/tmp`, ensuring logs survive system reboots.

#### Scenario: Default log path

- **WHEN** the tool extension initializes or logs its first event
- **THEN** the log file SHALL be created at `~/.local/state/pi/web-tools.log`

#### Scenario: Parent directory created automatically

- **WHEN** the log directory does not exist at first write
- **THEN** the system SHALL create the parent directory (`~/.local/state/pi/`) automatically

### Requirement: Log size management

The system SHALL manage the log file size to prevent unbounded growth on disk.

#### Scenario: Trim oldest entries when over limit

- **WHEN** the log file exceeds 2000 lines
- **THEN** the system SHALL truncate the file to keep only the most recent 2000 lines, discarding the oldest entries

### Requirement: Structured log format

Each log entry SHALL follow a consistent format to support automated parsing (grep, tail, scripts).

#### Scenario: Timestamp prefix

- **WHEN** any event is logged
- **THEN** the entry SHALL start with an ISO 8601 timestamp followed by a space, then the source, event, and fields

#### Scenario: JSON data

- **WHEN** an event includes additional data (URL, status, count, etc.)
- **THEN** the data SHALL be encoded as a JSON object appended after the event name

### Requirement: Success and failure logging for Exa Search

The system SHALL log both successful and failed Exa Search API calls.

#### Scenario: Log successful search

- **WHEN** `web_search` completes successfully via Exa
- **THEN** the system SHALL log the event with the query and result count

#### Scenario: Log failed search

- **WHEN** `web_search` fails (API error, timeout, etc.)
- **THEN** the system SHALL log the event with the query and error information

### Requirement: Success and failure logging for Exa Contents

The system SHALL log both successful and failed Exa Contents API calls.

#### Scenario: Log successful content fetch

- **WHEN** `web_fetch` retrieves content successfully via Exa Contents
- **THEN** the system SHALL log the event with the URL, status tag, and content length

#### Scenario: Log failed content fetch with error tag

- **WHEN** `web_fetch` fails via Exa Contents (crawl error, timeout, not found)
- **THEN** the system SHALL log the event with the URL and the specific error tag from the Exa `statuses` response field (e.g., `CRAWL_NOT_FOUND`, `CRAWL_TIMEOUT`)

### Requirement: HTTP fallback outcome logging

The system SHALL log the outcome of the HTTP fallback extraction when Exa Contents fails.

#### Scenario: Log successful HTTP fallback

- **WHEN** Exa Contents fails and the HTTP fallback succeeds
- **THEN** the system SHALL log the event with the URL and byte count of extracted content

#### Scenario: Log failed HTTP fallback

- **WHEN** both Exa Contents and the HTTP fallback fail
- **THEN** the system SHALL log the event with the URL and the error message

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
