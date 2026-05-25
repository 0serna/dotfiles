## 1. GitHub URL Handling

- [x] 1.1 Add a small GitHub helper module that classifies supported public GitHub URLs as blob file, repository, issue, pull request, or unsupported
- [x] 1.2 Implement raw URL conversion for supported GitHub blob file URLs
- [x] 1.3 Implement unauthenticated GitHub API fetch helpers for repository, issue, and pull request resources

## 2. Markdown Rendering

- [x] 2.1 Render repository API responses as compact markdown with key metadata only
- [x] 2.2 Render issue API responses as compact markdown with title, state, author, labels, timestamps, body, and URL
- [x] 2.3 Render pull request API responses as compact markdown with title, state, author, base/head refs, change stats when present, timestamps, body, and URL

## 3. web_fetch Integration

- [x] 3.1 Route recognized GitHub URLs through the optimized GitHub fetch path before Exa Contents
- [x] 3.2 Preserve the existing Exa-assisted and HTTP fallback behavior for unsupported GitHub URLs and optimized GitHub fetch failures
- [x] 3.3 Include result details or logging that make it clear when the optimized GitHub path was used or fell back

## 4. Verification

- [x] 4.1 Add or update tests for blob, repository, issue, pull request, unsupported URL, and optimized-fetch-failure fallback cases
- [x] 4.2 Run the repository quality gate and fix any reported issues
