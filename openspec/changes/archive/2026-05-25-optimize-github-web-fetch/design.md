## Context

`web_fetch` currently accepts any HTTP(S) URL, attempts Exa Contents first, and falls back to direct HTTP extraction. For GitHub URLs this often returns token-heavy HTML interface text even when the useful content is a file, issue, pull request, or repository summary.

The agent instructions already prefer GitHub CLI for broader GitHub investigation, but this extension is a URL-fetching tool. Its best fit is deterministic public HTTP access without relying on local `gh` installation, login state, or token scopes.

## Goals / Non-Goals

**Goals:**

- Make `web_fetch` efficient for recognized public GitHub URLs.
- Return raw file content for GitHub file `blob` URLs.
- Return compact markdown from public GitHub API responses for repository, issue, and pull request URLs.
- Keep the existing `web_fetch` API unchanged: one required `url` parameter.
- Preserve existing Exa/HTTP behavior for non-GitHub and unrecognized GitHub URLs.

**Non-Goals:**

- Do not require or shell out to `gh`.
- Do not add authentication, token configuration, or private repository support.
- Do not implement full GitHub browsing, search, review aggregation, checks, or timeline reconstruction.
- Do not replace the agent's ability to use `gh` directly for deeper GitHub investigations.

## Decisions

### Decision: Prefer URL/API normalization over GitHub CLI

Use HTTP URLs and GitHub REST endpoints directly from the extension rather than invoking `gh`.

- **Why**: The extension already uses `fetch()` and has no process dependency for web fetching. Direct HTTP keeps behavior portable, avoids local auth coupling, and works for public resources.
- **Alternative considered**: Invoke `gh api` or `gh pr view`. This would support authenticated/private data when configured, but introduces dependency on local CLI availability, login state, scopes, output stability, and subprocess error handling.

### Decision: Route recognized GitHub URLs before Exa

Detect recognized GitHub URL shapes before calling Exa Contents.

- **Why**: For GitHub resources, the canonical raw/API endpoint is more precise and token-efficient than asking Exa or parsing HTML.
- **Alternative considered**: Keep Exa-first and only optimize HTTP fallback. That can still waste time and tokens when Exa returns GitHub page text instead of the compact resource representation.

### Decision: Use raw URLs only for file `blob` URLs

Convert `https://github.com/{owner}/{repo}/blob/{ref}/{path}` to `https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}` for public files.

- **Why**: Raw URLs return exact file content as plain text and avoid the GitHub web UI.
- **Alternative considered**: Use the GitHub Contents API for files. That avoids some ref/path ambiguity but requires base64 decoding for default JSON responses or custom Accept handling, and is less direct than raw for public files.

### Decision: Use compact markdown renderers for repository, issue, and pull request URLs

For recognized non-file URLs, fetch JSON from GitHub REST endpoints and render only the fields useful to an agent.

- Repository URLs: title/name, description, default branch, visibility, stars/forks/open issues, pushed/updated timestamps, homepage, topics when available.
- Issue URLs: title, number, state, author, labels, timestamps, body, URL.
- Pull request URLs: title, number, state, author, base/head refs, mergeability fields when present, additions/deletions/changed files when present, timestamps, body, URL.

- **Why**: Structured markdown is far smaller and clearer than extracted HTML.
- **Alternative considered**: Use raw HTML extraction for these pages. This preserves the page shape but includes navigation, login prompts, buttons, and unrelated text.

### Decision: Fall back rather than fail for unrecognized GitHub URLs

If a GitHub URL is not recognized, or a GitHub API/raw request cannot produce content, keep the existing Exa/HTTP path.

- **Why**: This preserves broad URL support and avoids making GitHub special handling brittle.
- **Alternative considered**: Return a GitHub-specific error. That would be clearer for supported patterns but worse for partially supported URLs such as commits, releases, discussions, or directories.

## Risks / Trade-offs

- **[Risk] Public unauthenticated GitHub API rate limits** → Existing fallback remains available for failures; no authentication is introduced for this public-URL optimization.
- **[Risk] Branch names containing `/` make `blob` URL parsing ambiguous** → Use a simple deterministic parser first; if raw fetch fails, fall back to the existing Exa/HTTP path.
- **[Risk] Compact renderers may omit context useful for deep PR/issue analysis** → This optimization targets first-pass URL reading; the agent can still use `gh` or other tools for detailed investigation.
- **[Risk] GitHub API schema changes** → Use a small subset of stable REST fields and tolerant rendering for missing values.
