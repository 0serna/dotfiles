## ADDED Requirements

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
