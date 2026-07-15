## ADDED Requirements

### Requirement: Conditional web research availability

The system SHALL probe the `ketch` executable while loading the `web` extension and SHALL register `web_search`, `web_fetch`, `web_code`, and `web_docs` only when the probe succeeds.

#### Scenario: Ketch is available

- **WHEN** `ketch version` completes successfully during extension loading
- **THEN** the system registers all four web research tools

#### Scenario: Ketch is unavailable with UI

- **WHEN** the Ketch probe fails and a session starts with UI support
- **THEN** the system registers none of the web research tools and notifies the user that Ketch is unavailable

#### Scenario: Ketch is unavailable without UI

- **WHEN** the Ketch probe fails and Pi runs without UI support
- **THEN** the system registers none of the web research tools and emits no user notification

### Requirement: Federated web discovery

The system SHALL provide `web_search` with a required non-blank `query` and an optional integer `limit` from 1 through 10 that defaults to 5. The tool SHALL execute Ketch federated web search with JSON output and SHALL NOT scrape result pages.

#### Scenario: Search with defaults

- **WHEN** `web_search` receives a non-blank query without a limit
- **THEN** the system invokes `ketch search` with federated search, a limit of 5, and JSON output

#### Scenario: Search with custom limit

- **WHEN** `web_search` receives a non-blank query and a valid custom limit
- **THEN** the system invokes federated Ketch search with that limit

#### Scenario: Blank search query

- **WHEN** `web_search` receives a query containing only whitespace
- **THEN** the system rejects the call with a `[validation]` error without running a research command

### Requirement: Known-URL content retrieval

The system SHALL provide `web_fetch` with one required `url` string and SHALL invoke Ketch scrape with JSON output while disabling automatic `/llms.txt` substitution. Ketch SHALL remain authoritative for validating and interpreting the supplied scrape input.

#### Scenario: Fetch a URL

- **WHEN** `web_fetch` receives a URL string
- **THEN** the system passes it to `ketch scrape` with `--no-llms-txt` and `--json`

#### Scenario: Ketch rejects fetch input

- **WHEN** Ketch rejects the supplied `url` value as invalid
- **THEN** the system returns the corresponding classified tool error

### Requirement: Public source-code search

The system SHALL provide `web_code` with a required non-blank `query`, an optional `language`, and an optional integer `limit` from 1 through 10 that defaults to 5. The tool SHALL use Ketch's GitHub code-search backend and SHALL NOT expose regex or backend selection.

#### Scenario: Code search with language

- **WHEN** `web_code` receives a query and a language
- **THEN** the system invokes `ketch code` with the GitHub backend, language filter, selected limit, and JSON output

#### Scenario: Code search without language

- **WHEN** `web_code` receives a query without a language
- **THEN** the system invokes `ketch code` with the GitHub backend, without a language flag, and uses the default limit of 5

#### Scenario: Blank code query

- **WHEN** `web_code` receives a query containing only whitespace
- **THEN** the system rejects the call with a `[validation]` error

### Requirement: Library documentation lookup

The system SHALL provide `web_docs` with a required non-blank `query` and an optional library name or Context7 library ID. The tool SHALL use Ketch JSON documentation lookup without exposing backend, token-budget, or result-limit controls.

#### Scenario: Automatically resolved documentation

- **WHEN** `web_docs` receives a query without a library ID
- **THEN** the system invokes `ketch docs` with the query and JSON output, allowing Ketch to resolve its top library candidate

#### Scenario: Library-scoped documentation

- **WHEN** `web_docs` receives a query and an exact Context7 library ID
- **THEN** the system invokes `ketch docs` with that library ID and JSON output

#### Scenario: Library name resolution

- **WHEN** `web_docs` receives a query and an ordinary library name
- **THEN** the system includes the library name in the query and allows Ketch to resolve the library instead of forwarding the name as a Context7 ID

#### Scenario: Blank documentation query

- **WHEN** `web_docs` receives a query containing only whitespace
- **THEN** the system rejects the call with a `[validation]` error

### Requirement: Ketch-owned operational configuration

The web research tool schemas SHALL NOT expose search, code, or documentation backend selection, credentials, cookies, cache controls, browser controls, raw scraping, CSS selectors, regex code search, or Ketch version selection.

#### Scenario: Agent inspects tool schemas

- **WHEN** the registered web research tool definitions are presented to the agent
- **THEN** operational Ketch configuration is absent from their parameters

### Requirement: Intent-specific prompt routing

The registered tools SHALL provide prompt metadata that distinguishes web discovery, known-URL reading, public open-source usage search, and library documentation lookup.

#### Scenario: Tool metadata is active

- **WHEN** the web research tools are active in Pi
- **THEN** the system prompt identifies `web_search` for discovery, `web_fetch` for a known URL, `web_code` for public source usage, and `web_docs` for library documentation

### Requirement: Successful JSON output

Each successful web research call SHALL request JSON from Ketch, SHALL verify that stdout contains syntactically valid JSON, and SHALL return the successful JSON text without mixing stderr warnings into tool content.

#### Scenario: Valid JSON response

- **WHEN** Ketch exits successfully with valid JSON below Pi's output limits
- **THEN** the tool returns that JSON as its text content

#### Scenario: Partial backend warning

- **WHEN** Ketch exits successfully with valid JSON and emits a warning on stderr
- **THEN** the tool returns only JSON content and records the warning in `web.log`

#### Scenario: Invalid successful output

- **WHEN** Ketch exits successfully but stdout is empty or invalid JSON
- **THEN** the system fails the tool with an `[internal]` error

### Requirement: Bounded research output

The system SHALL apply Pi's 50 KB and 2,000-line head limits to successful research output. When output is truncated, the system SHALL save the complete output in a private temporary file and SHALL append a notice containing its path.

#### Scenario: Output is within limits

- **WHEN** successful JSON stays within both Pi limits
- **THEN** the system returns it without a truncation notice or temporary file

#### Scenario: Output exceeds a limit

- **WHEN** successful JSON exceeds 50 KB or 2,000 lines
- **THEN** the system returns the retained prefix plus a truncation notice and saves the complete JSON to a private temporary file

### Requirement: Classified tool failures

The system SHALL throw tool execution errors with stable prefixes mapped from Ketch outcomes: exit 2 `[validation]`, exit 3 `[not_found]`, exit 4 `[upstream]`, exit 5 `[precondition]`, exit 6 or an aborted process `[cancelled]`, and unclassified adapter failures `[internal]`.

#### Scenario: Ketch reports a classified failure

- **WHEN** Ketch exits with a code from 2 through 6
- **THEN** the system fails the tool with the corresponding stable prefix and logs the complete diagnostic

#### Scenario: Adapter failure requires operator attention

- **WHEN** a running tool encounters `[precondition]` or `[internal]` and UI support is available
- **THEN** the system displays a brief actionable notification while retaining complete diagnostics only in `web.log`

#### Scenario: Network failure

- **WHEN** Ketch exits with code 4
- **THEN** the system returns an `[upstream]` tool error without an additional UI notification

### Requirement: Structured web diagnostics

The extension SHALL write structured events through the shared extension logger to `~/.local/state/pi/web.log`. Logs SHALL include complete query or URL inputs, timing, exit status, counts, truncation, warnings, and classified errors, and SHALL exclude stdout, result snippets, page content, cookies, credentials, and effective Ketch configuration.

#### Scenario: Successful research call

- **WHEN** a web research tool succeeds
- **THEN** the system logs its input, duration, exit status, result metadata, warnings, and truncation state without response content

#### Scenario: Failed research call

- **WHEN** a web research tool fails
- **THEN** the system logs its input, duration, exit status, classification, and complete diagnostic without credentials or response content

### Requirement: Compact tool presentation

The extension SHALL render every web research call and result compactly and SHALL keep full JSON out of the custom TUI renderer. Tool result details SHALL contain only small summary metadata and SHALL exclude stdout, stderr, snippets, and page content.

#### Scenario: Successful compact rendering

- **WHEN** a web research tool completes successfully
- **THEN** the renderer shows the relevant argument and a compact count or size summary without displaying JSON

#### Scenario: Truncated compact rendering

- **WHEN** a web research result is truncated
- **THEN** the renderer indicates truncation using summary details without parsing the truncated content

### Requirement: Cancellable parallel execution

The web research tools SHALL pass Pi's abort signal to Ketch, SHALL impose no extension-specific timeout, and SHALL remain eligible for Pi's parallel tool execution.

#### Scenario: User cancels a running tool

- **WHEN** Pi aborts a running web research call
- **THEN** the Ketch process is terminated and the tool fails as `[cancelled]`

#### Scenario: Multiple web calls are emitted together

- **WHEN** the model requests multiple web research tools in one turn
- **THEN** the extension allows Pi to execute them concurrently
