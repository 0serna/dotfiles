## Context

The Codex quota footer is implemented as a Pi extension that publishes a `codex-quota` status consumed by the custom footer. It currently discovers OAuth credentials from OpenCode's auth file, calls the ChatGPT Codex usage endpoint, caches successful quota data, and republishes cached values during session and turn events.

After a user authenticates through Pi's `/login` flow, Pi stores OAuth credentials for the `openai-codex` provider in its own auth storage. Pi's auth storage already knows how to refresh expired OAuth tokens, while the extension's direct OpenCode file read does not. Browser investigation of the Codex analytics dashboard confirmed that the usage endpoint accepts a fresh OAuth Bearer token without requiring browser-only headers or `ChatGPT-Account-Id`.

## Goals / Non-Goals

**Goals:**

- Resolve Codex usage auth from Pi's `openai-codex` auth storage.
- Rely on Pi's existing OAuth refresh path instead of duplicating token refresh logic in the extension.
- Keep the footer useful when auth is missing by publishing a compact auth-missing status.
- Preserve the last known quota status after transient usage fetch failures, retrying once before falling back to cache.
- Keep the implementation local to the Codex quota extension and existing footer status flow.

**Non-Goals:**

- Do not read or support OpenCode auth files as a fallback.
- Do not copy browser session cookies or browser-only request headers from ChatGPT.
- Do not introduce a separate credential cache or OAuth refresh implementation in the extension.
- Do not change the visual layout of the footer beyond the Codex quota/auth status content.

## Decisions

### Use Pi auth storage as the source of the Bearer token

The extension will ask Pi's model registry auth storage for the `openai-codex` API key/access token. This keeps the extension aligned with `/login` and lets Pi refresh expired OAuth credentials under its existing locking behavior.

Alternatives considered:

- Reading `~/.pi/agent/auth.json` directly: simpler than OpenCode lookup but bypasses Pi's refresh behavior and couples the extension to file shape.
- Implementing refresh in the extension: works but duplicates sensitive OAuth logic Pi already owns.
- Keeping OpenCode auth fallback: more compatible with previous behavior, but risks selecting stale credentials and contradicts the Pi-centered auth source.

### Do not send `ChatGPT-Account-Id`

The usage request will use the fresh Bearer token with `Accept: application/json`. The dashboard request and direct validation showed the endpoint accepts the token without `ChatGPT-Account-Id`, so the extension does not need to inspect credential internals just to extract an account id.

Alternatives considered:

- Reading account id from Pi auth file: preserves a Codex CLI-like request shape but reintroduces raw credential reads.
- Decoding the JWT for account id: avoids file reads but adds unnecessary token parsing when the endpoint does not require the header.

### Publish an auth-missing status when Pi auth is unavailable

When Pi auth storage cannot provide a Codex token, the extension will set the `codex-quota` status to `codex auth missing`. This makes the failure mode visible in the footer instead of silently omitting the Codex segment.

Alternatives considered:

- Logging only: keeps the footer clean but hides an actionable auth problem.
- Notification: more visible but too intrusive for a status extension.

### Retry usage fetch once, then keep cache

After a valid token is resolved, the extension will retry a failed usage fetch once. If both attempts fail, it will log the error and preserve the current/cached quota status instead of clearing it.

Alternatives considered:

- No retry: simpler but too fragile for transient network/API failures.
- Multiple retries with backoff: more robust but adds latency and complexity for a footer indicator.
- Clearing the status: makes failures visible but causes noisy footer churn and loses useful last-known data.

## Risks / Trade-offs

- Pi auth storage API shape changes → Keep the integration narrow and fail visibly with `codex auth missing` if token resolution is unavailable.
- Codex usage endpoint starts requiring additional headers → The extension will log fetch failures and preserve cache; request headers can be revisited if endpoint behavior changes.
- Auth-missing status occupies footer space for unauthenticated users → The message is compact and only appears for this extension's status slot.
- Cached quota data can become stale during extended API outages → Preserving last-known data is preferred over blanking the footer, and logs retain failure details.
