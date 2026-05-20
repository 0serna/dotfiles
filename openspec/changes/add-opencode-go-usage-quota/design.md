## Context

The existing Pi extension `dotfiles/pi/agent/extensions/codex-quota.ts` publishes a compact Codex quota footer status by fetching `https://chatgpt.com/backend-api/wham/usage` with Pi's `openai-codex` OAuth credentials. The user's default provider is `opencode-go`, whose API key works for OpenCode Go model calls and `/zen/go/v1/models`, but no public Go usage endpoint exists yet; `/zen/go/v1/usage` currently returns 404.

OpenCode Go usage is available in the authenticated OpenCode dashboard at `https://opencode.ai/workspace/{workspaceId}/go`. The dashboard server-renders SolidJS hydration data containing `rollingUsage`, `weeklyUsage`, `monthlyUsage`, and billing balance fields. The established workaround, used by `opencode-quota`, is to fetch that dashboard with an `auth` cookie and parse the hydration payload.

## Goals / Non-Goals

**Goals:**

- Keep one Pi footer quota extension and one footer status entry for both Codex Plus and OpenCode Go.
- Fetch Codex and OpenCode Go usage in parallel on the existing polling cadence.
- Configure OpenCode Go dashboard scraping through `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE`.
- Display provider-prefixed Codex and OpenCode Go quota groups in one compact status string.
- Include OpenCode Go rolling, weekly, monthly remaining percentages, reset labels, and dollar balance.
- Surface a compact provider error marker when one provider fails while preserving the other provider's data.

**Non-Goals:**

- Do not add browser automation or Playwriter dependency to the Pi extension.
- Do not implement OpenCode Go OAuth refresh or browser-cookie extraction.
- Do not replace scraping with `/zen/go/v1/usage` until such an endpoint exists and is proven available.
- Do not change Pi model routing or provider authentication for model calls.

## Decisions

### Use dashboard scraping for OpenCode Go usage

The extension will request the OpenCode Go dashboard HTML with `Cookie: auth=<OPENCODE_GO_AUTH_COOKIE>` and parse the server-rendered hydration data. This is chosen because the Go API key does not authorize usage endpoints, and the proposed `/zen/go/v1/usage` endpoint is not currently available.

Alternatives considered:

- Use `opencode-go` API key with OpenAI or OpenCode usage endpoints: rejected because tested endpoints return 401 or 404.
- Use Playwriter/browser scraping at runtime: rejected because Pi extension status should not depend on a running browser session.
- Use OpenCode local auth files: rejected for this change because the selected plan is env-configured cookie scraping.

### Configure Go dashboard access through environment variables

The extension will require both `OPENCODE_GO_WORKSPACE_ID` and `OPENCODE_GO_AUTH_COOKIE` before attempting Go scraping. Missing Go environment configuration will affect only the Go segment and will not prevent Codex quota display.

Alternatives considered:

- Store cookie in Pi `auth.json`: rejected by preference for env vars.
- Store a sidecar JSON config file: rejected to avoid another managed config file.

### Keep a single combined footer status

The extension will continue as one file but rename status/cache/logger concepts to `usage-quota`. The visible footer status will combine provider groups rather than publishing a separate OpenCode Go status entry.

Alternatives considered:

- Separate extension/status key: rejected to keep one compact quota line.
- Only show the active provider: rejected because the existing Codex behavior remains provider-independent and the user wants both.

### Fetch providers in parallel and support partial results

Codex and Go fetches will run concurrently. Each provider result will be tracked independently so one failure can render a compact error marker while the other provider remains visible.

Alternatives considered:

- Sequential fetch: rejected because the two sources are independent and parallel fetching lowers footer refresh latency.
- All-or-nothing status: rejected because a transient failure in one provider should not hide useful data from the other.

### Treat Go balance as dollar balance

The OpenCode Go billing `balance` field will be displayed as a dollar amount. The observed raw value `670023194` corresponds to approximately `$6.70`, so implementation should use the verified conversion from dashboard raw balance to display dollars and avoid labeling it as Codex credits.

## Risks / Trade-offs

- Dashboard hydration format changes → Keep the parser narrow and log parse failures; the approach matches the actively used `opencode-quota` workaround.
- Auth cookie expires or is revoked → Display the Go error marker while Codex remains visible; user can refresh the env var value outside the extension.
- Balance unit interpretation is wrong → Keep conversion isolated and verify against the dashboard value during implementation.
- Combined status becomes long → Use compact provider prefixes and omit unavailable subsegments rather than verbose text.
