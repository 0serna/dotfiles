## Why

GitHub web pages are often token-heavy HTML interfaces, while agents usually need the underlying public repository data: file content, issue details, pull request details, or repository metadata. Optimizing recognized GitHub URLs will make `web_fetch` more efficient and more useful without changing its public tool parameters.

## What Changes

- Add GitHub-specific URL handling to `web_fetch` for public GitHub URLs.
- Rewrite GitHub file `blob` URLs to raw file URLs so file content is fetched directly.
- Fetch structured public GitHub data for recognized non-file URLs such as repositories, issues, and pull requests, returning compact markdown instead of GitHub HTML.
- Preserve the existing Exa-first and HTTP fallback behavior for non-GitHub URLs and unrecognized GitHub URL shapes.
- Do not introduce GitHub CLI or authentication as a required dependency.

## Capabilities

### New Capabilities

### Modified Capabilities

- `web-fetch`: Add efficient handling for public GitHub URLs by returning raw file content or compact structured markdown for recognized GitHub resources.

## Impact

- Affected code: `dotfiles/pi/agent/extensions/web-search/web-fetch.ts` and likely one small GitHub helper module under `dotfiles/pi/agent/extensions/web-search/`.
- API: No tool parameter changes; `web_fetch` continues to accept a single `url` string.
- Dependencies: No new npm dependencies and no required `gh` CLI integration.
- Systems: Uses unauthenticated HTTP requests to public GitHub raw/API endpoints for recognized GitHub URLs.
