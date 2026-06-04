## 1. Shared Diagnostics Module

- [x] 1.1 Create `dotfiles/pi/agent/extensions/shared/diagnostics.ts` with structured error and response diagnostic types.
- [x] 1.2 Implement `serializeError` with `name`, `message`, optional string `code`, immediate `cause`, and no stack traces.
- [x] 1.3 Implement `HttpResponseError`, `responseDetails`, and `getResponseDetails` for HTTP response failures.
- [x] 1.4 Implement `failureDetails(err)` returning `{ error, response? }`.

## 2. Web Tools Migration

- [x] 2.1 Replace the web-search-local diagnostics module with imports from `../shared/diagnostics.ts`.
- [x] 2.2 Update Exa, GitHub, HTTP fallback, web_search, and web_fetch failure logs to use the shared failure payload helper.
- [x] 2.3 Preserve existing web-search event names, `toolCallId`, `elapsedMs`, `contentLength`, fallback logging, and control flow.

## 3. Existing Extension Adoption

- [x] 3.1 Update obvious quota failure logs that currently emit plain error messages to emit structured `error` payloads via shared diagnostics.
- [x] 3.2 Update obvious context failure logs that currently emit plain error messages to emit structured `error` payloads via shared diagnostics.
- [x] 3.3 Preserve migrated extensions' event names and functional behavior.

## 4. Verification

- [x] 4.1 Run formatting for the repository.
- [x] 4.2 Run the test suite.
- [x] 4.3 Run the repository check command.
- [x] 4.4 Validate the OpenSpec change.
